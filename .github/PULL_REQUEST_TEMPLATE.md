## Summary

<!-- What does this PR do? 1-3 bullet points -->

## Test plan

- [ ] `bun test` passes
- [ ] `bun run validate` passes
- [ ] Manual verification: <!-- describe -->

## Security checklist

- [ ] No new patterns bypass `security-validator`
- [ ] No skill content injected without `sanitizeContent()`
- [ ] No `process.exit(1)` in hooks (use `0` for non-critical, `2` for security block)
