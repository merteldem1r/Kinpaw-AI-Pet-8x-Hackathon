import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, Inter, Source_Serif_4 } from 'next/font/google'
import { Suspense } from 'react'
import { Analytics } from '@vercel/analytics/next'
import { brandConfig, brandCss, palette, theme } from '@app/brand'
import { PostHogProvider } from '@/components/PostHogProvider'
import { GoogleAnalytics } from '@/components/GoogleAnalytics'
import './globals.css'

// Fonts. Inter is the text face for both presets; the display face is picked
// by the preset through --font-display (packages/brand/src/css.ts): Source
// Serif 4 for dusk, Bricolage Grotesque for daylight. Both are declared so a
// preset switch is one line in brand.config.ts; neither display face is
// preloaded, so the one the preset does not use is never downloaded.
const inter = Inter({
	subsets: ['latin'],
	variable: '--font-inter',
	display: 'swap'
})

const sourceSerif = Source_Serif_4({
	subsets: ['latin'],
	variable: '--font-source-serif',
	display: 'swap',
	axes: ['opsz'],
	preload: false
})

const bricolage = Bricolage_Grotesque({
	subsets: ['latin'],
	variable: '--font-bricolage',
	display: 'swap',
	axes: ['opsz'],
	preload: false
})

// Every colour, radius, shadow and easing as CSS variables, generated from the
// same TS source the mobile app reads — no second copy to drift.
const BRAND_CSS = brandCss(theme)

const SITE_NAME = brandConfig.siteName

// Replace with your real domain. Falls back to NEXT_PUBLIC_SITE_URL in env.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://example.com'

const TITLE = `${SITE_NAME}: a cozy pet that missed you`
const DESCRIPTION =
	'Kinpaw is a cozy AI pet that lives on your phone. Make a cat or dog, look after it, talk to it and hear it answer in its own voice. It remembers what you tell it. Coming to iPhone.'

export const metadata: Metadata = {
	metadataBase: new URL(SITE_URL),
	title: {
		default: TITLE,
		template: `%s · ${SITE_NAME}`
	},
	description: DESCRIPTION,
	openGraph: {
		title: TITLE,
		description: DESCRIPTION,
		url: SITE_URL,
		siteName: SITE_NAME,
		locale: 'en_US',
		type: 'website'
	},
	twitter: {
		card: 'summary_large_image',
		title: SITE_NAME,
		description: DESCRIPTION
	}
	// The favicon is app/icon.tsx, drawn from the brand — no need to declare it.
}

export const viewport: Viewport = {
	themeColor: palette().bg,
	colorScheme: theme.primaryScheme,
	width: 'device-width',
	initialScale: 1
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html
			lang="en"
			data-preset={theme.preset}
			data-scheme={theme.primaryScheme}
			className={`${inter.variable} ${sourceSerif.variable} ${bricolage.variable}`}
		>
			<head>
				<style id="brand-tokens" dangerouslySetInnerHTML={{ __html: BRAND_CSS }} />
			</head>
			<body>
				<Suspense fallback={null}>
					<PostHogProvider>{children}</PostHogProvider>
					<GoogleAnalytics />
				</Suspense>
				<Analytics />
			</body>
		</html>
	)
}
