import AsyncStorage from '@react-native-async-storage/async-storage'
import { lookById } from '@app/contract'

jest.mock('@react-native-async-storage/async-storage', () =>
	jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
)
jest.mock('@/lib/logger', () => ({ log: { warn: jest.fn(), error: jest.fn() } }))

const KEY = 'kinpaw:petDraft:v1'

/** A draft as builds before the pet builder stored it: a look id per species. */
function older() {
	const { appearances: _appearances, ...rest } = freshLaunch().newPetDraft()
	return { ...rest, name: 'Mochi', looks: { cat: 'ginger', dog: 'biscuit' } }
}

// The module caches what it read once per launch: each test is a fresh launch.
function freshLaunch(): typeof import('@/lib/petDraft') {
	let mod: typeof import('@/lib/petDraft') | undefined
	jest.isolateModules(() => {
		mod = jest.requireActual<typeof import('@/lib/petDraft')>('@/lib/petDraft')
	})
	return mod!
}

beforeEach(async () => {
	await AsyncStorage.clear()
})

describe('the pet draft', () => {
	it('is null when nothing was stored', async () => {
		expect(await freshLaunch().loadPetDraft()).toBeNull()
	})

	it('starts on Start: a cat, Ginger and Biscuit, Cuddly homebody, built', () => {
		const draft = freshLaunch().newPetDraft()
		expect(draft).toMatchObject({
			species: 'cat',
			appearances: { cat: lookById('ginger').appearance, dog: lookById('biscuit').appearance },
			name: '',
			preset: 'cuddly',
			step: 'start',
			path: 'build'
		})
		expect(draft.traits.affection).toBe(10)
		expect(draft.id).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
		)
		expect(freshLaunch().newPetDraft().id).not.toBe(draft.id)
	})

	it('survives a relaunch, at the step it was left on', async () => {
		const first = freshLaunch()
		const draft = {
			...first.newPetDraft(),
			species: 'dog' as const,
			name: 'Mochi',
			step: 'personality' as const
		}
		await first.savePetDraft(draft)

		const second = freshLaunch()
		expect(await second.loadPetDraft()).toEqual(draft)
		expect(second.cachedPetDraft()).toEqual(draft)
	})

	it('drops what it cannot read instead of crashing', async () => {
		for (const raw of [
			'not json',
			JSON.stringify({ species: 'hamster' }),
			// A dog stored as the cat.
			JSON.stringify({
				...freshLaunch().newPetDraft(),
				appearances: { cat: lookById('biscuit').appearance, dog: lookById('biscuit').appearance }
			}),
			// The same mistake in a draft from before the builder.
			JSON.stringify({ ...older(), looks: { cat: 'biscuit', dog: 'biscuit' } })
		]) {
			await AsyncStorage.setItem(KEY, raw)
			expect(await freshLaunch().loadPetDraft()).toBeNull()
		}
	})

	it('gives a draft from before pets had ids one, instead of dropping it', async () => {
		const { id: _id, ...older } = freshLaunch().newPetDraft()
		await AsyncStorage.setItem(KEY, JSON.stringify({ ...older, name: 'Mochi' }))
		const draft = await freshLaunch().loadPetDraft()
		expect(draft?.name).toBe('Mochi')
		expect(draft?.id).toMatch(/^[0-9a-f-]{36}$/)
	})

	it('reads a draft from before the layered coat as the same pet', async () => {
		// Six attributes, and Socks and bib still a pattern (v2-pet-looks-requirements.md, R12).
		const sixAttributes = (look: 'tuxedo' | 'biscuit') => {
			const { accent: _accent, white: _white, ...rest } = lookById(look).appearance
			return look === 'tuxedo' ? { ...rest, pattern: 'socks' } : rest
		}
		const draft = { ...freshLaunch().newPetDraft(), name: 'Mochi' }
		await AsyncStorage.setItem(
			KEY,
			JSON.stringify({
				...draft,
				appearances: { cat: sixAttributes('tuxedo'), dog: sixAttributes('biscuit') }
			})
		)
		const read = await freshLaunch().loadPetDraft()
		expect(read?.name).toBe('Mochi')
		expect(read?.appearances.cat).toEqual(lookById('tuxedo').appearance)
		expect(read?.appearances.dog).toEqual(lookById('biscuit').appearance)
	})

	it('turns a draft from before the builder into its looks, keeping everything else', async () => {
		await AsyncStorage.setItem(
			KEY,
			JSON.stringify({ ...older(), species: 'dog', looks: { cat: 'smoke', dog: 'pepper' } })
		)
		const mod = freshLaunch()
		const draft = await mod.loadPetDraft()
		expect(draft?.name).toBe('Mochi')
		expect(draft?.appearances).toEqual({
			cat: lookById('smoke').appearance,
			dog: lookById('pepper').appearance
		})
		expect(draft && mod.draftLookId(draft)).toBe('pepper')
		expect(draft).not.toHaveProperty('looks')
	})

	it('reads a draft from before the builder as built, resuming in Make your own', async () => {
		const { path: _path, ...older } = { ...freshLaunch().newPetDraft(), step: 'look' }
		await AsyncStorage.setItem(KEY, JSON.stringify(older))
		const draft = await freshLaunch().loadPetDraft()
		expect(draft?.path).toBe('build')
		expect(draft?.step).toBe('build')
	})

	it('reads a draft paused on Choose a friend (removed 2026-10-04) as built, in Make your own', async () => {
		const chosen = { ...freshLaunch().newPetDraft(), step: 'look', path: 'choose' }
		await AsyncStorage.setItem(KEY, JSON.stringify(chosen))
		const draft = await freshLaunch().loadPetDraft()
		expect(draft).toMatchObject({ step: 'build', path: 'build' })
		expect(draft?.appearances.cat).toEqual(lookById('ginger').appearance)
	})

	it('keeps a pet made from a photo as such', async () => {
		const first = freshLaunch()
		await first.savePetDraft({ ...first.newPetDraft(), path: 'photo', step: 'name' })
		expect(await freshLaunch().loadPetDraft()).toMatchObject({ path: 'photo', step: 'name' })
	})

	it('knows a customized pet is no ready-made look', () => {
		const mod = freshLaunch()
		const draft = mod.newPetDraft()
		expect(mod.draftLookId(draft)).toBe('ginger')
		const curly = { ...draft.appearances.cat, tail: 'curly' as const }
		const custom = { ...draft, appearances: { ...draft.appearances, cat: curly } }
		expect(mod.draftLookId(custom)).toBeNull()
		expect(mod.draftAppearance(custom)).toEqual(curly)
	})

	it('is cleared only when asked', async () => {
		const mod = freshLaunch()
		await mod.savePetDraft(mod.newPetDraft())
		await mod.clearPetDraft()
		expect(await AsyncStorage.getItem(KEY)).toBeNull()
		expect(await freshLaunch().loadPetDraft()).toBeNull()
	})
})
