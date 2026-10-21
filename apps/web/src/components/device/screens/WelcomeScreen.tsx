import { brandConfig } from '@app/brand'
import { lookById } from '@app/contract'
import { EveningSky } from '../../pet/EveningSky'
import { PetSvg } from '../../pet/PetSvg'
import {
	AppButton,
	AppMark,
	GUTTER_WIDE,
	HomeIndicator,
	INSET_BOTTOM,
	INSET_TOP,
	StatusBar,
	type
} from '../parts'

/*
 * The app's Welcome (apps/mobile/app/index.tsx; spec "Welcome"), in the
 * evening: the sky, three pets waiting together, one promise, one way forward.
 * The copy is the app's; change them together.
 */
const HEADLINE = "A little friend who's always glad you're here."
const LEAD = "Feed them, play, talk a little. They'll be right here when you come back."

const SKY_HEIGHT = 440

/** Tuxedo, Ginger (happy, in front) and Biscuit, as the spec seats them. */
const PETS = [
	{ look: lookById('tuxedo'), mood: 'content', size: 130, x: 18, bottom: 6 },
	{ look: lookById('biscuit'), mood: 'content', size: 130, x: 245, bottom: 6 },
	{ look: lookById('ginger'), mood: 'happy', size: 184, x: 104, bottom: 0 }
] as const

/** The app's Welcome, at 393 × 852 pt. */
export function WelcomeScreen() {
	return (
		<div className="absolute inset-0 overflow-hidden bg-bg text-ink">
			<EveningSky height={SKY_HEIGHT} />
			<StatusBar />

			<div
				className="absolute flex items-center gap-[12px]"
				style={{ top: INSET_TOP + 10, left: GUTTER_WIDE }}
			>
				<AppMark size={32} />
				<span style={type('h3')}>{brandConfig.appName}</span>
			</div>

			<div className="absolute inset-x-0" style={{ top: 214, height: 200 }}>
				{PETS.map(({ look, mood, size, x, bottom }) => (
					<PetSvg
						key={look.id}
						appearance={look.appearance}
						mood={mood}
						shadow={false}
						className="absolute"
						style={{ left: x, bottom, width: size, height: size }}
					/>
				))}
			</div>

			<div
				className="absolute inset-x-0 flex flex-col"
				style={{ top: 426, bottom: INSET_BOTTOM + 8, padding: `0 ${GUTTER_WIDE}px` }}
			>
				<p
					className="text-balance"
					style={{ ...type('display'), fontSize: 36, lineHeight: '40px' }}
				>
					{HEADLINE}
				</p>
				<p className="mt-[14px] text-ink-secondary" style={type('lead')}>
					{LEAD}
				</p>
				<div className="mt-auto flex flex-col gap-[6px]">
					<AppButton withArrow>Meet your pet</AppButton>
					<AppButton variant="ghost" size="md">
						I already have an account
					</AppButton>
				</div>
			</div>
			<HomeIndicator />
		</div>
	)
}
