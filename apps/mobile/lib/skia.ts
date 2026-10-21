import { TurboModuleRegistry } from 'react-native'

/**
 * Whether this build has Skia (docs/application/features/v3-pet-looks-plan.md, B0). A build made
 * before Skia was added has no native module, and importing `@shopify/react-native-skia` there
 * throws. So no file the app always loads imports it: a Skia component lives in a file of its
 * own, and what shows it asks here first and `require`s that file only when this is true.
 * Otherwise the pet stays the SVG one (v3-pet-looks-requirements.md, R18).
 */
export function hasSkia(): boolean {
	return TurboModuleRegistry.get('RNSkiaModule') != null
}
