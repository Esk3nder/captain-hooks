#!/usr/bin/env bun
/**
 * _post-tool-example.hook.ts — Example PostToolUse Hook (DELETABLE)
 *
 * PURPOSE: Demonstrates the PostToolUse pattern. Not wired by default.
 * TRIGGER: PostToolUse (matcher: Write|Edit)
 * INPUT:   { tool_name, tool_input, tool_output, session_id }
 * OUTPUT:  <system-reminder> with guidance
 *
 * TO USE: Wire this in settings.json under PostToolUse:
 * { "matcher": "Write|Edit", "hooks": [{ "type": "command", "command": "bun hooks/_post-tool-example.hook.ts" }] }
 */

import { readStdin } from './lib/stdin.ts';

interface HookInput {
  tool_name: string;
  tool_input: { file_path?: string };
  tool_output?: string;
  session_id: string;
}

async function main(): Promise<void> {
  const input = await readStdin<HookInput>(100);
  if (!input?.tool_input?.file_path) process.exit(0);

  const path = input.tool_input.file_path;

  // Example: suggest formatting for TypeScript files
  if (path.match(/\.(ts|tsx|js|jsx)$/)) {
    console.log(`<system-reminder>File modified: ${path}. Consider running tests if this file has coverage.</system-reminder>`);
  }

  process.exit(0);
}

main().catch(() => process.exit(0));
