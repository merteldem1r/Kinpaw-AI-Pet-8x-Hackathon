import type { CssVars } from '@/lib/utils'
import { FAINT_STARS } from './Scene'

/**
 * The page's material under a section: film grain on dusk (paper tooth on
 * daylight), the faint stars of the night after the week (on a dark ground)
 * and, on dusk, one low wash of the accent at the section's head.
 * Place it first in a `relative isolate bg-bg` section; it sits behind the
 * content. The section must paint the ground (`bg-bg`): an isolated section
 * with no background blends the grain against transparency, which lifts the
 * ground instead of texturing it.
 */
export function Ground({ washAt }: { washAt?: 'left' | 'right' }) {
	return (
		<>
			{/* The night after the week goes on over these sections: its faint stars. */}
			<span aria-hidden="true" className="ground-stars absolute inset-0 -z-20">
				{FAINT_STARS.map((star, i) => (
					<span
						key={i}
						className="sky-star sky-star-faint sky-twinkle absolute rounded-full"
						style={
							{
								left: `${star.x}%`,
								top: `${star.y + 20}%`,
								width: star.r * 2,
								height: star.r * 2,
								'--i': i
							} as CssVars
						}
					/>
				))}
			</span>
			<span aria-hidden="true" className="grain -z-10" />
			{washAt && (
				<span
					aria-hidden="true"
					className="section-wash absolute inset-0 -z-20 daylight:hidden"
					style={{ '--wash-x': washAt === 'left' ? '10%' : '88%' } as CssVars}
				/>
			)}
		</>
	)
}
