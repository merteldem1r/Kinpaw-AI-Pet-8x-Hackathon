import { createGroqProvider, DEFAULT_GROQ_MODEL } from './groq'
import type { ReplyProvider } from './reply-provider'
import { createStubProvider } from './stub'

// Which provider answers (docs/application/features/m6-talk-requirements.md, R2): Groq when its
// key is set; the stub in development and tests without one; nothing in production without one,
// so the talk route answers `not_configured` instead of a pretend pet. GROQ_API_KEY is
// server-only and set by Mert in apps/web/.env.local; GROQ_MODEL picks the model.

export function talkProvider(): ReplyProvider | null {
	const apiKey = process.env.GROQ_API_KEY?.trim()
	if (apiKey) {
		return createGroqProvider({
			apiKey,
			model: process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL
		})
	}
	return process.env.NODE_ENV === 'production' ? null : createStubProvider()
}
