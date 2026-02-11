#!/usr/bin/env bun
/**
 * context-loader.hook.ts — Session Context Loader (SessionStart)
 *
 * PURPOSE: Inject identity, core skill, and session context at session start.
 * TRIGGER: SessionStart
 * INPUT:   { session_id }
 * OUTPUT:  <system-reminder> with identity + CORE skill content
 * EXIT:    0 (success) or 1 (non-critical failure)
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { readStdin } from './lib/stdin.ts';
import { getFrameworkDir } from './lib/paths.ts';
import { getIdentityName, getPrincipalName } from './lib/identity.ts';
import { log } from './lib/logger.ts';

interface HookInput {
  session_id: string;
}

async function main(): Promise<void> {
  const input = await readStdin<HookInput>(200);
  if (!input?.session_id) process.exit(0);

  const parts: string[] = [];

  // Identity context
  const aiName = getIdentityName();
  const userName = getPrincipalName();
  parts.push(`You are ${aiName}, ${userName}'s AI assistant.`);

  // Load CORE skill if it exists
  const corePath = join(getFrameworkDir(), 'skills', 'CORE', 'SKILL.md');
  if (existsSync(corePath)) {
    try {
      const content = readFileSync(corePath, 'utf-8');
      parts.push(`--- CORE Skill ---\n${content}`);
    } catch (e) {
      log('context-loader', `Failed to load CORE skill: ${e}`);
    }
  }

  // Load CLAUDE.md if it exists
  const claudePath = join(getFrameworkDir(), 'CLAUDE.md');
  if (existsSync(claudePath)) {
    try {
      const content = readFileSync(claudePath, 'utf-8');
      parts.push(`--- Project Instructions ---\n${content}`);
    } catch (e) {
      log('context-loader', `Failed to load CLAUDE.md: ${e}`);
    }
  }

  if (parts.length > 0) {
    console.log(`<system-reminder>\n${parts.join('\n\n')}\n</system-reminder>`);
  }

  process.exit(0);
}

main().catch(() => process.exit(0));
