module.exports = {
	preset: 'jest-expo',
	// packages/brand has no runner of its own: its tests (the palette contrast
	// suite) run here, so `npm run mobile:test` — and CI — covers them.
	roots: ['<rootDir>', '<rootDir>/../../packages/brand'],
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/$1'
	},
	transformIgnorePatterns: [
		'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|posthog-react-native|@shopify/react-native-skia/lib/module)'
	],
	// Of Skia, only its ES-module build is compiled here (its mock is loaded from it). Its
	// CommonJS build must be left alone: compiled again, the worklets plugin turns a function
	// declaration into an assignment, and `exports.replay = replay` above it is then undefined.
	// Skia's own mock, built on CanvasKit (Skia in WebAssembly), for the files that draw with it.
	// It is made only when a test imports Skia, and such a test names Skia's environment in its
	// first comment (`@jest-environment @shopify/react-native-skia/jestEnv.js`), which loads
	// CanvasKit; every other test is untouched.
	setupFiles: ['@shopify/react-native-skia/jestSetup.js'],
	// testPathPattern is a CLI flag, not a config key: Jest ignored it with a
	// validation warning and ran its defaults. testMatch is the config key, and
	// covers both places tests live: __tests__/ and *.test.ts(x) beside the code,
	// here and in packages/brand.
	testMatch: ['<rootDir>/**/*.test.[jt]s?(x)', '<rootDir>/../../packages/brand/**/*.test.[jt]s?(x)']
}
