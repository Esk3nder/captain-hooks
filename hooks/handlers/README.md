# Stop Handlers

Handlers are post-response scripts run by `stop-orchestrator.hook.ts` after Claude finishes a response.

## How It Works

1. The `Stop` hook fires after each Claude response
2. `stop-orchestrator.hook.ts` scans this directory for `.ts` files
3. Each file's default export is called with `Promise.allSettled` (parallel, failure-isolated)

## Handler Contract

Each handler must export a default async function:

```typescript
interface StopInput {
  session_id: string;
  transcript_path?: string;
}

export default async function myHandler(input: StopInput): Promise<void> {
  // Your post-response logic here
}
```

## Naming Conventions

| Prefix | Meaning |
|--------|---------|
| `_` | Example/deletable (e.g., `_voice-example.ts`) |
| No prefix | Production handler |

## Adding a Handler

1. Create a `.ts` file in this directory
2. Export a default async function matching the contract above
3. It will be auto-discovered on the next Stop event

No changes to `settings.json` needed — the orchestrator discovers handlers dynamically.

## Examples

- `_voice-example.ts` — Sends voice notification (example, safe to delete)
