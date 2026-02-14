import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

const REPO_ROOT = join(import.meta.dir, '..');
const HOOKS_DIR = join(REPO_ROOT, 'hooks');

async function execHook(
  hookFile: string,
  input: Record<string, unknown>,
  timeoutMs = 5000,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(['bun', join(HOOKS_DIR, hookFile)], {
    stdin: new Response(JSON.stringify(input)),
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, CLAUDE_PROJECT_DIR: REPO_ROOT },
  });

  const timer = setTimeout(() => proc.kill(), timeoutMs);
  const exitCode = await proc.exited;
  clearTimeout(timer);

  const stdout = (await new Response(proc.stdout).text()).trim();
  const stderr = (await new Response(proc.stderr).text()).trim();
  return { stdout, stderr, exitCode };
}

async function execCommand(
  argv: string[],
  input: Record<string, unknown>,
  timeoutMs = 5000,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(argv, {
    stdin: new Response(JSON.stringify(input)),
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, CLAUDE_PROJECT_DIR: REPO_ROOT },
  });

  const timer = setTimeout(() => proc.kill(), timeoutMs);
  const exitCode = await proc.exited;
  clearTimeout(timer);

  const stdout = (await new Response(proc.stdout).text()).trim();
  const stderr = (await new Response(proc.stderr).text()).trim();
  return { stdout, stderr, exitCode };
}

describe('E2E hook lifecycle (independent harness)', () => {
  test('SessionStart: context-loader injects system reminder', async () => {
    const { stdout, exitCode } = await execHook('context-loader.hook.ts', {
      session_id: 'e2e-session',
    });

    expect(exitCode).toBe(0);
    expect(stdout).toContain('<system-reminder>');
    expect(stdout).toContain("User's AI assistant");
    expect(stdout).toContain('--- CORE Skill ---');
    expect(stdout).toContain('--- Project Instructions ---');
  });

  test('UserPromptSubmit: skill-eval suggests CreateSkill for matching prompt', async () => {
    const { stdout, exitCode } = await execHook('skill-eval.hook.ts', {
      prompt: 'create a new skill for my project',
      session_id: 'e2e-session',
    });

    expect(exitCode).toBe(0);
    expect(stdout).toContain('<system-reminder>');
    expect(stdout).toContain('CreateSkill');
  });

  test('UserPromptSubmit: format-enforcer injects format reminder for non-trivial prompt', async () => {
    const { stdout, exitCode } = await execHook('format-enforcer.hook.ts', {
      prompt: 'refactor authentication module',
      session_id: 'e2e-session',
    });

    expect(exitCode).toBe(0);
    expect(stdout).toContain('<system-reminder>');
    expect(stdout).toContain('SUMMARY');
  });

  test('PreToolUse: security-validator blocks credential reads via Bash ($HOME + absolute path)', async () => {
    const home = process.env.HOME || '';
    expect(home.length).toBeGreaterThan(0);

    const cases = [
      'cat $HOME/.ssh/id_rsa',
      'cat ${HOME}/.ssh/id_rsa',
      `cat ${home}/.ssh/id_rsa`,
      `cp ${home}/.aws/credentials /tmp/exfil`,
    ];

    for (const command of cases) {
      const { stdout, exitCode } = await execHook('security-validator.hook.ts', {
        tool_name: 'Bash',
        tool_input: { command },
        session_id: 'e2e-session',
      });

      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout);
      expect(result.decision).toBe('block');
    }
  });

  test('Stop: stop-orchestrator exits cleanly', async () => {
    const { stdout, exitCode } = await execHook('stop-orchestrator.hook.ts', {
      session_id: 'e2e-session',
      transcript_path: '/tmp/transcript',
    });

    expect(exitCode).toBe(0);
    expect(stdout).toBe('');
  });
});

describe('E2E settings.json wiring (independent harness)', () => {
  test('all command hooks listed in settings.json execute with minimal payloads', async () => {
    const settings = JSON.parse(readFileSync(join(REPO_ROOT, 'settings.json'), 'utf-8'));
    const commands: string[] = [];

    for (const phase of Object.keys(settings.hooks || {})) {
      for (const block of settings.hooks[phase] || []) {
        for (const h of block.hooks || []) {
          if (h && h.type === 'command' && typeof h.command === 'string') commands.push(h.command);
        }
      }
    }

    expect(commands.length).toBeGreaterThan(0);

    for (const cmd of commands) {
      // settings.json uses bun + ${CLAUDE_PROJECT_DIR}/hooks/<file>
      const resolved = cmd.replaceAll('${CLAUDE_PROJECT_DIR}', REPO_ROOT);
      const parts = resolved.split(/\s+/).filter(Boolean);

      // Provide minimal payload shaped for the hook, based on filename.
      let payload: Record<string, unknown> = {};
      if (resolved.includes('context-loader.hook.ts')) payload = { session_id: 'e2e-settings' };
      else if (resolved.includes('skill-eval.hook.ts')) payload = { prompt: 'create a skill', session_id: 'e2e-settings' };
      else if (resolved.includes('format-enforcer.hook.ts')) payload = { prompt: 'refactor', session_id: 'e2e-settings' };
      else if (resolved.includes('security-validator.hook.ts')) payload = { tool_name: 'Bash', tool_input: { command: 'ls' }, session_id: 'e2e-settings' };
      else if (resolved.includes('stop-orchestrator.hook.ts')) payload = { session_id: 'e2e-settings', transcript_path: '/tmp/t' };

      const { exitCode, stderr } = await execCommand(parts, payload);
      expect(stderr).not.toContain('Unhandled');
      expect(exitCode).toBe(0);
    }
  });
});

