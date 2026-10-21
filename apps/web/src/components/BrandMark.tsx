import { cn } from '@/lib/utils'

/**
 * The site's mark: the app's own icon (the moon cat, apps/mobile/assets/icon/icon.png,
 * copied to public/brand/app-icon.webp at 128px), so the site and the phone's home
 * screen show the same face. Rounded like an iOS icon. It always sits beside the
 * name, so it is decorative. 🎨 REPLACE when the final icon exists: re-copy it.
 */
export function BrandMark({ className }: { siteName?: string; className?: string }) {
	return (
		// A plain <img>: a 128px local file needs no optimisation, and it paints with the nav.
		// eslint-disable-next-line @next/next/no-img-element
		<img
			src="/brand/app-icon.webp"
			alt=""
			aria-hidden="true"
			width={32}
			height={32}
			className={cn('h-8 w-8 shrink-0 rounded-[9px] shadow-soft', className)}
		/>
	)
}
