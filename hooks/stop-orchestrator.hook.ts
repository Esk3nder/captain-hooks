#!/usr/bin/env bun
/**
 * stop-orchestrator.hook.ts — Post-Response Handler (Stop)
 *
 * PURPOSE: Coordinate post-response actions by distributing to handlers/.
 * TRIGGER: Stop
 * INPUT:   { session_id, transcript_path }
 * OUTPUT:  None (stdout ignored for Stop hooks)
 * EXIT:    Always 0
 *
 * Add handlers in hooks/handlers/ — each exports a default async function.
 * The orchestrator runs all handlers with Promise.allSettled.
 */

import { readdirSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { readStdin } from './lib/stdin.ts';
import { getFrameworkDir } from './lib/paths.ts';
import { log, logError } from './lib/logger.ts';

interface HookInput {
  session_id: string;
  transcript_path?: string;
  hook_event_name?: string;
}

interface Handler {
  default: (input: HookInput) => Promise<void>;
}

async function main(): Promise<void> {
  const input = await readStdin<HookInput>(200);
  if (!input?.session_id) process.exit(0);

  const handlersDir = join(getFrameworkDir(), 'hooks', 'handlers');
  if (!existsSync(handlersDir)) process.exit(0);

  // Find all handler files
  const files = readdirSync(handlersDir).filter(
    f => extname(f) === '.ts' && !f.startsWith('.')
  );

  if (files.length === 0) process.exit(0);

  // Run all handlers concurrently, isolating failures
  const results = await Promise.allSettled(
    files.map(async (file) => {
      try {
        const handler: Handler = await import(join(handlersDir, file));
        if (typeof handler.default === 'function') {
          await handler.default(input);
        }
      } catch (e) {
        logError('stop-orchestrator', `Handler ${file} failed: ${e}`);
      }
    })
  );

  const failed = results.filter(r => r.status === 'rejected');
  if (failed.length > 0) {
    log('stop-orchestrator', `${failed.length}/${files.length} handlers failed`);
  }

  process.exit(0);
}

main().catch(() => process.exit(0));
