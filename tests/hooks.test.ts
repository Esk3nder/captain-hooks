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

  test('malformed input (missing tool_input) causes exit code 2', async () => {
    const { exitCode } = await runHook(
      'hooks/security-validator.hook.ts',
      { tool_name: 'Bash', session_id: 'test' },
    );

    expect(exitCode).toBe(2);
  });

  test('non-string command field is blocked (fail-closed)', async () => {
    const { stdout, exitCode } = await runHook(
      'hooks/security-validator.hook.ts',
      {
        tool_name: 'Bash',
        tool_input: { command: 123 },
        session_id: 'test-sec-type',
      },
    );

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.decision).toBe('block');
  });

  test('array command field is blocked (fail-closed)', async () => {
    const { stdout, exitCode } = await runHook(
      'hooks/security-validator.hook.ts',
      {
        tool_name: 'Bash',
        tool_input: { command: ['rm', '-rf', '/'] },
        session_id: 'test-sec-array',
      },
    );

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.decision).toBe('block');
  });

  test('missing command field on Bash tool is blocked', async () => {
    const { stdout, exitCode } = await runHook(
      'hooks/security-validator.hook.ts',
      {
        tool_name: 'Bash',
        tool_input: {},
        session_id: 'test-sec-no-cmd',
      },
    );

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.decision).toBe('block');
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
// security-validator — bypass resistance (P1-2 hardened patterns)
// ============================================================

describe('security-validator bypass resistance', () => {
  test('blocks rm with separated flags: rm -r -f /', async () => {
    const { stdout, exitCode } = await runHook(
      'hooks/security-validator.hook.ts',
      {
        tool_name: 'Bash',
        tool_input: { command: 'rm -r -f /' },
        session_id: 'test-bypass-1',
      },
    );

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.decision).toBe('block');
  });

  test('blocks rm with sudo prefix: sudo rm -rf /', async () => {
    const { stdout, exitCode } = await runHook(
      'hooks/security-validator.hook.ts',
      {
        tool_name: 'Bash',
        tool_input: { command: 'sudo rm -rf /' },
        session_id: 'test-bypass-2',
      },
    );

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.decision).toBe('block');
  });

  test('blocks rm in chained command: echo hi && rm -rf /', async () => {
    const { stdout, exitCode } = await runHook(
      'hooks/security-validator.hook.ts',
      {
        tool_name: 'Bash',
        tool_input: { command: 'echo hi && rm -rf /' },
        session_id: 'test-bypass-3',
      },
    );

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.decision).toBe('block');
  });

  test('blocks rm -rf ~ (home directory)', async () => {
    const { stdout, exitCode } = await runHook(
      'hooks/security-validator.hook.ts',
      {
        tool_name: 'Bash',
        tool_input: { command: 'rm -rf ~' },
        session_id: 'test-bypass-4',
      },
    );

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.decision).toBe('block');
  });

  test('blocks mkfs command', async () => {
    const { stdout, exitCode } = await runHook(
      'hooks/security-validator.hook.ts',
      {
        tool_name: 'Bash',
        tool_input: { command: 'mkfs.ext4 /dev/sda1' },
        session_id: 'test-bypass-5',
      },
    );

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.decision).toBe('block');
  });

  test('confirms git push --force', async () => {
    const { stdout, exitCode } = await runHook(
      'hooks/security-validator.hook.ts',
      {
        tool_name: 'Bash',
        tool_input: { command: 'git push --force origin main' },
        session_id: 'test-bypass-6',
      },
    );

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.decision).toBe('ask');
  });

  test('confirms git reset --hard', async () => {
    const { stdout, exitCode } = await runHook(
      'hooks/security-validator.hook.ts',
      {
        tool_name: 'Bash',
        tool_input: { command: 'git reset --hard HEAD~3' },
        session_id: 'test-bypass-7',
      },
    );

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.decision).toBe('ask');
  });

  test('blocks cat ~/.ssh/id_rsa via Bash', async () => {
    const { stdout, exitCode } = await runHook(
      'hooks/security-validator.hook.ts',
      {
        tool_name: 'Bash',
        tool_input: { command: 'cat ~/.ssh/id_rsa' },
        session_id: 'test-bash-path-1',
      },
    );

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.decision).toBe('block');
  });

  test('blocks cp ~/.aws/credentials via Bash', async () => {
    const { stdout, exitCode } = await runHook(
      'hooks/security-validator.hook.ts',
      {
        tool_name: 'Bash',
        tool_input: { command: 'cp ~/.aws/credentials /tmp/exfil' },
        session_id: 'test-bash-path-2',
      },
    );

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.decision).toBe('block');
  });

  test('blocks cat $HOME/.ssh/id_rsa via Bash', async () => {
    const { stdout, exitCode } = await runHook(
      'hooks/security-validator.hook.ts',
      {
        tool_name: 'Bash',
        tool_input: { command: 'cat $HOME/.ssh/id_rsa' },
        session_id: 'test-bash-path-home-1',
      },
    );

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.decision).toBe('block');
  });

  test('blocks cat ${HOME}/.ssh/id_rsa via Bash', async () => {
    const { stdout, exitCode } = await runHook(
      'hooks/security-validator.hook.ts',
      {
        tool_name: 'Bash',
        tool_input: { command: 'cat ${HOME}/.ssh/id_rsa' },
        session_id: 'test-bash-path-home-2',
      },
    );

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.decision).toBe('block');
  });

  test('blocks cat absolute ~/.ssh path via Bash', async () => {
    const abs = `${process.env.HOME}/.ssh/id_rsa`;
    const { stdout, exitCode } = await runHook(
      'hooks/security-validator.hook.ts',
      {
        tool_name: 'Bash',
        tool_input: { command: `cat ${abs}` },
        session_id: 'test-bash-path-abs-1',
      },
    );

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.decision).toBe('block');
  });

  test('blocks cp absolute ~/.aws/credentials via Bash', async () => {
    const abs = `${process.env.HOME}/.aws/credentials`;
    const { stdout, exitCode } = await runHook(
      'hooks/security-validator.hook.ts',
      {
        tool_name: 'Bash',
        tool_input: { command: `cp ${abs} /tmp/exfil` },
        session_id: 'test-bash-path-abs-2',
      },
    );

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.decision).toBe('block');
  });

  test('allows safe rm command: rm temp.txt', async () => {
    const { stdout, exitCode } = await runHook(
      'hooks/security-validator.hook.ts',
      {
        tool_name: 'Bash',
        tool_input: { command: 'rm temp.txt' },
        session_id: 'test-bypass-safe',
      },
    );

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.continue).toBe(true);
  });
});

// ============================================================
// security-validator — file path protection (P1-1 matcher fix)
// ============================================================

describe('security-validator file path protection', () => {
  test('Write to protected path returns block', async () => {
    const { stdout, exitCode } = await runHook(
      'hooks/security-validator.hook.ts',
      {
        tool_name: 'Write',
        tool_input: { file_path: `${process.env.HOME}/.ssh/authorized_keys` },
        session_id: 'test-path-1',
      },
    );

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.decision).toBe('block');
  });

  test('Edit to .env file returns ask', async () => {
    const { stdout, exitCode } = await runHook(
      'hooks/security-validator.hook.ts',
      {
        tool_name: 'Edit',
        tool_input: { file_path: '/project/.env' },
        session_id: 'test-path-2',
      },
    );

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.decision).toBe('ask');
  });

  test('Read from safe path returns allow', async () => {
    const { stdout, exitCode } = await runHook(
      'hooks/security-validator.hook.ts',
      {
        tool_name: 'Read',
        tool_input: { file_path: '/tmp/safe-file.txt' },
        session_id: 'test-path-3',
      },
    );

    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.continue).toBe(true);
  });

  test('path traversal via .. is resolved and blocked', async () => {
    const { stdout, exitCode } = await runHook(
      'hooks/security-validator.hook.ts',
      {
        tool_name: 'Read',
        tool_input: { file_path: `${process.env.HOME}/.config/../.ssh/id_rsa` },
        session_id: 'test-path-4',
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
// stop-orchestrator.hook.ts
// ============================================================

describe('stop-orchestrator', () => {
  test('exits cleanly with existing handlers dir', async () => {
    const { exitCode } = await runHook(
      'hooks/stop-orchestrator.hook.ts',
      { session_id: 'test-stop-1' },
    );

    expect(exitCode).toBe(0);
  });

  test('exits cleanly with valid input', async () => {
    const { exitCode } = await runHook(
      'hooks/stop-orchestrator.hook.ts',
      { session_id: 'test-stop-2', transcript_path: '/tmp/test-transcript' },
    );

    expect(exitCode).toBe(0);
  });

  test('exits cleanly with missing session_id', async () => {
    const { exitCode } = await runHook(
      'hooks/stop-orchestrator.hook.ts',
      {},
    );

    expect(exitCode).toBe(0);
  });
});

// ============================================================
// performance regression
// ============================================================

describe('performance regression', () => {
  test('security-validator completes within 200ms wall clock', async () => {
    const start = performance.now();
    const { exitCode } = await runHook(
      'hooks/security-validator.hook.ts',
      { tool_name: 'Bash', tool_input: { command: 'ls -la' }, session_id: 'perf-1' },
    );
    const elapsed = performance.now() - start;

    expect(exitCode).toBe(0);
    expect(elapsed).toBeLessThan(200);
  });

  test('skill-eval completes within 200ms wall clock', async () => {
    const start = performance.now();
    const { exitCode } = await runHook(
      'hooks/skill-eval.hook.ts',
      { prompt: 'create a new skill', session_id: 'perf-2' },
    );
    const elapsed = performance.now() - start;

    expect(exitCode).toBe(0);
    expect(elapsed).toBeLessThan(200);
  });

  test('format-enforcer completes within 200ms wall clock', async () => {
    const start = performance.now();
    const { exitCode } = await runHook(
      'hooks/format-enforcer.hook.ts',
      { prompt: 'refactor the module', session_id: 'perf-3' },
    );
    const elapsed = performance.now() - start;

    expect(exitCode).toBe(0);
    expect(elapsed).toBeLessThan(200);
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
