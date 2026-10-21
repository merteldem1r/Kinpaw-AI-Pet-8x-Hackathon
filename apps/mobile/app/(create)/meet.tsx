/**
 * Meet — the pet appears and says its first line; the only way forward is
 * taking it home (docs/application/UI/kinpaw-screen-spec-v1.md, "Meet Mochi").
 * "Take {name} home" opens Save (sign-in), which saves the pet; signed in already (someone
 * without a pet yet), it saves straight away and the root layout moves to My pet.
 *
 * As the pet lands, it says its first line out loud in its voice (v2 voice), from a clip shipped
 * in the app: no request, no account needed yet.
 *
 * The pet is alive here as on Home (v3-pet-looks-requirements.md, R11): it breathes, blinks,
 * moves its tail and ears, its mouth moves while it says its line, and it answers a touch with
 * its body. The bubble keeps the first line: no touch lines, nothing floats up.
 */
import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, View, useWindowDimensions } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft, Volume2 } from 'lucide-react-native'
import { appearanceKey, hasCustomTraits, presetById, type PresetId } from '@app/contract'
import { useMountEffect } from '@/hooks/useMountEffect'
import { FadeSlideIn } from '@/components/motion/FadeSlideIn'
import { PetBubble } from '@/components/pet/PetBubble'
import { PetStage, type StrokeZone, type Zone } from '@/components/pet/PetStage'
import { RiseAndBreathe } from '@/components/pet/RiseAndBreathe'
import { Button } from '@/components/ui/Button'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { IconButton } from '@/components/ui/IconButton'
import { Glow } from '@/components/ui/Marks'
import { Text } from '@/components/ui/Text'
import { usePetDraft } from '@/contexts/PetDraftContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useSavePet } from '@/hooks/usePet'
import { usePetReactions } from '@/hooks/usePetReactions'
import { track } from '@/lib/analytics'
import { goBackTo } from '@/lib/createFlow'
import { haptic } from '@/lib/haptics'
import { draftAppearance, draftLookId, newPetDraft } from '@/lib/petDraft'
import { SpeakingBars } from '@/components/voice/SpeakingBars'
import { canSpeak, playVoiceSample, stopVoice, useVoiceSpeaking } from '@/lib/petVoice'
import { isSupabaseEnabled, supabase } from '@/lib/supabase'

const PET_SIZE = 300

/** What a pet with fine-tuned traits says first (the spec's "Custom" row). */
const CUSTOM_FIRST_LINE = 'Oh! Hi. I think I like you already.'

/** What the pet says first, by the preset it was made from. */
const FIRST_LINE: Record<PresetId, string> = {
	cuddly: 'Oh! Hi. I think I like you already.',
	curious: "Ooh. What's that? And that? Hi!",
	cool: "Nice place. I'll allow it.",
	loyal: "You're here. Good. I'm staying close."
}

export default function MeetScreen() {
	const { draft: stored, update } = usePetDraft()
	const draft = stored ?? newPetDraft()
	const name = draft.name.trim() || 'Your pet'
	const appearance = draftAppearance(draft)
	const insets = useSafeAreaInsets()
	const { width } = useWindowDimensions()
	const { layout } = useTheme()
	const savePet = useSavePet()
	const [saving, setSaving] = useState(false)
	const [failed, setFailed] = useState(false)
	// The first line out loud: shown while it plays, then the bubble offers it again. Nothing when
	// the voice is off or VoiceOver is on.
	const speaking = useVoiceSpeaking() === `meet:${draft.preset}`
	const [canHear, setCanHear] = useState(false)
	const custom = hasCustomTraits(draft.preset, draft.traits)
	const line = custom ? CUSTOM_FIRST_LINE : FIRST_LINE[draft.preset]
	// Sign-in opens over Meet, which stays mounted: the pet moves only while Meet is shown.
	const [focused, setFocused] = useState(true)
	// The happy face a touch gets for a moment.
	const { moment, showMoment } = usePetReactions(draft.species)

	useFocusEffect(
		useCallback(() => {
			setFocused(true)
			return () => setFocused(false)
		}, [])
	)

	useEffect(() => {
		void canSpeak().then(setCanHear)
	}, [])

	useMountEffect(() => {
		update({ step: 'meet' })
		track('pet_meet_viewed', {
			species: draft.species,
			look_id: draftLookId(draft) ?? 'custom',
			appearance_key: appearanceKey(appearance),
			preset: draft.preset,
			custom_traits: hasCustomTraits(draft.preset, draft.traits)
		})
		return () => stopVoice()
	})

	/** `asked`: "Hear it again" was tapped, so it plays even with the silent switch on. */
	function hear(asked: boolean) {
		void playVoiceSample('meet', draft.species, draft.preset, { custom, asked })
	}

	function landed() {
		haptic.success()
		hear(false)
	}

	// A touch is answered by the pet's body (PetStage); a pat on the head, a chin scratch, a
	// stroke and a hug make it beam, as on Home.
	function tapPet(zone: Zone) {
		if (zone === 'head' || zone === 'chin') showMoment('happy')
		track('pet_meet_touched', { kind: 'tap', zone })
	}

	function strokePet(zone: StrokeZone) {
		showMoment('happy')
		track('pet_meet_touched', { kind: 'stroke', zone })
	}

	function hugPet() {
		showMoment('happy')
		track('pet_meet_touched', { kind: 'hug' })
	}

	async function takeHome() {
		track('pet_meet_continued')
		const session = isSupabaseEnabled ? (await supabase.auth.getSession()).data.session : null
		if (!session) {
			router.push('/(auth)/login')
			return
		}
		setSaving(true)
		setFailed(false)
		try {
			await savePet(draft)
		} catch {
			haptic.warning()
			setFailed(true)
			setSaving(false)
		}
	}

	return (
		<View style={s.root}>
			<Glow size={width * 1.4} strength={1} style={[s.glow, { left: -width * 0.1 }]} />

			<View style={[s.top, { paddingTop: insets.top + 6, paddingHorizontal: layout.gutter - 4 }]}>
				<IconButton
					onPress={() => goBackTo('personality')}
					accessibilityLabel="Back"
					icon={(color) => <ChevronLeft size={22} color={color} strokeWidth={2} />}
				/>
			</View>

			<View style={[s.titles, { paddingHorizontal: layout.gutterWide }]}>
				<Eyebrow>
					{hasCustomTraits(draft.preset, draft.traits) ? 'Custom' : presetById(draft.preset).title}
				</Eyebrow>
				<Text variant="display" accessibilityRole="header">
					{`${name} is home`}
				</Text>
			</View>

			<View style={s.stage}>
				<FadeSlideIn index={2} style={s.bubble}>
					<PetBubble
						line={line}
						action={
							!canHear
								? undefined
								: speaking
									? {
											label: `${name} is speaking`,
											icon: () => <SpeakingBars name={name} />,
											onPress: () => hear(true)
										}
									: {
											label: 'Hear it again',
											icon: (color) => <Volume2 size={16} color={color} strokeWidth={2} />,
											onPress: () => hear(true)
										}
						}
					/>
				</FadeSlideIn>
				<RiseAndBreathe breathe={false} onLanded={landed}>
					<PetStage
						appearance={appearance}
						mood="happy"
						name={name}
						line={line}
						wants={null}
						cue={null}
						active={focused}
						speaking={speaking}
						onPress={tapPet}
						onStroke={strokePet}
						onHug={hugPet}
						beaming={moment === 'happy'}
						hint="Answers your touch"
						size={PET_SIZE}
					/>
				</RiseAndBreathe>
			</View>

			<View
				style={[
					s.bottom,
					{ paddingBottom: insets.bottom + 16, paddingHorizontal: layout.gutterWide }
				]}
			>
				<Text
					variant="caption"
					tone={failed ? 'error' : 'secondary'}
					style={s.next}
					accessibilityLiveRegion="polite"
				>
					{failed
						? `Couldn't save ${name} yet. Check your connection and try again.`
						: `Next, save ${name} with your email.`}
				</Text>
				<Button
					label={failed ? 'Try again' : `Take ${name} home`}
					size="lg"
					withArrow
					fullWidth
					loading={saving}
					haptic="success"
					onPress={takeHome}
				/>
			</View>
		</View>
	)
}

const s = StyleSheet.create({
	root: { flex: 1 },
	glow: { position: 'absolute', top: '18%' },
	top: { flexDirection: 'row' },
	titles: { gap: 8, paddingTop: 8 },
	stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
	bubble: { alignSelf: 'flex-end', marginRight: 24, marginBottom: -24, zIndex: 1 },
	bottom: { gap: 12 },
	next: { textAlign: 'center' }
})
