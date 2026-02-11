# Create Skill Workflow

Step-by-step procedure for creating a new skill in Captain Hooks.

## Inputs

Gather from the user:
1. **Skill name** (TitleCase, e.g., `DockerManager`)
2. **Description** (what it does, one sentence)
3. **Trigger keywords** (3-8 words that indicate when to activate)
4. **Trigger intents** (debug, create, deploy, test, refactor, research, review, extend, capture)
5. **Workflow names** (what procedures will this skill execute?)

## Step 1: Scaffold Directory

```bash
SKILL_NAME="<TitleCase name>"
mkdir -p skills/$SKILL_NAME/Workflows skills/$SKILL_NAME/Tools
```

## Step 2: Generate SKILL.md

Write the following to `skills/$SKILL_NAME/SKILL.md`:

```markdown
---
name: $SKILL_NAME
description: <description>. USE WHEN <trigger phrases joined with OR>.
---

# $SKILL_NAME

<Brief description>

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **<Name>** | "<trigger phrase>" | `Workflows/<Name>.md` |

## Examples

**Example 1: <Common use case>**
```
User: "<Realistic user request>"
-> Invokes <Workflow> workflow
-> <What happens>
-> <What user gets>
```

**Example 2: <Another use case>**
```
User: "<Another request>"
-> <Process>
-> <Output>
```
```

## Step 3: Create Workflow Files

For each workflow, create `skills/$SKILL_NAME/Workflows/<Name>.md`:

```markdown
# <Name> Workflow

<What this workflow does>

## Steps

1. <Step one>
2. <Step two>
3. <Step three>

## Inputs

- <Required input 1>

## Output

- <What gets produced>
```

## Step 4: Add Activation Rule

Add an entry to `skills/skill-rules.json` in the `rules` array:

```json
{
  "skill": "$SKILL_NAME",
  "type": "proactive",
  "enforcement": "suggest",
  "priority": 5,
  "triggers": {
    "keywords": ["<keyword1>", "<keyword2>", "<keyword3>"],
    "patterns": ["<regex1>"],
    "intents": ["<intent1>"]
  },
  "suggestion": "<What to tell the user when this skill matches>"
}
```

## Step 5: Validate

```bash
bun scripts/validate-skills.ts
```

Check output for:
- YAML frontmatter is valid
- USE WHEN is present in description
- All referenced workflow files exist
- skill-rules.json validates against schema

## Step 6: Test Activation

Start a new Claude Code session and type a prompt that should trigger the skill. Verify the suggestion appears.

## Completion Checklist

- [ ] Directory created: `skills/$SKILL_NAME/`
- [ ] SKILL.md has YAML frontmatter with `USE WHEN`
- [ ] SKILL.md has `## Workflow Routing` table
- [ ] SKILL.md has `## Examples` with 2+ examples
- [ ] All workflow files exist in `Workflows/`
- [ ] `Tools/` directory exists (even if empty)
- [ ] Rule added to `skill-rules.json`
- [ ] `bun scripts/validate-skills.ts` passes
- [ ] Activation tested in a session
