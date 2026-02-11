# Agents

Agent definitions are markdown files that define specialized personas for the Task tool.

## Model Tiers

| Tier | Model | When to Use | Cost |
|------|-------|-------------|------|
| **Opus** | claude-opus-4 | Architecture review, complex reasoning, deep code review | Highest |
| **Sonnet** | claude-sonnet-4 | Default for most tasks, good balance of speed and quality | Medium |
| **Haiku** | claude-haiku-3.5 | Fast tasks, formatting, simple transforms, lint fixes | Lowest |

## Creating an Agent

Create a `.md` file in this directory:

```markdown
# Agent Name

You are a [role]. Your job is to [purpose].

## Instructions

1. [What to do first]
2. [What to do next]
3. [How to report results]

## Model Guidance

Use **Opus** for this agent — it requires [deep reasoning / complex trade-offs].
```

## Using Agents

Agents are invoked via Claude Code's Task tool:

```
"Use the reviewer agent to check the auth module"
```

The agent runs as a subagent with its own context and returns results to the main session.

## Tips

- Keep agent prompts focused — one role, one purpose
- Include model tier guidance so the user can make cost/quality trade-offs
- Agents don't share state — pass all necessary context in the prompt
- Use Opus for tasks where getting it wrong is expensive
- Use Haiku for tasks where speed matters more than depth
