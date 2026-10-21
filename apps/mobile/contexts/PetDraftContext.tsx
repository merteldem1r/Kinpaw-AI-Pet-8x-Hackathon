import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import {
	cachedPetDraft,
	clearPetDraft,
	newPetDraft,
	savePetDraft,
	type PetDraft
} from '@/lib/petDraft'

/**
 * The pet draft for the whole app: Welcome reads it to resume, the Create
 * steps write it, and (M4) the save after sign-in sends and clears it. Every
 * change is persisted at once (lib/petDraft.ts); the root layout reads the
 * stored one before first paint, so this starts from it.
 */
type PetDraftContextValue = {
	draft: PetDraft | null
	/** Start a new draft (Welcome → "Meet your pet") unless one exists. */
	start: () => PetDraft
	/** Change part of the draft. A no-op when there is none. */
	update: (patch: Partial<PetDraft>) => void
	clear: () => void
}

/** What changes the draft: the same functions for the app's whole life. */
type PetDraftActions = Omit<PetDraftContextValue, 'draft'>

const PetDraftContext = createContext<PetDraftContextValue | null>(null)
// Apart from the draft, so a screen that only writes it (Welcome's "Meet your pet") isn't
// redrawn by every change: each builder tap changes the draft while Welcome sits underneath.
const PetDraftActionsContext = createContext<PetDraftActions | null>(null)

export function PetDraftProvider({ children }: { children: ReactNode }) {
	const [draft, setDraft] = useState<PetDraft | null>(() => cachedPetDraft())

	const start = useCallback(() => {
		const existing = cachedPetDraft()
		if (existing) return existing
		const fresh = newPetDraft()
		setDraft(fresh)
		void savePetDraft(fresh)
		return fresh
	}, [])

	const update = useCallback((patch: Partial<PetDraft>) => {
		setDraft((current) => {
			if (!current) return current
			const next = { ...current, ...patch }
			void savePetDraft(next)
			return next
		})
	}, [])

	const clear = useCallback(() => {
		setDraft(null)
		void clearPetDraft()
	}, [])

	const actions = useMemo(() => ({ start, update, clear }), [start, update, clear])
	const value = useMemo(() => ({ draft, ...actions }), [draft, actions])
	return (
		<PetDraftActionsContext.Provider value={actions}>
			<PetDraftContext.Provider value={value}>{children}</PetDraftContext.Provider>
		</PetDraftActionsContext.Provider>
	)
}

export function usePetDraft(): PetDraftContextValue {
	const value = useContext(PetDraftContext)
	if (!value) throw new Error('usePetDraft is used outside PetDraftProvider')
	return value
}

/** Only what changes the draft; a screen using this isn't redrawn when the draft changes. */
export function usePetDraftActions(): PetDraftActions {
	const value = useContext(PetDraftActionsContext)
	if (!value) throw new Error('usePetDraftActions is used outside PetDraftProvider')
	return value
}
