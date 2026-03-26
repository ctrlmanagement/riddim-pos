# Agent: POS Session Close
**Role:** Generates end-of-session briefing for the RIDDIM POS project and sweeps all agents for staleness. Run this at the end of every session.

---

## What This Agent Does

1. **Generate session briefing** — `_briefings/S{N}_{Title}_{Date}.md`
2. **Sweep all agents** — update `.claude/agents/*.md` with new features, completed items, changed architecture
3. **Update security auditor** — if security decisions were made, update `riddimsupperclub/.claude/agents/operations/security-auditor.md`
4. **Commit and push** both repos

---

## How to Run

Provide the agent with:
- Session number (check latest briefing in `_briefings/` for the last one)
- Brief description of what was built this session

The agent will:
1. Run `git log` on both repos to find all commits since last briefing
2. Read the previous briefing for context
3. Generate the new briefing following the format below
4. Read every agent file in `.claude/agents/` and update any that reference features built this session
5. Commit and push

---

## Briefing Format

```markdown
# Session Briefing — S{N}: {Title}
**Date:** {date}
**Project:** RIDDIM POS (`~/ctrl/riddim-pos`) + RIDDIM Platform (`~/ctrl/riddimsupperclub`)
**Branch:** `main`

---

## Session Summary
{2-3 sentences: what started, what ended, what's different}

**Starting state:** {what existed before this session}
**Ending state:** {what exists after}

---

## Commits — riddim-pos
| Commit | Description |
|---|---|

## Commits — riddimsupperclub (if any)
| Commit | Description |
|---|---|

---

## What Was Built
{Detailed subsections per major feature with file paths, schema, API endpoints}

---

## SQL Executed
{Every CREATE TABLE, ALTER TABLE, CREATE POLICY, INSERT from the session}

---

## Architecture Decisions
{Key decisions made this session with reasoning}

---

## What's Next
> **Resume at commit `{hash}` on main.**

### Immediate
### Deferred

---

## Reference Material
```

---

## Agent Sweep Rules

For every agent in `.claude/agents/`:
1. Read the file
2. Check if any build items, backlog entries, or status markers reference features shipped this session
3. If yes: update status to ✅, update descriptions, update file paths or architecture references
4. If the agent references old architecture (e.g., "planned" for something now built): fix it
5. Check that stack/technology descriptions match current reality

**Agents to check:**
- `pos-foh-builder.md` — terminal features, stack, file structure
- `pos-boh-builder.md` — BOH sections, build priority, data flows
- `foh-code-reviewer.md` — review checklist (add new patterns if needed)
- `riddim-design.md` — design system (usually unchanged)

**Cross-repo agents to check (riddimsupperclub):**
- `operations/security-auditor.md` — new permanent constraints, RLS on new tables
- `operations/session-briefing-generator.md` — version numbers if applicable

---

## Common Mistakes

1. Don't skip the agent sweep — agents go stale silently
2. Include ALL SQL executed, not just CREATE TABLE (ALTER, INSERT seeds, CREATE POLICY)
3. List commits from BOTH repos if work spanned both
4. Use absolute commit hashes, not relative refs
5. Update the "What's Next" section — mark completed items, promote next priorities
