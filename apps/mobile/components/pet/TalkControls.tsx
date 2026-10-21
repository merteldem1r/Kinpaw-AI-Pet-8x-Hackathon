import { useRef, useState } from 'react'
import { Keyboard, StyleSheet, View, type TextInput } from 'react-native'
import { ArrowUp, Keyboard as KeyboardIcon, Lock, X } from 'lucide-react-native'
import { countWords, firstWords, TALK_TEXT_MAX, TALK_WORDS_MAX } from '@app/contract'
import { MicButton } from '@/components/pet/MicButton'
import { WordsChip } from '@/components/pet/WordsChip'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { Text } from '@/components/ui/Text'
import TextInputField from '@/components/ui/TextInputField'
import type { CancelReason } from '@/hooks/useVoice'
import { track } from '@/lib/analytics'

/** The mic shows how many are left when a free account has this many, or fewer. */
const COUNT_FROM = 3
/** The field shows its word count from this many words on, so the limit is no surprise. */
const WORDS_SHOWN_FROM = 15
/**
 * The voice row's height (the mic and the hint under it), kept by the field too: the pet is sized
 * to what this row leaves, so it never resizes when the field opens.
 */
export const VOICE_ROW_HEIGHT = 86

/** The mic's side of talking: listening is useVoice's, the gestures MicButton's. */
export type VoiceControls = {
	listening: boolean
	onStart: () => void
	onFinish: () => void
	onCancel: (reason: CancelReason) => void
}

/**
 * Where you talk to the pet, between the pet and the care tiles (the spec, "Talking (on Home)").
 * With `voice`, the mic in the middle and a small keyboard button beside it to type instead;
 * without (this build can't listen, or the microphone was refused), a button that opens the
 * one-line field, which sends on return. Above it, your words as they're heard and while the pet
 * thinks. No text about the limit takes space here (Mert, 2026-10-02): the mic carries a small
 * count when 3 or fewer are left, and at the limit it (or the typing button) shows a lock, and
 * pressing it is `onLockedPress`.
 *
 * It owns only the field (open or not, the text). What a message does is the caller's.
 */
export function TalkControls({
	name,
	words,
	busy,
	messagesLeft,
	onSend,
	onLockedPress,
	voice,
	micRefused
}: {
	name: string
	/** What was said, shown back while the pet thinks (or after it failed to answer). */
	words: string | null
	/** A reply is on its way: nothing more can be sent. */
	busy: boolean
	/** Free messages left today: undefined until known, null for Plus. */
	messagesLeft: number | null | undefined
	/** Says the text; false when it wasn't sent (empty, or a reply on its way). */
	onSend: (text: string) => boolean
	/** Pressed while locked (the day's free messages used). */
	onLockedPress: () => void
	/** The mic, when this build can listen and the person hasn't refused it. */
	voice: VoiceControls | null
	/** The microphone was refused: say how to turn it back on. */
	micRefused: boolean
}) {
	const [open, setOpen] = useState(false)
	const [text, setText] = useState('')
	const sentSinceOpen = useRef(false)
	const input = useRef<TextInput>(null)
	const talkedOut = messagesLeft === 0

	function openField() {
		sentSinceOpen.current = false
		setOpen(true)
		track('talk_started', { input: 'typed' })
	}

	function closeField() {
		if (!sentSinceOpen.current) track('talk_cancelled', { reason: 'closed' })
		Keyboard.dismiss()
		setText('')
		setOpen(false)
	}

	/** The field takes no word past TALK_WORDS_MAX (a paste is cut to its first ones). */
	function change(next: string) {
		setText(firstWords(next, TALK_WORDS_MAX))
	}

	function submit() {
		if (!onSend(text)) return
		sentSinceOpen.current = true
		setText('')
		// Out of the way, so the pet and its reply are in view.
		Keyboard.dismiss()
	}

	const wordCount = countWords(text)
	const remaining =
		typeof messagesLeft === 'number' && messagesLeft > 0 && messagesLeft <= COUNT_FROM
			? messagesLeft
			: null

	return (
		<View style={s.wrap}>
			{words ? (
				<View style={s.chip} pointerEvents="none">
					<WordsChip words={words} />
				</View>
			) : null}

			{open && !talkedOut ? (
				<View style={[s.fieldWrap, voice && s.voiceHeight]}>
					<View style={s.row}>
						<View style={s.field}>
							<TextInputField
								inputRef={input}
								value={text}
								onChangeText={change}
								placeholder={`Say something to ${name}`}
								accessibilityLabel={`Say something to ${name}`}
								maxLength={TALK_TEXT_MAX}
								autoFocus
								returnKeyType="send"
								submitBehavior="submit"
								onSubmitEditing={submit}
								editable={!busy}
							/>
						</View>
						<IconButton
							icon={(color) => <ArrowUp size={20} color={color} strokeWidth={2} />}
							accessibilityLabel="Send"
							onPress={submit}
							size={44}
							haptic="press"
						/>
						<IconButton
							icon={(color) => <X size={18} color={color} strokeWidth={2} />}
							accessibilityLabel="Close"
							onPress={closeField}
							size={36}
						/>
					</View>
					{wordCount >= WORDS_SHOWN_FROM ? (
						<Text
							variant="caption"
							tone={wordCount >= TALK_WORDS_MAX ? 'brand' : 'tertiary'}
							style={s.wordCount}
							accessibilityLiveRegion="polite"
						>
							{`${wordCount} of ${TALK_WORDS_MAX} words`}
						</Text>
					) : null}
				</View>
			) : voice ? (
				<View style={s.voiceRow}>
					{talkedOut ? (
						<View style={s.side} />
					) : (
						<IconButton
							icon={(color) => <KeyboardIcon size={18} color={color} strokeWidth={1.9} />}
							accessibilityLabel="Type instead"
							onPress={openField}
							size={44}
							style={s.side}
						/>
					)}
					<MicButton
						name={name}
						listening={voice.listening}
						disabled={talkedOut || busy}
						locked={talkedOut}
						remaining={remaining}
						onStart={voice.onStart}
						onFinish={voice.onFinish}
						onCancel={voice.onCancel}
						onDisabledPress={talkedOut ? onLockedPress : undefined}
					/>
					<View style={s.side} />
				</View>
			) : (
				<Button
					label={talkedOut ? 'All talked out for today' : `Say something to ${name}`}
					variant="secondary"
					size="lg"
					disabled={talkedOut || busy}
					onDisabledPress={talkedOut ? onLockedPress : undefined}
					icon={(color) =>
						talkedOut ? (
							<Lock size={18} color={color} strokeWidth={1.9} />
						) : (
							<KeyboardIcon size={18} color={color} strokeWidth={1.9} />
						)
					}
					accessibilityHint={talkedOut ? 'Opens Kinpaw Plus' : 'Opens a field to type to your pet'}
					onPress={openField}
				/>
			)}

			{micRefused && !talkedOut ? (
				<Text variant="caption" tone="tertiary" style={s.note}>
					The microphone is off for Kinpaw. You can type, or turn it on in Settings.
				</Text>
			) : null}
		</View>
	)
}

const s = StyleSheet.create({
	wrap: { gap: 8 },
	// Above the controls, over the space under the pet, so it never moves the panel.
	chip: { position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 8 },
	row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	voiceRow: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		justifyContent: 'center',
		gap: 24,
		height: VOICE_ROW_HEIGHT
	},
	voiceHeight: { height: VOICE_ROW_HEIGHT },
	// The keyboard button on one side, an empty twin on the other, so the mic stays centred.
	side: { width: 44, height: 44, marginTop: 10 },
	note: { textAlign: 'center' },
	fieldWrap: { justifyContent: 'center', gap: 4 },
	// Right-aligned under the field, clear of Send (44) and Close (36) and their gaps.
	wordCount: { textAlign: 'right', marginRight: 96 },
	field: { flex: 1 }
})
