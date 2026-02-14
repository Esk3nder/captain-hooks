#!/usr/bin/env bun
/**
 * security-validator.hook.ts — Command/Path Safety Validator (PreToolUse)
 *
 * PURPOSE: Validate tool calls against security patterns before execution.
 * TRIGGER: PreToolUse (matcher: Bash, Write, Edit, Read)
 * INPUT:   { tool_name, tool_input, session_id }
 * OUTPUT:  JSON decision: { continue: true } or { decision: "block", message }
 * EXIT:    0 (with decision) or 2 (hard block)
 */

import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { readStdin } from './lib/stdin.ts';
import { getFrameworkDir, expandPath } from './lib/paths.ts';
import { log } from './lib/logger.ts';

interface HookInput {
  tool_name: string;
  tool_input: Record<string, unknown>;
  session_id: string;
}

const KNOWN_TOOLS = new Set(['Bash', 'Write', 'Edit', 'Read', 'Glob', 'Grep']);

interface CompiledPattern {
  regex: RegExp;
  source: string;
}

interface SecurityPatterns {
  commands?: {
    block?: CompiledPattern[];
    confirm?: CompiledPattern[];
  };
  paths?: {
    zeroAccess?: string[];
    confirmWrite?: string[];
  };
}

function loadPatterns(): SecurityPatterns | null {
  const patternsPath = join(getFrameworkDir(), 'security', 'patterns.yaml');
  if (!existsSync(patternsPath)) return {};

  try {
    // Simple YAML parser for our flat structure
    const content = readFileSync(patternsPath, 'utf-8');
    const patterns: SecurityPatterns = { commands: {}, paths: {} };

    let currentSection = '';
    let currentSubSection = '';

    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      if (trimmed === 'commands:') { currentSection = 'commands'; continue; }
      if (trimmed === 'paths:') { currentSection = 'paths'; continue; }

      if (trimmed.endsWith(':') && !trimmed.startsWith('-')) {
        currentSubSection = trimmed.slice(0, -1).trim();
        continue;
      }

      if (trimmed.startsWith('- ')) {
        const value = trimmed.slice(2).replace(/^["']|["']$/g, '');
        if (currentSection === 'commands') {
          try {
            const compiled = { regex: new RegExp(value), source: value };
            if (currentSubSection === 'block') {
              patterns.commands!.block = patterns.commands!.block || [];
              patterns.commands!.block.push(compiled);
            } else if (currentSubSection === 'confirm') {
              patterns.commands!.confirm = patterns.commands!.confirm || [];
              patterns.commands!.confirm.push(compiled);
            }
          } catch {
            log('security-validator', `Invalid regex pattern skipped: "${value}"`);
          }
        } else if (currentSection === 'paths') {
          if (currentSubSection === 'zeroAccess') {
            patterns.paths!.zeroAccess = patterns.paths!.zeroAccess || [];
            patterns.paths!.zeroAccess.push(expandPath(value));
          } else if (currentSubSection === 'confirmWrite') {
            patterns.paths!.confirmWrite = patterns.paths!.confirmWrite || [];
            patterns.paths!.confirmWrite.push(value);
          }
        }
      }
    }

    return patterns;
  } catch (e) {
    // Fail-closed: if we can't load patterns, we can't validate
    log('security-validator', `Failed to load patterns — blocking all operations: ${e}`);
    return null;
  }
}

function validateInput(raw: unknown): HookInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.tool_name !== 'string') return null;
  if (typeof obj.session_id !== 'string') return null;
  if (typeof obj.tool_input !== 'object' || obj.tool_input === null) return null;
  return obj as unknown as HookInput;
}

function extractCommand(input: Record<string, unknown>): string | null {
  return typeof input.command === 'string' ? input.command : null;
}

function extractPath(input: Record<string, unknown>): string | null {
  return typeof input.file_path === 'string' ? input.file_path : null;
}

function normalizeHomeTokens(command: string): string {
  return command
    .replace(/\$\{HOME\}/g, '~')
    .replace(/\$HOME\b/g, '~');
}

function commandReferencesProtectedPath(command: string, protectedPaths: string[]): boolean {
  const normalized = normalizeHomeTokens(command);
  for (const protectedPath of protectedPaths) {
    const expandedProtected = resolve(expandPath(protectedPath));
    if (normalized.includes(expandedProtected)) return true;

    const home = resolve(expandPath('~'));
    if (expandedProtected.startsWith(home)) {
      const suffix = expandedProtected.slice(home.length);
      if (suffix && normalized.includes(`~${suffix}`)) return true;
    }
  }
  return false;
}

async function main(): Promise<void> {
  const raw = await readStdin<unknown>(200);
  const input = validateInput(raw);
  if (!input) {
    // Fail-closed: missing or malformed input — block
    log('security-validator', 'Invalid or missing input — blocking (fail-closed)');
    process.exit(2);
  }

  // Log unrecognized tools for drift detection
  if (!KNOWN_TOOLS.has(input.tool_name)) {
    log('security-validator', `Unknown tool_name: "${input.tool_name}" — allowing but unvalidated`);
  }

  const patterns = loadPatterns();
  if (!patterns) {
    console.log(JSON.stringify({
      decision: 'block',
      message: 'Security patterns failed to load — blocking all operations',
    }));
    process.exit(0);
  }

  // Check Bash commands
  if (input.tool_name === 'Bash') {
    const cmd = extractCommand(input.tool_input);
    if (!cmd) {
      // Fail-closed: Bash tool MUST have a string command
      console.log(JSON.stringify({
        decision: 'block',
        message: 'Blocked: Bash command is missing or not a string',
      }));
      process.exit(0);
    }

    const cmdForPolicy = normalizeHomeTokens(cmd);

    // Block patterns (pre-compiled at load time)
    for (const { regex, source } of patterns.commands?.block || []) {
      if (regex.test(cmdForPolicy)) {
        console.log(JSON.stringify({
          decision: 'block',
          message: `Blocked by security policy: command matches "${source}"`,
        }));
        process.exit(0);
      }
    }

    // Block direct protected path references in shell commands (absolute paths and $HOME forms).
    if (commandReferencesProtectedPath(cmdForPolicy, patterns.paths?.zeroAccess || [])) {
      console.log(JSON.stringify({
        decision: 'block',
        message: 'Blocked by security policy: command references a protected path',
      }));
      process.exit(0);
    }

    // Confirm patterns (pre-compiled at load time)
    for (const { regex, source } of patterns.commands?.confirm || []) {
      if (regex.test(cmdForPolicy)) {
        console.log(JSON.stringify({
          decision: 'ask',
          message: `Security check: command matches "${source}". Proceed?`,
        }));
        process.exit(0);
      }
    }
  }

  // Check file paths (Write, Edit, Read)
  const filePath = extractPath(input.tool_input);
  if (filePath) {
    const expanded = resolve(expandPath(filePath));

    // Zero access paths
    for (const protected_path of patterns.paths?.zeroAccess || []) {
      if (expanded.startsWith(resolve(protected_path))) {
        console.log(JSON.stringify({
          decision: 'block',
          message: `Blocked: "${filePath}" is in a protected path`,
        }));
        process.exit(0);
      }
    }

    // Confirm write paths (use resolved path for consistency with zeroAccess)
    if (input.tool_name === 'Write' || input.tool_name === 'Edit') {
      for (const confirmPath of patterns.paths?.confirmWrite || []) {
        if (expanded.includes(confirmPath)) {
          console.log(JSON.stringify({
            decision: 'ask',
            message: `Security check: writing to "${filePath}". Proceed?`,
          }));
          process.exit(0);
        }
      }
    }
  }

  // Default: allow
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

main().catch((e) => {
  // Fail-closed: unhandled error means we can't validate — block
  log('security-validator', `Unhandled error — blocking (fail-closed): ${e}`);
  process.exit(2);
});
