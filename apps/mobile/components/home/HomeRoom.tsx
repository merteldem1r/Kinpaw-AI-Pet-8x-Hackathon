import { useState, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { Hand, Soup, Volleyball, type LucideIcon } from 'lucide-react-native'
import {
	canHelp,
	moodFor,
	wantedAction,
	type Mood,
	type Need,
	type Needs,
	type Pet,
	type PetAction
} from '@app/contract'
import {
	homeLayout,
	GLOW_SIZE,
	PET_HEADROOM,
	pillsBottom,
	roomHeight,
	useStageSize
} from '@/components/home/layout'
import { CareButton, type CareState } from '@/components/pet/CareButton'
import { CareEffects } from '@/components/pet/CareEffects'
import { NeedPill } from '@/components/pet/NeedPill'
import { PetBubble, type BubbleAction, type BubbleChoice } from '@/components/pet/PetBubble'
import type { BubbleVoice } from '@/components/voice/VoiceRing'
import {
	PET_RENDERERS,
	PetStage,
	type PetCue,
	type PetRenderer,
	type StrokeZone,
	type Zone
} from '@/components/pet/PetStage'
import { ReactionBursts } from '@/components/pet/ReactionBursts'
import { RoomGlow } from '@/components/pet/RoomGlow'
import { Text } from '@/components/ui/Text'
import { TextLink } from '@/components/ui/TextLink'
import type { Burst, CareEffect } from '@/lib/petEffects'
import { headerLine } from '@/lib/petLines'
import { hasSkia } from '@/lib/skia'

/** DEV ONLY: what the switch on Home calls each way of drawing the pet. */
export const RENDERER_LABEL: Record<PetRenderer, string> = {
	svg: 'SVG',
	skia: 'Skia flat',
	puppet: 'Puppet'
}

export const CARE_ACTIONS = [
	{ action: 'feed', label: 'Feed', icon: Soup },
	{ action: 'play', label: 'Play', icon: Volleyball },
	{ action: 'pet', label: 'Pet', icon: Hand }
] as const satisfies readonly { action: PetAction; label: string; icon: LucideIcon }[]

/**
 * The pet's room on Home, ready (the spec, "Home"): the narrator's line, the pet under its bubble
 * with what floats up from it and its four need pills at its sides, the talk controls under it,
 * and the care row of Feed, Play and Pet at the bottom. The pet is sized to the room the screen
 * leaves, so Home never scrolls.
 * Presentational: Home decides every line, face and outcome.
 */
export function HomeRoom({
	pet,
	needs,
	line,
	bubbleContent,
	bubbleAction,
	bubbleChoice,
	bubbleVoice,
	bursts,
	careEffects,
	moment,
	cue,
	active,
	listening,
	speaking,
	night,
	talk,
	suggested,
	onTapPet,
	onStrokePet,
	onHugPet,
	onStrokingChange,
	onYawn,
	onCare,
	onNeedPress
}: {
	pet: Pet
	needs: Needs
	line: string
	/** In place of the line (the thinking paws). */
	bubbleContent?: ReactNode
	/** A row under the line ("Try again"). */
	bubbleAction?: BubbleAction
	/** A question with two answers under the line (the notes ask), in place of the action. */
	bubbleChoice?: BubbleChoice
	/** The reply's voice on the bubble's edge: on its way, or playing. */
	bubbleVoice?: BubbleVoice | null
	bursts: readonly Burst[]
	/** What the last care action changed, shown beside the pet on each need's side. */
	careEffects: readonly CareEffect[]
	/** A face for a moment, whatever the needs say: happy after care, sad after harsh words. */
	moment: Mood | null
	cue: PetCue | null
	/** Home is the screen shown: the pet moves only then. */
	active: boolean
	/** The mic is held: the pet tilts its head to listen. */
	listening: boolean
	/** The pet is saying its reply out loud. */
	speaking: boolean
	/** Evening or night: the lamp is on behind the pet. */
	night: boolean
	/** Where you talk to the pet, under it and above the care row. */
	talk: ReactNode
	/** The care action the pet's last reply suggested; its tile glows when it can help. */
	suggested: PetAction | null
	onTapPet: (mood: Mood, zone: Zone) => void
	onStrokePet: (mood: Mood, zone: StrokeZone) => void
	onHugPet: (mood: Mood) => void
	onStrokingChange: (stroking: boolean) => void
	onYawn: () => void
	onCare: (action: PetAction) => void
	/** A need pill tapped: Home opens the sheet that explains it. */
	onNeedPress: (need: Need) => void
}) {
	const mood = moment ?? moodFor(needs)
	// The pet looks toward what it asked for, else toward what its lowest need wants.
	const wants = suggested && canHelp(needs, suggested) ? suggested : wantedAction(needs)
	const { petSize, onLayout } = useStageSize()
	const [renderer, setRenderer] = useState<PetRenderer>('svg')
	return (
		<>
			<Text variant="title" accessibilityRole="header">
				{headerLine(needs, pet.name)}
			</Text>
			<View style={homeLayout.stage} onLayout={onLayout}>
				{/* DEV ONLY until Mert picks (v3-pet-looks-requirements.md, R21): how the pet is drawn,
				    and the screen that shows it without an account (app/dev-pet.tsx). */}
				{__DEV__ && hasSkia() ? (
					<View style={s.dev}>
						<TextLink
							label={`Dev: ${RENDERER_LABEL[renderer]} pet`}
							tone="tertiary"
							onPress={() =>
								setRenderer(
									(now) => PET_RENDERERS[(PET_RENDERERS.indexOf(now) + 1) % PET_RENDERERS.length]!
								)
							}
						/>
						<TextLink
							label="Dev: pet screen"
							tone="tertiary"
							onPress={() => router.push('/dev-pet')}
						/>
					</View>
				) : null}
				{petSize ? (
					<View style={[homeLayout.room, { height: roomHeight(petSize) }]}>
						{night ? (
							<View style={[s.glow, { bottom: petSize / 2 - GLOW_SIZE / 2 }]} pointerEvents="none">
								<RoomGlow size={GLOW_SIZE} />
							</View>
						) : null}
						<PetBubble
							line={line}
							action={bubbleAction}
							choice={bubbleChoice}
							voice={bubbleVoice}
							name={pet.name}
							style={[s.bubble, { bottom: petSize - PET_HEADROOM }]}
						>
							{bubbleContent}
						</PetBubble>
						<PetStage
							appearance={pet.appearance}
							mood={mood}
							name={pet.name}
							line={line}
							wants={wants}
							cue={cue}
							active={active}
							listening={listening}
							speaking={speaking}
							size={petSize}
							renderer={renderer}
							onPress={(zone) => onTapPet(mood, zone)}
							onStroke={(zone) => onStrokePet(mood, zone)}
							onHug={() => onHugPet(mood)}
							onStrokingChange={onStrokingChange}
							onYawn={onYawn}
							beaming={moment === 'happy'}
						/>
						<ReactionBursts bursts={bursts} size={petSize} />
						<CareEffects effects={careEffects} size={petSize} />
						{/* Over the pet's sides: a pill opens its need's sheet; between them, touches reach the pet. */}
						<View
							pointerEvents="box-none"
							style={[homeLayout.pills, homeLayout.pillsLeft, { bottom: pillsBottom(petSize) }]}
						>
							<NeedPill need="hunger" value={needs.hunger} onPress={() => onNeedPress('hunger')} />
							<NeedPill need="energy" value={needs.energy} onPress={() => onNeedPress('energy')} />
						</View>
						<View
							pointerEvents="box-none"
							style={[homeLayout.pills, homeLayout.pillsRight, { bottom: pillsBottom(petSize) }]}
						>
							<NeedPill
								need="happiness"
								value={needs.happiness}
								onPress={() => onNeedPress('happiness')}
							/>
							<NeedPill
								need="affection"
								value={needs.affection}
								onPress={() => onNeedPress('affection')}
							/>
						</View>
					</View>
				) : null}
			</View>
			{talk}
			<View style={homeLayout.row}>
				{CARE_ACTIONS.map(({ action, label, icon }) => {
					const state = careState(needs, action, suggested)
					return (
						<CareButton
							key={action}
							action={action}
							label={label}
							icon={icon}
							state={state}
							badge={careBadge(state, action)}
							hint={careHint(state, action, pet.name)}
							onPress={() => onCare(action)}
						/>
					)
				})}
			</View>
		</>
	)
}

/** Wanted: the lowest need is low and this helps it, or the pet's last reply suggested it. */
function careState(needs: Needs, action: PetAction, suggested: PetAction | null): CareState {
	if (!canHelp(needs, action)) return 'cantHelp'
	return wantedAction(needs) === action || suggested === action ? 'wanted' : 'normal'
}

const WANTED_HINT: Record<PetAction, (name: string) => string> = {
	feed: (name) => `${name} is hungry`,
	play: (name) => `${name} is bored`,
	pet: (name) => `${name} missed you`
}

/** The word on top of a wanted or can't-help tile. */
const WANTED_BADGE: Record<PetAction, string> = { feed: 'Hungry', play: 'Bored', pet: 'Missed you' }

function careBadge(state: CareState, action: PetAction): string | undefined {
	if (state === 'wanted') return WANTED_BADGE[action]
	if (state === 'cantHelp') return action === 'feed' ? 'Full' : 'Sleepy'
	return undefined
}

function careHint(state: CareState, action: PetAction, name: string): string | undefined {
	if (state === 'wanted') return WANTED_HINT[action](name)
	if (state === 'cantHelp') return action === 'feed' ? `${name} is full` : `${name} is too sleepy`
	return undefined
}

const s = StyleSheet.create({
	bubble: { position: 'absolute', right: 0, maxWidth: '64%', zIndex: 1 },
	glow: { position: 'absolute', alignSelf: 'center' },
	dev: { position: 'absolute', top: 0, left: 0, zIndex: 2, gap: 4 }
})
