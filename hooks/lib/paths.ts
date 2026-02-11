/**
 * Path resolution utilities.
 * Handles $HOME, ~, and FRAMEWORK_DIR expansion.
 */

import { homedir } from 'os';
import { join } from 'path';

const HOME = homedir();

export function expandPath(path: string): string {
  return path
    .replace(/^\$HOME(?=\/|$)/, HOME)
    .replace(/^\$\{HOME\}(?=\/|$)/, HOME)
    .replace(/^~(?=\/|$)/, HOME);
}

export function getFrameworkDir(): string {
  const env = process.env.CLAUDE_PROJECT_DIR || process.env.FRAMEWORK_DIR;
  if (env) return expandPath(env);
  return join(HOME, '.claude');
}

export function frameworkPath(...segments: string[]): string {
  return join(getFrameworkDir(), ...segments);
}
