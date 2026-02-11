# Changelog

All notable changes to Captain Hooks are documented here.

## [0.1.0] - 2026-02-11

### Added
- Four-primitive architecture: Skills, Hooks, Agents, Commands
- Weighted multi-factor skill activation engine (`skill-eval.hook.ts`)
- Fail-closed security validator with command and path protection (`security-validator.hook.ts`)
- Session context loader with identity injection (`context-loader.hook.ts`)
- Response format enforcer (`format-enforcer.hook.ts`)
- Stop handler orchestrator with `Promise.allSettled` isolation (`stop-orchestrator.hook.ts`)
- CreateSkill meta-skill for self-extending framework
- CORE skill with auto-load at session start
- JSON Schema validation for skill rules (`skill-rules.schema.json`)
- Comprehensive security patterns: rm, mkfs, fork bomb, dd, chmod, Bash path access
- 44 tests covering security bypass resistance, fail-closed behavior, path traversal, performance
- GitHub Actions CI (typecheck + test + skill validation)
- CUSTOMIZE.md with 5-step fork-and-go guide

### Security
- Fail-closed on malformed input (exit code 2)
- Fail-closed on pattern file corruption
- Bypass-resistant regex patterns (sudo, flag splitting, command chaining)
- Path traversal protection via `resolve()` + `expandPath()`
- Non-string Bash commands blocked (fail-closed)
- Protected paths blocked via Bash shell commands (cat, cp, scp)
- Pre-compiled regex patterns (no runtime compilation)
- Unknown tool names logged for drift detection
- Zero runtime dependencies (minimal attack surface)

### Performance
- Regex patterns pre-compiled at load time
- `homedir()` cached at module scope
- `process.cwd()` hoisted out of per-rule scoring
- Intent keywords hoisted to module scope
- stdin timer properly cleared (no leaked timers)
- Performance regression tests (200ms wall-clock budget)
