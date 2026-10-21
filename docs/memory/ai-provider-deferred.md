---
name: ai-provider-deferred
description: Talking uses Groq's free tier (openai/gpt-oss-120b since 2026-10-03, was 20b) behind a reply-provider interface, with a stub for tests; a paid model like Claude Haiku comes before real users
metadata:
  type: project
---

Decided with Mert, 2026-10-01 ([product.md, Talking](../application/product.md#talking)).
A local Ollama model was chosen first and dropped the same day: Mert's Mac (M2, 16 GB) has
little free disk and memory to spare beside Docker and the Simulator.

- **The model is `openai/gpt-oss-120b` since 2026-10-03** (Mert, after the memory check
  below); v1 used `openai/gpt-oss-20b`. Groq's free tier (console.groq.com), free with no card,
  very fast. Fallbacks on the same key, by configuration: `qwen/qwen3.8-27b`,
  `openai/gpt-oss-120b`. Free limits per model (2026-10-01): 30 requests a minute, 1,000 a day,
  8K tokens a minute, 200K tokens a day, so about 200 messages a day at ~900 tokens each. No
  uptime guarantee; Groq retired its Llama models in August 2026, so free models can disappear.
- **Measured 2026-10-01** (`npm run talk:check --workspace=@app/web`, 45 labelled phrases):
  98% of intents right, median reply 480 ms, about 1,000 tokens per reply. One run uses about
  45K tokens (a quarter of the free day) and takes about 8 minutes because of the per-minute
  limit; run it after any prompt change.
- **With long-term memory on** (v2, 2026-10-03, `features/v2-memory-plan.md` Phase 0): the
  prompt grows about +55% (about 1,500 tokens in a call). `gpt-oss-20b` keeps the right facts
  and nothing sensitive, but never uses "replace"; `gpt-oss-120b` does, with 100% of intents
  right and an 842 ms median. Both models share a key but have separate free quotas. Use
  `--memory-only` to tune the guide on less quota.
- **The free daily limit is a rolling 24 hours, per model** (seen 2026-10-03: "Used 198268 …
  try again in 57s"), not a midnight reset: tokens used at 22:00 come back at 22:00 the next
  day. One day of model checks (about 125K tokens a full run) plus testing used up 120b's
  200K. The 429's message names the limit (`tokens per day (TPD)` or `tokens per minute`); the
  `x-ratelimit-remaining-tokens` header is the per-minute one. **Groq's paid Developer tier was
  closed to sign-ups** ("temporarily unavailable due to high demand"). So: run the check with
  `--memory-only` while tuning, and use the stub for UI work. **The fallback across models was
  dropped on 2026-10-04:** Mert has more than one Groq account and swaps `GROQ_API_KEY` when a
  model's free day runs out. Separately, 8K tokens a minute means about 7 intro calls (or ~9
  talk calls) in a row before a 429.
- **Strict structured output**: Groq's `response_format` with a JSON schema and `strict: true`
  is guaranteed on gpt-oss-20b/120b and qwen3.8-27b: the reply, an intent from a fixed list,
  an optional suggested care action. The server still validates with Zod and caps the reply's
  length; invalid output gets a written fallback line. **Our code, not the model, turns the
  intent into need changes.** gpt-oss reasons before answering: keep its reasoning effort low.
- **The server calls Groq through a small reply provider interface.** The phone never calls
  Groq: it calls `/api/app/v1`. The API is OpenAI-compatible
  (`https://api.groq.com/openai/v1/chat/completions`).
- **The key**: `GROQ_API_KEY` in `apps/web/.env.local`, declared in the web env schema and
  `.env.example` (`check:env`), server-only, never an `EXPO_PUBLIC_*` variable. Mert sets it;
  an agent never reads, writes or asks for it. The model name is a server env variable too.
- **A stub provider** with canned in-character replies stays for tests and CI (no key there),
  kept out of production paths.
- **Groq unreachable or rate-limited** (429): the pet says it's not connected in its bubble, and
  the message doesn't count against the daily limit.
- **Privacy**: what someone says is sent to Groq for the reply; nothing is stored by us. The
  privacy text has to say so.
- **A paid model before real users** (Claude Haiku 4.5, `claude-haiku-4-5`, about $1 per 1,000
  messages, is the candidate): one more provider file plus its server-only key. Gemini's free
  tier was the backup considered; its free tier uses content to improve Google's products.

**Why:** Mert wants talking working now, free, without running a model on his Mac, and the
freedom to move to a paid model later without rewriting the feature.

**How to apply:** keep provider-specific code in one provider file. Don't add a paid AI SDK
until Mert decides. Decided together with [[ai-usage-stand-in]].
