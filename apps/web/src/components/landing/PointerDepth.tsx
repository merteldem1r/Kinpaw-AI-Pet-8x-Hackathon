'use client'

import { useEffect, useRef } from 'react'

/**
 * Gives the scene it sits in depth under the mouse: `--px` and `--py` on the
 * scene, -1 to 1 from its centre, which globals.css turns into a small shift of
 * each sky layer (the stars least, the life in the sky most). Written on the
 * next frame and only while the scene is on screen, so it costs no render.
 * Mouse only; nothing under Reduce Motion.
 */
export function PointerDepth() {
	const marker = useRef<HTMLSpanElement>(null)

	useEffect(() => {
		const scene = marker.current?.closest<HTMLElement>('.scene')
		if (!scene || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

		let frame = 0
		let pointer = { x: 0, y: 0 }
		const apply = () => {
			frame = 0
			scene.style.setProperty('--px', pointer.x.toFixed(3))
			scene.style.setProperty('--py', pointer.y.toFixed(3))
		}
		const onMove = (e: PointerEvent) => {
			if (e.pointerType !== 'mouse') return
			pointer = {
				x: (e.clientX / window.innerWidth) * 2 - 1,
				y: (e.clientY / window.innerHeight) * 2 - 1
			}
			if (!frame) frame = requestAnimationFrame(apply)
		}

		let isWatching = false
		const io = new IntersectionObserver(([entry]) => {
			const isOnScreen = Boolean(entry?.isIntersecting)
			if (isOnScreen === isWatching) return
			isWatching = isOnScreen
			if (isOnScreen) window.addEventListener('pointermove', onMove, { passive: true })
			else window.removeEventListener('pointermove', onMove)
		})
		io.observe(scene)
		return () => {
			io.disconnect()
			window.removeEventListener('pointermove', onMove)
			cancelAnimationFrame(frame)
		}
	}, [])

	return <span ref={marker} hidden />
}
