/**
 * Path resolution utilities.
 * Handles $HOME, ~, and FRAMEWORK_DIR expansion.
 */

import { homedir } from 'os';
import { join } from 'path';

export function expandPath(path: string): string {
  const home = homedir();
  return path
    .replace(/^\$HOME(?=\/|$)/, home)
    .replace(/^\$\{HOME\}(?=\/|$)/, home)
    .replace(/^~(?=\/|$)/, home);
}

export function getFrameworkDir(): string {
  const env = process.env.CLAUDE_PROJECT_DIR || process.env.FRAMEWORK_DIR;
  if (env) return expandPath(env);
  return join(homedir(), '.claude');
}

export function frameworkPath(...segments: string[]): string {
  return join(getFrameworkDir(), ...segments);
}
