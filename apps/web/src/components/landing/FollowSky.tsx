'use client'

import { useEffect } from 'react'
import { phaseAt, schemeForPhase } from '@/lib/sky'

/**
 * Day 1's sky is the visitor's own hour. On a full page load an inline script
 * sets it before the first paint (LOCAL_SKY_SCRIPT); this does the same when
 * the page is reached by a link from another page, where inline scripts do not
 * run. Both write the same attributes, so running after the script is harmless.
 */
export function FollowSky() {
	useEffect(() => {
		const phase = phaseAt(new Date().getHours())
		const scheme = schemeForPhase(phase)
		document.querySelectorAll('[data-follow-sky]').forEach((el) => {
			el.setAttribute('data-sky', phase)
			el.setAttribute('data-scheme', scheme)
		})
		document.querySelectorAll('[data-follow-prev]').forEach((el) => {
			el.setAttribute('data-prev', scheme)
		})
	}, [])
	return null
}
