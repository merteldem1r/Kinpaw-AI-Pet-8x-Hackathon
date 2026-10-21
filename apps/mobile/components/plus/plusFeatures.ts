import {
	BookHeart,
	Camera,
	Infinity as InfinityIcon,
	Sparkles,
	type LucideIcon
} from 'lucide-react-native'
import { MEMORY_CAP_FREE, MEMORY_CAP_PLUS } from '@app/contract'

/**
 * What Kinpaw Plus adds, in the pet's terms: the paywall and Profile's Plus panel show the same
 * list (M7, R8, R12). "Room for more pets" stays off until more pets exist (Mert, 2026-10-02:
 * a promise the app can't keep). The memory line is v2 (v2-memory-requirements.md, R29): memory
 * itself is everyone's; Plus only remembers more. The photo line is v2 too
 * (v2-pet-from-photo-requirements.md, R26): everyone's pet can start from a photo; Plus can redo it.
 */
export function plusFeatures(name: string): { icon: LucideIcon; label: string; detail?: string }[] {
	return [
		{ icon: InfinityIcon, label: `Talk with ${name} as much as you like` },
		{
			icon: BookHeart,
			label: `${name} remembers more about you`,
			detail: `Up to ${MEMORY_CAP_PLUS} things, instead of ${MEMORY_CAP_FREE}`
		},
		{
			icon: Sparkles,
			label: 'Plus looks and rare builder options',
			detail: 'Calico, Blue merle, odd eyes, spots and more'
		},
		{
			icon: Camera,
			label: `Redo ${name}'s look from a photo`,
			detail: 'Once a day, with every Plus option your pet has'
		}
	]
}
