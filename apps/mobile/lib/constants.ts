/**
 * 🏷️ APP IDENTITY — Change these values to rebrand the app.
 *
 * These are referenced across landing, auth, onboarding, and profile screens.
 * Update them once here and they propagate everywhere.
 *
 * Steps to rebrand:
 *   1. Set preset, accent and appName in packages/brand/brand.config.ts
 *   2. Change APP_TAGLINE and APP_DESCRIPTION below
 *   3. Update app.json → expo.name and expo.slug
 */
import { brandConfig } from '@app/brand'

/** Display name shown in headers, onboarding, and the landing page (from brand.config.ts). */
export const APP_NAME = brandConfig.appName

/** URL scheme matching expo.scheme in app.json — used for OAuth deep link callbacks. */
export const APP_SCHEME = 'cozypet'

/** Support email shown on the Support screen. 🎨 REPLACE with Kinpaw's real address. */
export const APP_SUPPORT_EMAIL = 'support@example.com'

/** Welcome's headline (docs/application/UI/kinpaw-screen-spec-v1.md, "Welcome"). */
export const APP_TAGLINE = "A little friend who's always glad you're here."

/** Welcome's lead under the headline. */
export const APP_DESCRIPTION =
	"Feed them, play, talk a little. They'll be right here when you come back."
