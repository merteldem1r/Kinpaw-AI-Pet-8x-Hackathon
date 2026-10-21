import { art, palette, type Scheme, type SkyPhase } from '@app/brand'

/*
 * The landing page's skies (the week: one sky per day, each at its own hour).
 * The colours are the app's (`art.sky` in @app/brand, drawn by SkyBand on the
 * phone); this module only turns them into CSS, so no colour is typed here.
 *
 * A scene carries `data-sky` (its hour) and `data-scheme` (light by day, dark
 * from the evening on, as the app). SKY_CSS gives each hour its gradient and
 * its sun or moon as custom properties; globals.css paints with them.
 */

export type { SkyPhase }

/** The hour's phase, as the app's `phaseAt` (apps/mobile/lib/sky.ts). */
export function phaseAt(hour: number): SkyPhase {
	if (hour >= 5 && hour < 12) return 'morning'
	if (hour >= 12 && hour < 17) return 'afternoon'
	if (hour >= 17 && hour < 21) return 'evening'
	return 'night'
}

/** Light by day, dark from the evening on, as the app's `schemeForPhase`. */
export function schemeForPhase(phase: SkyPhase): Scheme {
	return phase === 'morning' || phase === 'afternoon' ? 'light' : 'dark'
}

/**
 * Where the art's four stops sit. The first 12% is the ground the day before
 * ended on, turning into this sky: dawn after a night, dusk after a day.
 */
const STOPS_AT = [12, 34, 54, 76] as const

/**
 * How much of each of the four sky colours shows over the scene's ground. The
 * evening's first two are softened, because headings sit on them in light ink;
 * its glow at the horizon, where the pet stands, is the app's own colour.
 */
const STRENGTH: Record<SkyPhase, readonly [number, number, number, number]> = {
	morning: [100, 100, 100, 100],
	afternoon: [100, 100, 100, 100],
	evening: [72, 78, 100, 100],
	night: [100, 100, 100, 100]
}

/** Where the sun or moon hangs, in % of the scene. */
const BODY_AT: Record<SkyPhase, { x: number; y: number }> = {
	morning: { x: 16, y: 44 },
	afternoon: { x: 82, y: 15 },
	evening: { x: 20, y: 39 },
	night: { x: 84, y: 16 }
}

const SKY_PHASES: readonly SkyPhase[] = ['morning', 'afternoon', 'evening', 'night']
const SCHEMES: readonly Scheme[] = ['dark', 'light']

/**
 * Where a day meets a night, the turn between them: the evening's colours from
 * a light ground down into a dark sky (dusk), and up through them to the
 * morning's peach from a dark ground into a light one (dawn). In px from the
 * scene's top, so the band is as tall on a phone as on a desktop and is over
 * before the first heading.
 */
const TURN: Record<Scheme, readonly string[]> = {
	// From a light ground: the turn into a dark sky.
	light: [art.sky.evening.stops[2], art.sky.evening.stops[1], art.sky.evening.stops[0]],
	// From a dark ground: the turn into a light sky.
	dark: [art.sky.evening.stops[0], art.sky.evening.stops[1], art.sky.morning.stops[2]]
}
const TURN_AT_PX = [36, 88, 140] as const
/** The sky's own first colour, after a turn: never before this, so the band has room. */
const AFTER_TURN = 'max(12%, 200px)'

function phaseRule(phase: SkyPhase): string {
	const sky = art.sky[phase]
	const colours = sky.stops.map((stop, i) => {
		const strength = STRENGTH[phase][i]!
		return strength === 100 ? stop : `color-mix(in srgb, ${stop} ${strength}%, rgb(var(--c-bg)))`
	})
	const stops = colours.map((colour, i) => `${colour} ${STOPS_AT[i]}%`)
	const end = 'rgb(var(--c-bg)) 100%'
	// With no scene above it (day 1), the sky simply starts on its own first colour.
	const gradient = `linear-gradient(180deg, var(--prev-ground, ${colours[0]}) 0%, ${stops.join(', ')}, ${end})`
	const at = BODY_AT[phase]
	const base = `[data-sky="${phase}"]{--sky:${gradient};--sky-body:${sky.body};--sky-body-x:${at.x}%;--sky-body-y:${at.y}%}`

	// Opening on the other scheme's ground, the sky turns through a dusk or a dawn first.
	const from: Scheme = schemeForPhase(phase) === 'light' ? 'dark' : 'light'
	const turn = TURN[from].map((colour, i) => `${colour} ${TURN_AT_PX[i]}px`)
	const turned = `linear-gradient(180deg, var(--prev-ground) 0%, ${turn.join(', ')}, ${colours[0]} ${AFTER_TURN}, ${stops.slice(1).join(', ')}, ${end})`
	return `${base}[data-sky="${phase}"][data-prev="${from}"]{--sky:${turned}}`
}

/**
 * The page's sky rules, for a `<style>` tag: one per hour, and the ground each
 * scheme ends on, so a scene can open on the colour the scene above closed on
 * (`data-prev`, the scheme of the scene before it).
 */
export const SKY_CSS = [
	...SKY_PHASES.map(phaseRule),
	...SCHEMES.map((scheme) => `[data-prev="${scheme}"]{--prev-ground:${palette(scheme).bg}}`),
	`.sky-star{background:${art.star}}`,
	`.sky-shooting{background:linear-gradient(90deg, transparent, ${art.star})}`,
	`.sky-cloud{color:${art.cloud}}`,
	// A day that passes in a line, after a daytime scene: the afternoon falls to dusk.
	`.day-pass[data-prev="light"]{background:linear-gradient(180deg, ${palette('light').bg} 0%, ${art.sky.afternoon.bridge} 20%, rgb(var(--c-bg)) 48%)}`
].join('')

/**
 * Day 1 is the visitor's own hour, which the server cannot know. This runs
 * inline, straight after the scene's markup and before the first paint: it
 * gives every `[data-follow-sky]` element the local hour's sky and scheme, and
 * every `[data-follow-prev]` element the ground that scene ends on. Without
 * JavaScript the page keeps the evening it was rendered with.
 */
export const LOCAL_SKY_SCRIPT = `(function(){try{var h=new Date().getHours();var p=h>=5&&h<12?'morning':h>=12&&h<17?'afternoon':h>=17&&h<21?'evening':'night';var s=p==='morning'||p==='afternoon'?'light':'dark';document.querySelectorAll('[data-follow-sky]').forEach(function(e){e.setAttribute('data-sky',p);e.setAttribute('data-scheme',s)});document.querySelectorAll('[data-follow-prev]').forEach(function(e){e.setAttribute('data-prev',s)})}catch(e){}})()`
