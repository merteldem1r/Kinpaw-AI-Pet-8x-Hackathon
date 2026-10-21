/**
 * Moving between the Create steps. Forward pushes the next step; Back pops when
 * there is a screen to pop to, and otherwise replaces with the step before (a
 * relaunch resumes straight onto a step, with nothing under it).
 */
import { router, type Href } from 'expo-router'
import type { DraftStep } from '@/lib/petDraft'

const ROUTE: Record<DraftStep, Href> = {
	start: '/start',
	build: '/build',
	name: '/name',
	personality: '/personality',
	meet: '/meet'
}

export function createStepRoute(step: DraftStep): Href {
	return ROUTE[step]
}

export function goToStep(step: DraftStep) {
	router.push(ROUTE[step])
}

/** Back to `previous`, or to Welcome when `previous` is null. */
export function goBackTo(previous: DraftStep | null) {
	if (router.canGoBack()) router.back()
	else router.replace(previous ? ROUTE[previous] : '/')
}
