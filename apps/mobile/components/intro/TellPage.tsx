import { useState } from 'react'
import {
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
	View,
	useWindowDimensions
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Keyboard as KeyboardIcon, RotateCcw } from 'lucide-react-native'
import { INTRO_TEXT_MAX, INTRO_WORDS_MAX, type IntroSkipStep, type Pet } from '@app/contract'
import { FadeSlideIn } from '@/components/motion/FadeSlideIn'
import { HintChips } from '@/components/intro/HintChips'
import { MicRing } from '@/components/intro/MicRing'
import { PetArt } from '@/components/pet/PetArt'
import { PetBubble } from '@/components/pet/PetBubble'
import { RiseAndBreathe } from '@/components/pet/RiseAndBreathe'
import { TypingPaws } from '@/components/pet/TypingPaws'
import { Button } from '@/components/ui/Button'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { IconButton } from '@/components/ui/IconButton'
import { Glow } from '@/components/ui/Marks'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import type { useIntro } from '@/hooks/useIntro'
import { useIntroTell, type IntroResult } from '@/hooks/useIntroTell'
import {
	CONSENT,
	PLACEHOLDER,
	introEyebrow,
	introLine,
	introSkipStep,
	introStatus
} from '@/lib/introPage'

/** The pet on the page where you tell it, pt. */
const PET_SIZE = 176

/** "Tell me about you"'s one page to tell the pet: ask, listen, type, edit, send. */
export function TellPage({
	name,
	pet,
	intro,
	onResult,
	onSkip,
	onLater
}: {
	name: string
	pet: Pet | undefined
	intro: ReturnType<typeof useIntro>
	onResult: (result: IntroResult) => void
	onSkip: (step: IntroSkipStep) => void
	/** Go home without ending the step (the AI couldn't be reached). */
	onLater: () => void
}) {
	const insets = useSafeAreaInsets()
	const { width } = useWindowDimensions()
	const { colors: c, layout, radii } = useTheme()
	const [focused, setFocused] = useState(false)
	const tell = useIntroTell({ name, intro, onResult, onLater })
	const { field, text, words, notice, sending, listening, busy } = tell

	return (
		<KeyboardAvoidingView
			style={[s.root, { backgroundColor: c.bg }]}
			behavior={Platform.OS === 'ios' ? 'padding' : undefined}
		>
			<Glow
				size={width * 1.25}
				strength={notice === 'later' ? 0.5 : 1}
				style={[s.glow, { left: -width * 0.125 }]}
			/>
			<ScrollView
				contentContainerStyle={[
					s.page,
					{
						paddingTop: insets.top + 4,
						paddingBottom: insets.bottom + 12,
						paddingHorizontal: layout.gutterWide
					}
				]}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
				scrollEnabled={!listening}
			>
				<View style={s.topBar}>
					{busy ? null : (
						<Pressable
							onPress={() => onSkip(introSkipStep(notice, !!text))}
							accessibilityRole="button"
							accessibilityLabel="Skip"
							accessibilityHint={`${name} won't ask again`}
							hitSlop={12}
							style={s.skip}
						>
							<Text variant="label" tone="secondary">
								Skip
							</Text>
						</Pressable>
					)}
				</View>

				<View style={s.titles}>
					<Eyebrow>{introEyebrow(sending, listening)}</Eyebrow>
					<Text variant="h1" accessibilityRole="header">{`Tell ${name} about you`}</Text>
				</View>

				{focused ? null : (
					<View style={s.stage}>
						<FadeSlideIn index={1} style={s.bubble}>
							{busy ? (
								<PetBubble line="" compact>
									<TypingPaws name={name} />
								</PetBubble>
							) : (
								<PetBubble line={introLine(notice)} compact />
							)}
						</FadeSlideIn>
						{pet ? (
							<RiseAndBreathe>
								<PetArt
									appearance={pet.appearance}
									mood={notice === 'later' ? 'sleepy' : busy ? 'content' : 'happy'}
									size={PET_SIZE}
									label={`${name}, ${busy ? 'listening' : 'happy'}`}
								/>
							</RiseAndBreathe>
						) : null}
					</View>
				)}

				<HintChips lit={tell.lit} />

				<Pressable
					onPress={() => field.current?.focus()}
					disabled={busy}
					accessible={false}
					style={[
						s.card,
						{
							backgroundColor: c.well,
							borderColor: focused || listening ? c.brandInk : c.borderSoft,
							borderRadius: radii.card
						}
					]}
				>
					<TextInput
						ref={field}
						value={tell.shown}
						onChangeText={tell.type}
						onFocus={() => setFocused(true)}
						onBlur={() => setFocused(false)}
						editable={!busy}
						multiline
						maxLength={INTRO_TEXT_MAX}
						placeholder={PLACEHOLDER}
						placeholderTextColor={c.textTertiary}
						accessibilityLabel={`What you tell ${name}`}
						style={[s.input, { color: c.textPrimary }]}
					/>
					<Text
						variant="caption"
						tone={words >= INTRO_WORDS_MAX ? 'brand' : 'tertiary'}
						style={s.count}
						accessibilityLiveRegion="polite"
					>
						{`${words} / ${INTRO_WORDS_MAX}`}
					</Text>
				</Pressable>

				<View style={s.controls}>
					<IconButton
						icon={(color) => <KeyboardIcon size={20} color={color} strokeWidth={1.9} />}
						accessibilityLabel="Type instead"
						onPress={() => field.current?.focus()}
						size={46}
						style={busy ? s.hidden : undefined}
					/>
					{tell.mic.available ? (
						<MicRing
							name={name}
							words={words}
							maxWords={INTRO_WORDS_MAX}
							listening={listening}
							disabled={sending || (!listening && words >= INTRO_WORDS_MAX)}
							onStart={tell.startListening}
							onFinish={tell.finishListening}
							onCancel={tell.cancelListening}
						/>
					) : null}
					<IconButton
						icon={(color) => <RotateCcw size={18} color={color} strokeWidth={2} />}
						accessibilityLabel="Clear and start over"
						onPress={tell.clear}
						size={46}
						style={busy || !text ? s.hidden : undefined}
					/>
				</View>
				<Text variant="caption" tone="secondary" style={s.center} accessibilityLiveRegion="polite">
					{introStatus(tell.mic, !!text, name)}
				</Text>

				<View style={s.spacer} />
				<View style={s.bottom}>
					<Button
						label={`Send to ${name}`}
						size="lg"
						withArrow
						fullWidth
						loading={sending}
						disabled={!text.trim() || listening}
						onPress={() => void tell.send()}
					/>
					{notice === 'later' ? (
						<Button label="Ask me later" variant="ghost" fullWidth onPress={onLater} />
					) : (
						<Text variant="caption" tone="tertiary" style={s.center}>
							{CONSENT}
						</Text>
					)}
				</View>
			</ScrollView>
		</KeyboardAvoidingView>
	)
}

const s = StyleSheet.create({
	root: { flex: 1 },
	glow: { position: 'absolute', top: '6%' },
	page: { flexGrow: 1, gap: 14 },
	topBar: { flexDirection: 'row', justifyContent: 'flex-end', minHeight: 40 },
	skip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 4 },
	titles: { gap: 6 },
	// The pet with its bubble tucked over its shoulder, like Meet.
	stage: { alignItems: 'center', paddingTop: 4 },
	bubble: { alignSelf: 'flex-end', marginBottom: -26, zIndex: 1, maxWidth: '62%' },
	card: { borderWidth: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 4 },
	input: {
		minHeight: 72,
		maxHeight: 150,
		fontSize: 16,
		lineHeight: 23,
		padding: 0,
		textAlignVertical: 'top'
	},
	count: { textAlign: 'right', fontVariant: ['tabular-nums'] },
	controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28 },
	hidden: { opacity: 0 },
	center: { textAlign: 'center' },
	spacer: { flex: 1, minHeight: 4 },
	bottom: { gap: 10 }
})
