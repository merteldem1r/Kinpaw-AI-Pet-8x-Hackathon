import { lookById, type Mood } from '@app/contract'
import { EveningSky } from '../../pet/EveningSky'
import { PetSvg } from '../../pet/PetSvg'
import { CareTile, NeedPill, PetBubble, TalkRow, WordsChip, type CareAction } from '../care'
import {
	Eyebrow,
	GUTTER,
	HomeIndicator,
	INSET_BOTTOM,
	INSET_TOP,
	StatusBar,
	TabBar,
	type
} from '../parts'

/*
 * My pet as one screen (apps/mobile/components/home/HomeRoom.tsx; spec "Home"), at 393 × 852
 * pt: the narrator's line, the pet under the evening sky with its bubble, the four need pills
 * at its sides (hunger and energy left, happiness and affection right), the mic under it, and
 * the care tiles above the tab bar. Home and the talking screen both draw this, with what
 * differs passed in.
 */
const PET = lookById('ginger')
const SKY_HEIGHT = 470
const PET_SIZE = 230
const PET_TOP = 236
const TAB_BAR_TOP = INSET_BOTTOM + 4 + 64

export type RoomNeeds = { hunger: number; happiness: number; energy: number; affection: number }

export function HomeRoom({
	header,
	bubble,
	needs,
	mood = 'content',
	wanted,
	words,
	listening = false
}: {
	header: string
	bubble: string
	needs: RoomNeeds
	mood?: Mood
	/** The care tile that glows, and its badge ("Missed you"). */
	wanted?: { action: CareAction; badge: string }
	/** What you said, in the chip above the mic. */
	words?: string
	listening?: boolean
}) {
	return (
		<div className="absolute inset-0 overflow-hidden bg-bg text-ink">
			<EveningSky height={SKY_HEIGHT} />
			<StatusBar />

			<div
				className="absolute inset-x-0 flex flex-col gap-[10px]"
				style={{ top: INSET_TOP + 14, padding: `0 ${GUTTER}px` }}
			>
				<Eyebrow>Wednesday evening</Eyebrow>
				<p style={type('title')}>{header}</p>
			</div>

			<PetBubble line={bubble} className="absolute right-[20px] top-[150px]" />
			<PetSvg
				appearance={PET.appearance}
				mood={mood}
				className="absolute"
				style={{
					left: (393 - PET_SIZE) / 2,
					top: PET_TOP,
					width: PET_SIZE,
					height: PET_SIZE
				}}
			/>

			<div className="absolute flex flex-col gap-[10px]" style={{ left: GUTTER, top: 380 }}>
				<NeedPill need="hunger" value={needs.hunger} />
				<NeedPill need="energy" value={needs.energy} />
			</div>
			<div
				className="absolute flex flex-col items-end gap-[10px]"
				style={{ right: GUTTER, top: 380 }}
			>
				<NeedPill need="happiness" value={needs.happiness} />
				<NeedPill need="affection" value={needs.affection} />
			</div>

			<div
				className="absolute inset-x-0 flex flex-col items-center gap-[10px]"
				style={{ top: PET_TOP + PET_SIZE + (words ? -26 : 12) }}
			>
				{words && <WordsChip words={words} />}
				<TalkRow listening={listening} />
			</div>

			<div
				className="absolute flex gap-[12px]"
				style={{ left: GUTTER, right: GUTTER, bottom: TAB_BAR_TOP + 16 }}
			>
				{(['feed', 'play', 'pet'] as const).map((action) => (
					<CareTile
						key={action}
						action={action}
						badge={wanted?.action === action ? wanted.badge : undefined}
					/>
				))}
			</div>

			<TabBar active={0} />
			<HomeIndicator />
		</div>
	)
}
