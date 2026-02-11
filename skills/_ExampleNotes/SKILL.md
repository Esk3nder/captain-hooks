---
name: _ExampleNotes
description: Quick note capture and retrieval. USE WHEN taking notes, capturing ideas, jotting things down, OR remembering something for later. EXAMPLE SKILL — delete and replace.
---

# _ExampleNotes

A simple note-taking skill that demonstrates the Captain Hooks skill pattern. This is a working example — use it as a template, then delete it and build your own.

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Capture** | "take a note", "jot this down", "remember this" | `Workflows/Capture.md` |

## Examples

**Example 1: Quick capture**
```
User: "Take a note: the API key expires on March 15"
-> Invokes Capture workflow
-> Appends timestamped note to memory/notes.md
-> Confirms: "Note captured: API key expires on March 15"
```

**Example 2: Contextual note**
```
User: "Remember that we decided to use PostgreSQL instead of MySQL"
-> Invokes Capture workflow
-> Captures decision with context
-> Confirms: "Decision noted: PostgreSQL over MySQL"
```

## Architecture Notes

**This skill demonstrates:**
1. YAML frontmatter with USE WHEN
2. Workflow routing table
3. Examples section
4. Workflows/ directory with execution procedure
5. Tools/ directory (empty but present)
6. Corresponding rule in skill-rules.json
