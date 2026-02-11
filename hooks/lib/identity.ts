/**
 * Identity loader from settings.json.
 * Provides assistant name and principal name.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getFrameworkDir } from './paths.ts';

interface Settings {
  identity?: { name?: string; displayName?: string };
  principal?: { name?: string };
}

let cached: Settings | null = null;

function load(): Settings {
  if (cached) return cached;
  const path = join(getFrameworkDir(), 'settings.json');
  try {
    if (!existsSync(path)) return {};
    cached = JSON.parse(readFileSync(path, 'utf-8'));
    return cached!;
  } catch {
    return {};
  }
}

export function getIdentityName(): string {
  return load().identity?.name ?? 'Assistant';
}

export function getDisplayName(): string {
  return load().identity?.displayName ?? getIdentityName();
}

export function getPrincipalName(): string {
  return load().principal?.name ?? 'User';
}
