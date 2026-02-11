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

interface SecurityPatterns {
  commands?: {
    block?: string[];
    confirm?: string[];
  };
  paths?: {
    zeroAccess?: string[];
    confirmWrite?: string[];
  };
}

function loadPatterns(): SecurityPatterns {
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
          if (currentSubSection === 'block') {
            patterns.commands!.block = patterns.commands!.block || [];
            patterns.commands!.block.push(value);
          } else if (currentSubSection === 'confirm') {
            patterns.commands!.confirm = patterns.commands!.confirm || [];
            patterns.commands!.confirm.push(value);
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
    log('security-validator', `Failed to load patterns: ${e}`);
    return {};
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

async function main(): Promise<void> {
  const raw = await readStdin<unknown>(200);
  const input = validateInput(raw);
  if (!input) {
    // Fail-closed: missing or malformed input — block
    log('security-validator', 'Invalid or missing input — blocking (fail-closed)');
    process.exit(2);
  }

  const patterns = loadPatterns();

  // Check Bash commands
  if (input.tool_name === 'Bash') {
    const cmd = extractCommand(input.tool_input);
    if (cmd) {
      // Block patterns
      for (const pattern of patterns.commands?.block || []) {
        try {
          if (new RegExp(pattern).test(cmd)) {
            console.log(JSON.stringify({
              decision: 'block',
              message: `Blocked by security policy: command matches "${pattern}"`,
            }));
            process.exit(0);
          }
        } catch { /* invalid regex */ }
      }

      // Confirm patterns
      for (const pattern of patterns.commands?.confirm || []) {
        try {
          if (new RegExp(pattern).test(cmd)) {
            console.log(JSON.stringify({
              decision: 'ask',
              message: `Security check: command matches "${pattern}". Proceed?`,
            }));
            process.exit(0);
          }
        } catch { /* invalid regex */ }
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

    // Confirm write paths
    if (input.tool_name === 'Write' || input.tool_name === 'Edit') {
      for (const confirmPath of patterns.paths?.confirmWrite || []) {
        if (filePath.includes(confirmPath)) {
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
