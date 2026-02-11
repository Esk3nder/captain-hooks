#!/usr/bin/env bun
/**
 * format-enforcer.hook.ts — Response Format Reminder (UserPromptSubmit)
 *
 * PURPOSE: Inject response format reminder into context on every prompt.
 * TRIGGER: UserPromptSubmit
 * INPUT:   { prompt, session_id }
 * OUTPUT:  <system-reminder> with format template
 * EXIT:    Always 0
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { readStdin } from './lib/stdin.ts';
import { getFrameworkDir } from './lib/paths.ts';

interface HookInput {
  prompt: string;
  session_id: string;
}

// Skip format reminders for trivial prompts
const SKIP_PREFIXES = ['/', 'hi', 'hello', 'hey', 'thanks', 'ok', 'yes', 'no', 'bye'];

async function main(): Promise<void> {
  const input = await readStdin<HookInput>(50);
  if (!input?.prompt) process.exit(0);

  const lower = input.prompt.trim().toLowerCase();
  if (SKIP_PREFIXES.some(p => lower.startsWith(p))) process.exit(0);

  // Read format from CLAUDE.md if available, otherwise use default
  let format = `SUMMARY: [One sentence]
ACTIONS: [Steps taken]
RESULTS: [Outcomes]
NEXT: [Next steps]`;

  const claudePath = join(getFrameworkDir(), 'CLAUDE.md');
  if (existsSync(claudePath)) {
    try {
      const content = readFileSync(claudePath, 'utf-8');
      const formatMatch = content.match(/```\n(SUMMARY:[\s\S]*?)```/);
      if (formatMatch) {
        format = formatMatch[1].trim();
      }
    } catch { /* use default */ }
  }

  console.log(`<system-reminder>
Response format for task-based responses:
${format}
For simple answers, respond naturally.
</system-reminder>`);

  process.exit(0);
}

main().catch(() => process.exit(0));
