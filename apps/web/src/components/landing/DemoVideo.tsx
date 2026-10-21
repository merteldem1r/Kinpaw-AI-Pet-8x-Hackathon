'use client'

import { useRef, useState } from 'react'
import { Play, Volume2 } from 'lucide-react'
import type { Cue } from '@/lib/captures'
import { gaEvent } from '@/lib/analytics/client'
import { WEEK_EVENTS } from '@/lib/analytics/events'
import { DeviceFrame } from '../device/DeviceFrame'

/**
 * The recording of the app, in the phone, with a line under it saying what is
 * happening as it runs. Before it plays, the poster carries one drawn button
 * that says what pressing it does (with sound, and how long); the browser's own
 * controls appear only once it has started. It never starts by itself, and
 * `demo_video_played` counts the first start of a page view.
 */
export function DemoVideo({
	src,
	poster,
	label,
	length,
	cues,
	caption,
	className
}: {
	src: string
	poster: string
	label: string
	/** As said on the button, e.g. "0:30". */
	length: string
	cues: readonly Cue[]
	/** The line under the phone before the recording has been played. */
	caption: string
	className?: string
}) {
	const video = useRef<HTMLVideoElement>(null)
	const hasCounted = useRef(false)
	const [hasStarted, setHasStarted] = useState(false)
	const [line, setLine] = useState(caption)

	const start = () => {
		setHasStarted(true)
		void video.current?.play()
	}
	const onPlay = () => {
		setHasStarted(true)
		if (hasCounted.current) return
		hasCounted.current = true
		gaEvent(WEEK_EVENTS.demoVideoPlayed)
	}
	const onTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
		const now = e.currentTarget.currentTime
		// The cues are in order; the current one is the last that has started.
		const started = cues.filter((cue) => cue.at <= now)
		const current = started[started.length - 1]
		if (current) setLine(current.line)
	}

	return (
		<figure>
			<DeviceFrame
				label={label}
				className={className}
				media={
					<>
						<video
							ref={video}
							src={src}
							poster={poster}
							controls={hasStarted}
							playsInline
							preload="none"
							onPlay={onPlay}
							onTimeUpdate={onTimeUpdate}
							onEnded={() => setLine(caption)}
							className="absolute inset-0 h-full w-full object-cover"
						/>
						{!hasStarted && (
							<button
								type="button"
								onClick={start}
								className="group absolute inset-0 z-20 grid place-items-center bg-[rgb(var(--c-shadow-tint)/0.3)] transition-colors duration-base hover:bg-[rgb(var(--c-shadow-tint)/0.18)]"
							>
								<span className="flex items-center gap-3 rounded-pill bg-brand py-2 pl-2 pr-5 text-on-brand shadow-cta transition-transform duration-fast group-active:scale-[0.96]">
									<span className="grid h-11 w-11 place-items-center rounded-full bg-on-brand text-brand">
										<Play
											aria-hidden="true"
											className="ml-0.5 h-5 w-5"
											fill="currentColor"
											strokeWidth={0}
										/>
									</span>
									<span className="text-left leading-tight">
										<span className="block text-[15px] font-semibold">Play the recording</span>
										<span className="flex items-center gap-1 text-[13px] font-medium opacity-80">
											<Volume2 aria-hidden="true" className="h-3.5 w-3.5" />
											With sound · <span className="t-number">{length}</span>
										</span>
									</span>
								</span>
							</button>
						)}
					</>
				}
			/>
			<figcaption
				aria-live="polite"
				className="mt-4 min-h-[2.6em] max-w-[18rem] text-[15px] leading-snug text-ink-secondary"
			>
				{line}
			</figcaption>
		</figure>
	)
}
