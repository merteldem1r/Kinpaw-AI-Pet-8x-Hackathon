---
name: ai-usage-stand-in
description: The ai_usage table is a stand-in until template-web's AI usage rule is available
metadata:
  type: project
---

AGENTS.md says a play that adds an AI call "adopts template-web's AI usage rule and module
whole". That rule is not in this repo, and the template-web repository isn't readable from
here. Mert asked the organizers for access (2026-10-01).

Until then, talking (roadmap M6) uses a **minimal `ai_usage` stand-in**: one row per model
call (user, model, input and output tokens, time taken, outcome, and the intent label), written
by the server. It never holds what was said or the reply (2026-10-01). It is a usage log only: the
daily talk limit and the caps are counted from their own `pet_talks` table (decided by Mert
2026-10-01), so replacing this stand-in never touches the game. It gets the usual security migration (RLS on, no grants).

**Why:** tracking usage per call matters from the first call (Groq's free tier costs nothing, a paid model will), but the proper module isn't
available yet.

**How to apply:** treat the stand-in as temporary. When the rule arrives, replace it with
template-web's module and update this note. Decided together with [[ai-provider-deferred]].
