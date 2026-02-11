# Captain Hooks: Fork and Go

You forked Captain Hooks. Here's exactly what to do.

---

## Step 1: Personalize (2 minutes)

### settings.json

Open `settings.json` and change:

```json
{
  "identity": {
    "name": "YOUR_AI_NAME",
    "displayName": "YOUR_AI_NAME"
  },
  "principal": {
    "name": "YOUR_NAME"
  }
}
```

### CLAUDE.md

Open `CLAUDE.md` and fill in the sections marked with `<!-- REPLACE -->`:
- Your name and AI name
- Stack preferences
- Conventions
- Important paths

### security/patterns.yaml

Review the default security patterns. Add project-specific paths to protect:

```yaml
paths:
  zeroAccess:
    - "~/.ssh"
    - "~/.aws/credentials"
    # ADD: your sensitive paths
  confirmWrite:
    - "settings.json"
    # ADD: files that need write confirmation
```

---

## Step 2: Delete the Example (30 seconds)

The `_ExampleNotes` skill is scaffolding. Delete it:

```bash
rm -rf skills/_ExampleNotes
```

Remove its rule from `skills/skill-rules.json` (the entry with `"skill": "_ExampleNotes"`).

---

## Step 3: Create Your First Skill (5 minutes)

**Option A** — use the meta-skill:
```
"Create a skill for managing Docker containers"
```

**Option B** — manual:

1. **Create directory**:
   ```bash
   mkdir -p skills/DockerManager/Workflows skills/DockerManager/Tools
   ```

2. **Create SKILL.md**:
   ```markdown
   ---
   name: DockerManager
   description: Manage Docker containers and images. USE WHEN docker, container, image, compose, or deployment tasks.
   ---

   # DockerManager

   ## Workflow Routing

   | Workflow | Trigger | File |
   |----------|---------|------|
   | **Build** | "build container", "docker build" | `Workflows/Build.md` |

   ## Examples

   **Example 1: Build and run**
   ```
   User: "Build the API container and run it"
   -> Invokes Build workflow
   -> Runs docker build + docker run
   ```
   ```

3. **Add activation rule** to `skills/skill-rules.json`:
   ```json
   {
     "skill": "DockerManager",
     "type": "proactive",
     "enforcement": "suggest",
     "priority": 5,
     "triggers": {
       "keywords": ["docker", "container", "compose", "image"],
       "intents": ["deploy"]
     },
     "suggestion": "Use DockerManager for container operations"
   }
   ```

4. **Validate**: `bun scripts/validate-skills.ts`

---

## Step 4: Add Hooks (Optional)

### PostToolUse Hook (Auto-format after Write)

Create `hooks/auto-format.hook.ts`:

```typescript
#!/usr/bin/env bun
import { readStdin } from './lib/stdin.ts';

interface Input {
  tool_name: string;
  tool_input: { file_path?: string };
  session_id: string;
}

async function main() {
  const input = await readStdin<Input>(100);
  if (!input?.tool_input?.file_path) process.exit(0);

  const path = input.tool_input.file_path;
  if (path.match(/\.(ts|tsx|js|jsx)$/)) {
    console.log(`<system-reminder>File written. Consider running prettier on ${path}</system-reminder>`);
  }

  process.exit(0);
}

main().catch(() => process.exit(0));
```

Wire it in `settings.json` under PostToolUse:

```json
{
  "matcher": "Write",
  "hooks": [
    { "type": "command", "command": "bun ${CLAUDE_PROJECT_DIR}/hooks/auto-format.hook.ts" }
  ]
}
```

---

## Step 5: Add Agents (Optional)

Create `agents/reviewer.md`:

```markdown
# Code Reviewer Agent

You are a senior code reviewer. Review the provided code for:
1. Correctness — does the logic work?
2. Security — any vulnerabilities?
3. Performance — any bottlenecks?
4. Maintainability — is it readable?

**Model guidance**: Use Opus for thorough reviews, Haiku for quick lint checks.
```

Invoke via Task tool in Claude Code.

---

## Quick Reference

| What | Where | How to Customize |
|------|-------|-----------------|
| Identity | `settings.json` | Change `identity` and `principal` |
| Context | `CLAUDE.md` | Fill in `<!-- REPLACE -->` sections |
| Skills | `skills/` | Add directory + SKILL.md + skill-rules.json entry |
| Hooks | `hooks/` | Create .hook.ts + wire in settings.json |
| Security | `security/patterns.yaml` | Add patterns for your environment |
| Agents | `agents/` | Add .md files with agent prompts |
| Memory | `memory/` | Gitignored, auto-populated by hooks |
| Validation | `scripts/validate-skills.ts` | Run after changes |

## What NOT to Change

These are framework infrastructure — modify at your own risk:

- `hooks/lib/*` — shared utilities (extend, don't modify)
- `hooks/skill-eval.hook.ts` — skill activation engine
- `hooks/security-validator.hook.ts` — security validation
- `skills/CreateSkill/` — meta-skill (extend, don't delete)
- `skills/skill-rules.schema.json` — validation schema
- `scripts/validate-skills.ts` — validation script

## Common Patterns

### Skill that auto-injects context

Set `"enforcement": "inject"` in skill-rules.json. The skill's SKILL.md will be auto-loaded into context when triggers match, without any user action.

### Guard that prevents bad patterns

Set `"type": "guard"` in skill-rules.json and create a PreToolUse hook that checks for the pattern and returns `exit(2)` to block.

### Reactive hook chain (format -> test -> typecheck)

Wire multiple PostToolUse hooks on the same matcher:

```json
{
  "matcher": "Write|Edit",
  "hooks": [
    { "type": "command", "command": "bun ${CLAUDE_PROJECT_DIR}/hooks/auto-format.hook.ts" },
    { "type": "command", "command": "bun ${CLAUDE_PROJECT_DIR}/hooks/auto-test.hook.ts" },
    { "type": "command", "command": "bun ${CLAUDE_PROJECT_DIR}/hooks/auto-typecheck.hook.ts" }
  ]
}
```

They run in order. Each can inject guidance for the next action.
