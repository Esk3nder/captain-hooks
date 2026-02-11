# Hook Lifecycle Contracts

Hooks are TypeScript scripts (`#!/usr/bin/env bun`) that execute at specific lifecycle events in Claude Code. Each hook type has a strict contract.

## Event Types

| Event | When | Stdin | Stdout | Can Block |
|-------|------|-------|--------|-----------|
| SessionStart | Session begins | `{ session_id }` | System reminder | No |
| UserPromptSubmit | User sends message | `{ prompt, session_id }` | System reminder | No |
| PreToolUse | Before tool executes | `{ tool_name, tool_input, session_id }` | Decision JSON | Yes |
| PostToolUse | After tool completes | `{ tool_name, tool_input, tool_output, session_id }` | System reminder | No |
| Stop | After model responds | `{ session_id, transcript_path }` | Ignored | No |
| SubagentStop | Subagent completes | `{ session_id, transcript_path }` | Ignored | No |
| SessionEnd | Session terminates | `{ session_id, transcript_path }` | Ignored | No |
| PreCompact | Before context compact | `{ session_id, transcript_path }` | System reminder | No |

## Exit Codes

| Code | Meaning | Used By |
|------|---------|---------|
| 0 | Success | All hooks |
| 1 | Error (logged, continues) | SessionStart |
| 2 | Hard block (tool prevented) | PreToolUse only |

## PreToolUse Decisions

```json
{"continue": true}                           // Allow
{"decision": "block", "message": "Reason"}   // Block with explanation
{"decision": "ask", "message": "Confirm?"}   // Prompt user
```

## Hook File Template

```typescript
#!/usr/bin/env bun
/**
 * my-hook.hook.ts — Brief Description (EventType)
 *
 * PURPOSE: What this hook does
 * TRIGGER: EventType
 * INPUT:   What it receives
 * OUTPUT:  What it produces
 */

import { readStdin } from './lib/stdin.ts';
import { log } from './lib/logger.ts';

interface HookInput {
  session_id: string;
  // ... event-specific fields
}

async function main(): Promise<void> {
  const input = await readStdin<HookInput>(100);
  if (!input) process.exit(0);

  // Your logic here

  process.exit(0);
}

main().catch(() => process.exit(0));
```

## Timing Guidelines

| Event | Target | Max |
|-------|--------|-----|
| SessionStart | < 200ms | 1s |
| UserPromptSubmit | < 100ms | 500ms |
| PreToolUse | < 10ms | 100ms |
| PostToolUse | < 100ms | 500ms |
| Stop | < 200ms | 2s |

## This Framework Ships With

| Hook | Event | Purpose |
|------|-------|---------|
| `context-loader.hook.ts` | SessionStart | Identity + CORE skill + CLAUDE.md |
| `skill-eval.hook.ts` | UserPromptSubmit | Weighted skill activation |
| `format-enforcer.hook.ts` | UserPromptSubmit | Response format reminder |
| `security-validator.hook.ts` | PreToolUse | Command/path safety |
| `stop-orchestrator.hook.ts` | Stop | Distributes to handlers/ |
| `_post-tool-example.hook.ts` | PostToolUse | Example (not wired) |
