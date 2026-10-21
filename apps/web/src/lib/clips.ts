/*
 * The landing page's sound: one clip at a time, and only ever from a tap.
 * Starting a clip stops the one before it, so two pets never talk at once.
 */

let current: { audio: HTMLAudioElement; done: () => void } | null = null

/** Stop whatever is playing. */
export function stopClip() {
	if (!current) return
	const { audio, done } = current
	current = null
	audio.pause()
	done()
}

/**
 * Play a clip from `public/`. `onDone` runs once, when it ends, fails to load
 * or is stopped by the next clip, so a caller can always put its button back.
 */
export function playClip(src: string, onDone: () => void) {
	stopClip()
	const audio = new Audio(src)
	let finished = false
	const done = () => {
		if (finished) return
		finished = true
		if (current?.audio === audio) current = null
		onDone()
	}
	current = { audio, done }
	audio.addEventListener('ended', done)
	audio.addEventListener('error', done)
	// A refused play (no file yet, or the browser wants another tap) ends quietly.
	audio.play().catch(done)
}
