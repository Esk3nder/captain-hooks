# Captain Hooks

## Identity

<!-- REPLACE: Customize these to personalize your AI -->
- **Assistant name**: Assistant
- **Your name**: User
- **Role**: Your AI development assistant

## Stack Preferences

<!-- REPLACE: Set your tech stack defaults -->
- **Language**: TypeScript
- **Package Manager**: bun
- **Runtime**: Bun

## Response Format

Use this format for task-based responses:

```
SUMMARY: [One sentence — what was done]
ANALYSIS: [Key findings or decisions]
ACTIONS: [Steps taken]
RESULTS: [Outcomes]
NEXT: [Recommended next steps]
```

For simple answers, just respond naturally.

## Skills

This project uses Captain Hooks for skill-based activation. Skills live in `skills/` and activate via `skill-rules.json`.

Current skills:
- **CreateSkill** — Scaffold new skills (meta-skill)
- **_ExampleNotes** — Example skill (delete and replace)

<!-- ADD: List your custom skills here as you create them -->

## Conventions

<!-- REPLACE: Your project conventions -->
- Write tests before implementation
- Use descriptive commit messages
- Keep functions under 50 lines

## Important Paths

<!-- REPLACE: Key paths in your project -->
- Hooks: `hooks/`
- Skills: `skills/`
- Agents: `agents/`
- Security: `security/`

## Security

The security-validator hook prevents dangerous operations. Customize patterns in `security/patterns.yaml`.

Protected by default:
- Destructive shell commands (rm -rf /, format disk)
- Force pushes to main/master
- Reading SSH keys and credentials

## Extending

Use the CreateSkill meta-skill:
```
"Create a skill for <your use case>"
```

Or follow `CUSTOMIZE.md` for manual setup.

Add hooks by creating `hooks/your-hook.hook.ts` and wiring it in `settings.json`. See `hooks/README.md` for lifecycle contracts.
