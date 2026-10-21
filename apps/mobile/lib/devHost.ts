/**
 * Development only: reaching the Mac from a real iPhone without editing `.env.local`.
 *
 * `.env.local` points the app at the Mac as `127.0.0.1` (the web API, the local Supabase). That
 * works on the Simulator, which shares the Mac's network, but on an iPhone `127.0.0.1` is the
 * phone itself. A development build already knows the Mac's address on the Wi-Fi: it is where
 * Metro served the bundle from (`Constants.expoConfig.hostUri`, e.g. "192.168.1.131:8081").
 * So in development a loopback URL is moved onto that host, keeping its port and path, and the
 * phone follows the Mac to whatever address the Wi-Fi gives it today. The Simulator usually gets
 * the same address from Metro, which it reaches just as well as 127.0.0.1.
 *
 * Pure functions, so env.ts decides when they apply (only `__DEV__`) and tests can call them.
 */

const LOOPBACK = new Set(['127.0.0.1', 'localhost'])

/**
 * The host Metro serves this bundle from ("192.168.1.131"), from a `hostUri` like
 * "192.168.1.131:8081". Null when there is none, or it is itself loopback (nothing to move to).
 */
export function metroHost(hostUri: string | null | undefined): string | null {
	const host = hostUri?.trim().split('/')[0]?.replace(/:\d+$/, '')
	if (!host || LOOPBACK.has(host)) return null
	return host
}

/** Scheme, host, then the rest (port, path), kept exactly as written. */
const URL_PARTS = /^(https?:\/\/)([^/:?#]+)(.*)$/i

/**
 * `url` on Metro's host when it points at loopback; any other URL, or no host, unchanged. String
 * matching rather than `URL`, whose setters React Native doesn't fully implement.
 */
export function onMetroHost(url: string | undefined, host: string | null): string | undefined {
	if (!url || !host) return url
	const parts = URL_PARTS.exec(url)
	if (!parts || !LOOPBACK.has(parts[2]!.toLowerCase())) return url
	return `${parts[1]}${host}${parts[3]}`
}
