'use client'

import { useEffect, useState, type RefObject } from 'react'

/** True from the first time `share` of the element is on screen; never false again. */
export function useInViewOnce(ref: RefObject<HTMLElement | null>, share = 0.4): boolean {
	const [isInView, setIsInView] = useState(false)
	useEffect(() => {
		const el = ref.current
		if (!el) return
		const io = new IntersectionObserver(
			([entry]) => {
				if (!entry?.isIntersecting) return
				setIsInView(true)
				io.disconnect()
			},
			{ threshold: share }
		)
		io.observe(el)
		return () => io.disconnect()
	}, [ref, share])
	return isInView
}

/** Whether the visitor asked for reduced motion; read at the moment of asking. */
export function prefersReducedMotion(): boolean {
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
