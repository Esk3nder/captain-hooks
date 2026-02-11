---
name: CORE
description: Framework identity, stack preferences, and response format. AUTO-LOADS at session start via context-loader hook.
---

# CORE

Auto-loaded at session start. Defines your AI's identity and operating context.

## Identity

<!-- REPLACE: Customize in settings.json -->
- **Assistant**: Reads from `settings.json` > `identity.name`
- **User**: Reads from `settings.json` > `principal.name`

## Stack Preferences

<!-- REPLACE: Set in CLAUDE.md -->
Loaded from CLAUDE.md at session start.

## Response Format

<!-- REPLACE: Set in CLAUDE.md -->
Loaded from CLAUDE.md at session start.

## How This Skill Works

Unlike other skills, CORE is not activated by skill-rules.json. It is loaded directly by `hooks/context-loader.hook.ts` on every SessionStart event. This ensures identity and preferences are always available.

## Customization

Edit `CLAUDE.md` to change:
- Identity (name, role)
- Stack preferences (language, package manager, runtime)
- Response format template
- Conventions and important paths
