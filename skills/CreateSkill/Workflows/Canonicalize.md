# Canonicalize Skill Workflow

Restructure an existing skill to match the canonical Captain Hooks format.

## Step 1: Identify Target

Ask user which skill to canonicalize, or detect from context.

## Step 2: Audit Structure

Check the skill against each requirement:

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Directory name | TitleCase | ? | ? |
| SKILL.md exists | Yes | ? | ? |
| YAML has `name:` | TitleCase | ? | ? |
| YAML has `USE WHEN` | In description | ? | ? |
| Single-line description | Yes | ? | ? |
| Workflow Routing table | Present | ? | ? |
| Examples section | 2+ examples | ? | ? |
| Workflows/ directory | Present | ? | ? |
| Tools/ directory | Present | ? | ? |
| No deep nesting | Max 2 levels | ? | ? |
| Activation rule | In skill-rules.json | ? | ? |

## Step 3: Report Deviations

Present the audit results. For each deviation, explain what needs to change.

## Step 4: Fix (with user approval)

For each deviation, offer to fix it:
1. Rename files/directories to TitleCase
2. Rewrite YAML frontmatter to canonical format
3. Add missing sections (Workflow Routing, Examples)
4. Create missing directories
5. Flatten deep nesting
6. Add/update skill-rules.json entry

## Step 5: Validate

Run `bun scripts/validate-skills.ts` to confirm all checks pass.
