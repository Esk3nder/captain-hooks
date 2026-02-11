import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

// ============================================================
// Test helpers
// ============================================================

const ROOT = join(import.meta.dir, '..');

async function runHook(
  hookPath: string,
  input: Record<string, unknown>,
  timeoutMs = 5000,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(['bun', join(ROOT, hookPath)], {
    stdin: new Response(JSON.stringify(input)),
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT },
  });

  const timer = setTimeout(() => proc.kill(), timeoutMs);
  const exitCode = await proc.exited;
  clearTimeout(timer);

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
}

// ============================================================
// paths.ts
// ============================================================

describe('hooks/lib/paths', () => {
  // Import directly since these are pure functions
  const { expandPath, getFrameworkDir } = require('../hooks/lib/paths.ts');

  test('expandPath replaces ~ with homedir', () => {
    const result = expandPath('~/foo/bar');
    expect(result).not.toContain('~');
    expect(result).toMatch(/\/foo\/bar$/);
  });

  test('expandPath replaces $HOME with homedir', () => {
    const result = expandPath('$HOME/projects');
    expect(result).not.toContain('$HOME');
    expect(result).toMatch(/\/projects$/);
  });

  test('expandPath replaces ${HOME} with homedir', () => {
    const result = expandPath('${HOME}/test');
    expect(result).not.toContain('${HOME}');
    expect(result).toMatch(/\/test$/);
  });

  test('expandPath leaves absolute paths untouched', () => {
    expect(expandPath('/usr/local/bin')).toBe('/usr/local/bin');
  });

  test('getFrameworkDir uses CLAUDE_PROJECT_DIR env', () => {
    const orig = process.env.CLAUDE_PROJECT_DIR;
    process.env.CLAUDE_PROJECT_DIR = '/tmp/test-framework';
    expect(getFrameworkDir()).toBe('/tmp/test-framework');
    if (orig) process.env.CLAUDE_PROJECT_DIR = orig;
    else delete process.env.CLAUDE_PROJECT_DIR;
  });
});

// ============================================================
// identity.ts
// ============================================================

describe('hooks/lib/identity', () => {
  test('returns defaults when settings.json has default values', () => {
    // Settings.json in the repo has default "Assistant" and "User"
    const settings = JSON.parse(
      readFileSync(join(ROOT, 'settings.json'), 'utf-8'),
    );
    expect(settings.identity.name).toBe('Assistant');
    expect(settings.principal.name).toBe('User');
  });
});

// ============================================================
// skill-eval.hook.ts — scoring engine
// ============================================================

describe('skill-eval scoring', () => {
  test('matching prompt activates skill and returns system-reminder', async () => {
    const { stdout, exitCode } = await runHook(
      'hooks/skill-eval.hook.ts',
      { prompt: 'create a new skill for my project', session_id: 'test-1' },
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain('<system-reminder>');
    expect(stdout).toContain('CreateSkill');
  });

  test('excluded prompt (slash command) produces no output', async () => {
    const { stdout, exitCode } = await runHook(
      'hooks/skill-eval.hook.ts',
      { prompt: '/help', session_id: 'test-2' },
    );

    expect(exitCode).toBe(0);
    expect(stdout).toBe('');
  });

  test('excluded prompt (greeting) produces no output', async () => {
    const { stdout, exitCode } = await runHook(
      'hooks/skill-eval.hook.ts',
      { prompt: 'hello there', session_id: 'test-3' },
    );

    expect(exitCode).toBe(0);
    expect(stdout).toBe('');
  });

  test('unrelated prompt below threshold produces no output', async () => {
    const { stdout, exitCode } = await runHook(
      'hooks/skill-eval.hook.ts',
      { prompt: 'what is the weather today', session_id: 'test-4' },
    );

    expect(exitCode).toBe(0);
    expect(stdout).toBe('');
  });

  test('empty prompt exits cleanly', async () => {
    const { stdout, exitCode } = await runHook(
      'hooks/skill-eval.hook.ts',
      { prompt: '', session_id: 'test-5' },
    );

    expect(exitCode).toBe(0);
    expect(stdout).toBe('');
  });
});

// ============================================================
// security-validator.hook.ts — fail-closed behavior
// ============================================================

describe('security-validator fail-closed', () => {
  test('missing input causes exit code 2 (block)', async () => {
    const { exitCode } = await runHook(
      'hooks/security-validator.hook.ts',
      {},
    );

    expect(exitCode).toBe(2);
  });

  test('valid Bash command with no matching pattern is allowed', async () => {
    const { stdout, exitCode } = await runHook(
      'hooks/security-validator.hook.ts',
      {
        tool_name: 'Bash',
        tool_input: { command: 'ls -la' },
        session_id: 'test-sec-1',
      },
    );

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.continue).toBe(true);
  });

  test('blocked command pattern returns block decision', async () => {
    const { stdout, exitCode } = await runHook(
      'hooks/security-validator.hook.ts',
      {
        tool_name: 'Bash',
        tool_input: { command: 'rm -rf /' },
        session_id: 'test-sec-2',
      },
    );

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.decision).toBe('block');
  });

  test('Read on protected path returns block decision', async () => {
    const { stdout, exitCode } = await runHook(
      'hooks/security-validator.hook.ts',
      {
        tool_name: 'Read',
        tool_input: { file_path: `${process.env.HOME}/.ssh/id_rsa` },
        session_id: 'test-sec-3',
      },
    );

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.decision).toBe('block');
  });
});

// ============================================================
// context-loader.hook.ts
// ============================================================

describe('context-loader', () => {
  test('injects identity and CORE skill', async () => {
    const { stdout, exitCode } = await runHook(
      'hooks/context-loader.hook.ts',
      { session_id: 'test-ctx-1' },
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain('<system-reminder>');
    expect(stdout).toContain('Assistant');
    expect(stdout).toContain("User's AI assistant");
  });
});

// ============================================================
// format-enforcer.hook.ts
// ============================================================

describe('format-enforcer', () => {
  test('injects format reminder for normal prompt', async () => {
    const { stdout, exitCode } = await runHook(
      'hooks/format-enforcer.hook.ts',
      { prompt: 'refactor the authentication module', session_id: 'test-fmt-1' },
    );

    expect(exitCode).toBe(0);
    expect(stdout).toContain('<system-reminder>');
    expect(stdout).toContain('SUMMARY');
  });

  test('skips format reminder for greeting', async () => {
    const { stdout, exitCode } = await runHook(
      'hooks/format-enforcer.hook.ts',
      { prompt: 'hi there', session_id: 'test-fmt-2' },
    );

    expect(exitCode).toBe(0);
    expect(stdout).toBe('');
  });

  test('skips format reminder for slash command', async () => {
    const { stdout, exitCode } = await runHook(
      'hooks/format-enforcer.hook.ts',
      { prompt: '/commit', session_id: 'test-fmt-3' },
    );

    expect(exitCode).toBe(0);
    expect(stdout).toBe('');
  });
});

// ============================================================
// validate-skills.ts
// ============================================================

describe('validate-skills script', () => {
  test('validation passes for current skills', async () => {
    const proc = Bun.spawn(['bun', join(ROOT, 'scripts/validate-skills.ts')], {
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT },
    });

    const exitCode = await proc.exited;
    expect(exitCode).toBe(0);
  });
});
