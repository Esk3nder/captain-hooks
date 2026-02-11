---
name: CreateSkill
description: Scaffold and manage skills in Captain Hooks. USE WHEN creating new skills, adding hooks, extending the framework, OR canonicalizing existing skills.
---

# CreateSkill

The meta-skill that teaches you how to extend Captain Hooks. Use this when you want to create a new skill, add a hook, or restructure an existing skill.

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Create** | "create a skill", "new skill", "add a skill" | `Workflows/Create.md` |
| **Canonicalize** | "canonicalize", "restructure skill" | `Workflows/Canonicalize.md` |

## Quick Reference

**Skill structure (required):**
```
SkillName/
  SKILL.md              # YAML frontmatter + workflow routing + examples
  Workflows/            # Execution procedures
    WorkflowName.md
  Tools/                # CLI tools (always present, even if empty)
```

**YAML frontmatter rules:**
- `name:` TitleCase (PascalCase)
- `description:` Single line, must contain `USE WHEN`
- Under 1024 characters

**Activation rule (skill-rules.json):**
- Add entry to `skills/skill-rules.json`
- Define triggers (keywords, patterns, intents, directories)
- Set type/enforcement/priority

**Size guidelines:**
- SKILL.md: under 100 lines (routing + quick reference)
- Workflows: under 200 lines each
- Move detailed docs to separate .md files in skill root

## Examples

**Example 1: Create a new skill**
```
User: "Create a skill for managing Docker containers"
-> Invokes Create workflow
-> Scaffolds DockerManager/ with SKILL.md, Workflows/, Tools/
-> Adds rule to skill-rules.json
-> Shows checklist for completion
```

**Example 2: Canonicalize an existing skill**
```
User: "Canonicalize the research skill"
-> Invokes Canonicalize workflow
-> Checks against canonical structure
-> Reports deviations
-> Offers to fix each one
```

## Related Files

- `skills/skill-rules.json` — activation rules
- `skills/skill-rules.schema.json` — validation schema
- `hooks/skill-eval.hook.ts` — activation evaluator
- `CUSTOMIZE.md` — fork-and-go guide
