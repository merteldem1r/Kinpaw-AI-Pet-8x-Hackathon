import { useCallback, useEffect, useState } from 'react'
import type { PetCue } from '@/hooks/usePetBehaviour'

// Where the pet on Home looks next (m5-home-core-loop-requirements.md; v2-voice-requirements.md):
// up at the sky when it is tapped, at you when it has been left alone, and around in quick
// glances while it speaks its reply, as someone talking does. PetStage turns each cue into eye
// movement, and holds still with Reduce Motion.

/** Where the eyes go while the pet speaks, in turn: at you, up at its words, around (-1 to 1). */
const TALKING_LOOKS: readonly (readonly [number, number])[] = [
	[0.3, 0.15],
	[-0.25, 0.1],
	[0.55, -0.35],
	[-0.1, 0.2]
]
const TALKING_LOOK_MS = 600

/** `speaking`: the pet is saying its reply out loud. */
export function usePetGaze(speaking: boolean) {
	const [cue, setCue] = useState<PetCue | null>(null)

	/** Looks at a point (-1 to 1 each way), with a little hop when `hop`. Every call is a new cue. */
	const look = useCallback(
		(lookX: number, lookY: number, hop: boolean) =>
			setCue((current) => ({ lookX, lookY, hop, key: (current?.key ?? 0) + 1 })),
		[]
	)

	useEffect(() => {
		if (!speaking) return
		let step = 0
		const glance = () => {
			const [x, y] = TALKING_LOOKS[step % TALKING_LOOKS.length]!
			step += 1
			look(x, y, false)
		}
		glance()
		const id = setInterval(glance, TALKING_LOOK_MS)
		return () => clearInterval(id)
	}, [speaking, look])

	return { cue, look }
}
