# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability in Captain Hooks, please report it responsibly.

**Do NOT open a public issue.**

Instead, email: **security@captain-hooks.dev** (or open a [private security advisory](https://github.com/Esk3nder/captain-hooks/security/advisories/new) on GitHub).

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response timeline

- **Acknowledgment**: Within 48 hours
- **Assessment**: Within 1 week
- **Fix**: Within 2 weeks for critical issues

### Scope

The following are in scope:
- Security pattern bypasses in `security-validator.hook.ts`
- Path traversal or escape vulnerabilities
- Command injection vectors
- Configuration tampering that disables security
- Skill content injection into system context

The following are out of scope:
- Issues requiring physical access to the machine
- Social engineering attacks
- Denial of service against Claude Code itself

## Security Architecture

Captain Hooks uses a **fail-closed** security model:
- Malformed input to the security validator results in a hard block (exit code 2)
- Failed pattern loading blocks all operations
- Unknown tool types are logged but allowed (defense-in-depth via Claude Code's native permissions)

Security patterns are defined in `security/patterns.yaml` and validated at load time with pre-compiled regex.

See `hooks/security-validator.hook.ts` for implementation details.
