import { metroHost, onMetroHost } from '@/lib/devHost'

// Development builds on a real iPhone (lib/devHost.ts): a loopback URL from .env.local follows
// the Mac onto the Wi-Fi address Metro served the bundle from; nothing else moves.

describe('metroHost', () => {
	it("is the host Metro serves from, without Metro's port", () => {
		expect(metroHost('192.168.1.131:8081')).toBe('192.168.1.131')
		expect(metroHost('merts-mac.local:8081')).toBe('merts-mac.local')
	})

	it('is null when there is no host, or Metro is itself on loopback', () => {
		expect(metroHost(undefined)).toBeNull()
		expect(metroHost('')).toBeNull()
		expect(metroHost('127.0.0.1:8081')).toBeNull()
		expect(metroHost('localhost:8081')).toBeNull()
	})
})

describe('onMetroHost', () => {
	const host = '192.168.1.131'

	it("moves a loopback URL onto Metro's host, keeping its port and path", () => {
		expect(onMetroHost('http://127.0.0.1:3000', host)).toBe('http://192.168.1.131:3000')
		expect(onMetroHost('http://localhost:55321/', host)).toBe('http://192.168.1.131:55321/')
		expect(onMetroHost('http://LOCALHOST:3000/api?x=1', host)).toBe(
			'http://192.168.1.131:3000/api?x=1'
		)
	})

	it('leaves every other URL alone', () => {
		expect(onMetroHost('https://abc.supabase.co', host)).toBe('https://abc.supabase.co')
		expect(onMetroHost('http://192.168.1.20:3000', host)).toBe('http://192.168.1.20:3000')
		expect(onMetroHost('http://127.0.0.10:3000', host)).toBe('http://127.0.0.10:3000')
	})

	it('changes nothing without a host or a URL', () => {
		expect(onMetroHost('http://127.0.0.1:3000', null)).toBe('http://127.0.0.1:3000')
		expect(onMetroHost(undefined, host)).toBeUndefined()
	})
})
