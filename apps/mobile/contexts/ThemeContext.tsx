/**
 * Appearance theming: the preset comes from packages/brand (brand.config.ts),
 * the scheme from the sky. Kinpaw follows the time of day: the light scheme
 * (dusk's `dawn`) in the morning and afternoon, the dark one in the evening and
 * at night (docs/application/product.md, "Structure and scope"). There is no
 * appearance choice in v1; the stored preference (lib/themePref.ts) is kept for
 * when one returns, and is not applied.
 *
 * Components never branch on `isDark` to pick a colour — they ask the palette
 * for a role (`colors.surface`, `colors.brandInk`) and the palette knows the
 * scheme. Read it with useTheme() / useColors(), or build styles once per
 * palette with makeStyles / useThemedStyles (lib/themedStyles.ts).
 */
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode
} from 'react'
import { AppState } from 'react-native'
import {
	theme,
	type ElevationLevel,
	type NativeShadow,
	type Palette,
	type PresetName,
	type Scheme,
	type Theme
} from '@app/brand'
import { phaseAt, schemeForPhase } from '@/lib/sky'
import { cachedThemePref, saveThemePref, type ThemePref } from '@/lib/themePref'

export type { ThemePref }

export interface ThemeValue {
	preset: PresetName
	/** What the user chose; stored, not applied while the app follows the sky. */
	pref: ThemePref
	/** What that resolves to right now. */
	scheme: Scheme
	isDark: boolean
	colors: Palette
	/** Tinted, scheme-aware shadows (spread into a style). */
	elevation: Record<ElevationLevel, NativeShadow>
	type: Theme['type']
	radii: Theme['radii']
	space: Theme['space']
	layout: Theme['layout']
	motion: Theme['motion']
	setPref: (pref: ThemePref) => void
}

function valueFor(pref: ThemePref, scheme: Scheme, setPref: ThemeValue['setPref']): ThemeValue {
	return {
		preset: theme.preset,
		pref,
		scheme,
		isDark: scheme === 'dark',
		colors: theme.palettes[scheme],
		elevation: theme.elevation[scheme],
		type: theme.type,
		radii: theme.radii,
		space: theme.space,
		layout: theme.layout,
		motion: theme.motion,
		setPref
	}
}

// Outside a provider (tests, the error fallback before mount) the preset's own scheme applies.
const ThemeContext = createContext<ThemeValue>(
	valueFor(theme.primaryScheme, theme.primaryScheme, () => {})
)

export function ThemeProvider({ children }: { children: ReactNode }) {
	const [pref, setPrefState] = useState<ThemePref>(() => cachedThemePref() ?? theme.primaryScheme)
	const [scheme, setScheme] = useState<Scheme>(() => schemeForPhase(phaseAt(new Date())))

	// The scheme changes at 05:00 and 17:00, but only when the app comes back to
	// the foreground: never under the person's thumb mid-action.
	useEffect(() => {
		const sub = AppState.addEventListener('change', (state) => {
			if (state === 'active') setScheme(schemeForPhase(phaseAt(new Date())))
		})
		return () => sub.remove()
	}, [])

	const setPref = useCallback((next: ThemePref) => {
		setPrefState(next)
		void saveThemePref(next)
	}, [])

	const value = useMemo(() => valueFor(pref, scheme, setPref), [pref, scheme, setPref])

	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeValue {
	return useContext(ThemeContext)
}

/** The palette alone — the common case for inline props like icon colours. */
export function useColors(): Palette {
	return useContext(ThemeContext).colors
}
