import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, StyleSheet, View, type GestureResponderEvent } from 'react-native'
import Animated, {
	cancelAnimation,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withSequence,
	withTiming
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { Lock, Mic } from 'lucide-react-native'
import type { CancelReason } from '@/hooks/useVoice'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { haptic } from '@/lib/haptics'
import { Easings, useReducedMotion } from '@/lib/motion'

/** The mic, pt across: the biggest control under the pet. */
const SIZE = 64
/** Held at least this long, letting go sends; a quicker tap keeps listening until a second tap. */
const HOLD_MS = 300
/** A finger this far from where it landed is sliding away: letting go there cancels. */
const SLIDE_CANCEL = 70
/** The count badge on the mic's shoulder, pt across. */
const BADGE = 22
/** The listening pulse. */
const PULSE_SCALE = 1.08
const PULSE_MS = 700

type Mode = 'hold' | 'tap'

/**
 * The mic on Home (the spec, "Talking (on Home)"; m6-talk-requirements.md, R24): hold to talk
 * and let go to send, or slide away first to cancel; a quick tap starts listening and a second
 * tap sends, which is also what VoiceOver's double-tap does. It pulses while listening (still
 * under Reduce Motion; VoiceOver hears "Listening") and says under it what letting go
 * will do. Disabled (a reply on its way) it keeps its place in a quiet look. Locked (the day's
 * free messages used) it keeps its usual look with a small lock on its shoulder, and a press
 * calls `onDisabledPress`; `remaining` puts the few free messages left in the same spot.
 *
 * Only the gestures live here; listening itself is useVoice's.
 */
export function MicButton({
	name,
	listening,
	disabled,
	locked = false,
	remaining = null,
	onStart,
	onFinish,
	onCancel,
	onDisabledPress,
	showHint = true
}: {
	name: string
	listening: boolean
	disabled: boolean
	/** The day's free messages are used: a lock, and a press opens Kinpaw Plus (the caller's). */
	locked?: boolean
	/** Free messages left, shown as a badge; null for none (plenty left, or Plus). */
	remaining?: number | null
	onStart: () => void
	onFinish: () => void
	onCancel: (reason: CancelReason) => void
	onDisabledPress?: () => void
	/** The line under the mic while listening ("Let go to send"). Off where the screen says its own. */
	showHint?: boolean
}) {
	const { colors: c, elevation } = useTheme()
	const still = useReducedMotion()
	// Quiet only while a reply is on its way; locked keeps the mic's own look, with the lock.
	const quiet = disabled && !locked
	const press = useRef<{ at: number; x: number; y: number } | null>(null)
	const [mode, setMode] = useState<Mode | null>(null)
	const [leaving, setLeaving] = useState(false)
	const pulse = useSharedValue(1)

	// Listening ended (sent, cancelled, or the 15 seconds ran out): back to a fresh press.
	// Started: VoiceOver says so, since the pulse is only seen (R30).
	useEffect(() => {
		if (listening) {
			AccessibilityInfo.announceForAccessibility('Listening')
			return
		}
		press.current = null
		setMode(null)
		setLeaving(false)
	}, [listening])

	useEffect(() => {
		if (!listening || still) {
			cancelAnimation(pulse)
			pulse.value = 1
			return
		}
		const half = { duration: PULSE_MS, easing: Easings.inOut }
		pulse.value = withRepeat(withSequence(withTiming(PULSE_SCALE, half), withTiming(1, half)), -1)
		return () => cancelAnimation(pulse)
	}, [listening, still, pulse])
	const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }))

	function grant(event: GestureResponderEvent) {
		if (disabled) {
			onDisabledPress?.()
			return
		}
		if (listening && mode === 'tap') {
			// The second tap: send.
			onFinish()
			return
		}
		const { pageX, pageY } = event.nativeEvent
		press.current = { at: Date.now(), x: pageX, y: pageY }
		setMode('hold')
		haptic.press()
		onStart()
	}

	function move(event: GestureResponderEvent) {
		const start = press.current
		if (!start || mode !== 'hold') return
		const { pageX, pageY } = event.nativeEvent
		setLeaving(Math.hypot(pageX - start.x, pageY - start.y) > SLIDE_CANCEL)
	}

	function release() {
		const start = press.current
		press.current = null
		if (!start) return
		if (leaving) {
			onCancel('slid_away')
		} else if (Date.now() - start.at >= HOLD_MS) {
			onFinish()
		} else {
			setMode('tap')
		}
		setLeaving(false)
	}

	function accessibilityTap() {
		if (disabled) return onDisabledPress?.()
		if (listening) return onFinish()
		setMode('tap')
		onStart()
	}

	const hint = !listening
		? null
		: leaving
			? 'Let go to cancel'
			: mode === 'tap'
				? 'Tap again to send'
				: 'Let go to send · slide away to cancel'

	return (
		<View style={s.wrap}>
			<Animated.View
				onStartShouldSetResponder={() => true}
				onResponderTerminationRequest={() => false}
				onResponderGrant={grant}
				onResponderMove={move}
				onResponderRelease={release}
				onResponderTerminate={() => {
					if (press.current) onCancel('slid_away')
					press.current = null
				}}
				accessible
				accessibilityRole="button"
				accessibilityLabel={
					locked
						? 'All talked out for today'
						: listening
							? 'Listening. Tap to send'
							: remaining !== null
								? `Talk to ${name}, ${remaining} left today`
								: `Talk to ${name}`
				}
				accessibilityHint={
					locked
						? 'Opens Kinpaw Plus'
						: listening
							? undefined
							: 'Hold to talk, or tap to start and stop'
				}
				accessibilityState={{ disabled, busy: listening }}
				onAccessibilityTap={accessibilityTap}
				style={[
					s.mic,
					quiet
						? { backgroundColor: c.well, borderColor: c.borderHairline }
						: [elevation.cta, { borderColor: 'transparent' }],
					leaving && s.leaving,
					pulseStyle
				]}
			>
				{quiet ? null : (
					<LinearGradient
						colors={c.brandGradient}
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 1 }}
						style={[StyleSheet.absoluteFill, { borderRadius: SIZE / 2 }]}
					/>
				)}
				<Mic size={26} color={quiet ? c.textTertiary : c.onBrand} strokeWidth={2} />
				{locked || remaining !== null ? (
					<View
						style={[s.badge, { backgroundColor: c.surface2, borderColor: c.brandBorder }]}
						importantForAccessibility="no-hide-descendants"
					>
						{locked ? (
							<Lock size={12} color={c.brandInk} strokeWidth={2.4} />
						) : (
							<Text variant="caption" tone="brand" style={s.badgeText}>
								{remaining}
							</Text>
						)}
					</View>
				) : null}
			</Animated.View>
			{hint && showHint ? (
				<Text
					variant="caption"
					tone={leaving ? 'error' : 'secondary'}
					accessibilityLiveRegion="polite"
				>
					{hint}
				</Text>
			) : null}
		</View>
	)
}

const s = StyleSheet.create({
	wrap: { alignItems: 'center', gap: 6 },
	mic: {
		width: SIZE,
		height: SIZE,
		borderRadius: SIZE / 2,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1
	},
	leaving: { opacity: 0.55 },
	badge: {
		position: 'absolute',
		top: -4,
		right: -4,
		minWidth: BADGE,
		height: BADGE,
		borderRadius: BADGE / 2,
		borderWidth: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 5
	},
	badgeText: { fontWeight: '700' }
})
