import Link from 'next/link'
import { Reveal } from '@/components/motion/Reveal'
import { cn } from '@/lib/utils'

/*
 * The reading parts of /whats-new. A chapter is prose with its own shape, never
 * a card: an opening line (what you get), a list (how it works) and its facts
 * set apart in the number role. Body copy holds a 68ch measure; a table or a
 * strip of numbers may run the column's full width.
 */

const MEASURE = 'max-w-[68ch]'

/** One feature or topic: a hairline, then air, then the heading close to its copy. */
export function Chapter({
	id,
	title,
	children
}: {
	id: string
	title: string
	children: React.ReactNode
}) {
	const headingId = `${id}-heading`
	return (
		<section
			id={id}
			aria-labelledby={headingId}
			className="mt-20 border-t border-line-hairline pt-16 first:mt-0 first:border-t-0 first:pt-0 sm:mt-24 sm:pt-20"
		>
			<Reveal>
				<h2 id={headingId} className="t-h2 text-balance">
					{title}
				</h2>
				{children}
			</Reveal>
		</section>
	)
}

/** The chapter's first paragraph: what you get, in the lead role. */
export function Opening({ children }: { children: React.ReactNode }) {
	return <p className={cn('t-lead mt-5 text-pretty text-ink', MEASURE)}>{children}</p>
}

/** A heading inside a chapter. */
export function Sub({ children }: { children: React.ReactNode }) {
	return <h3 className="t-h3 mt-12 text-balance">{children}</h3>
}

/** A paragraph of body copy. */
export function Para({ children, className }: { children: React.ReactNode; className?: string }) {
	return (
		<p
			className={cn('mt-4 text-pretty text-[17px] leading-[1.7] text-ink-body', MEASURE, className)}
		>
			{children}
		</p>
	)
}

/** How it works: one plain statement per line. */
export function Points({ children }: { children: React.ReactNode }) {
	return (
		<ul
			className={cn(
				'mt-4 list-disc space-y-2.5 pl-5 text-[17px] leading-[1.65] text-ink-body marker:text-ink-tertiary',
				MEASURE
			)}
		>
			{children}
		</ul>
	)
}

export interface Fact {
	/** The figure as measured, e.g. '36 of 36' or 'About $0.001'. */
	value: string
	/** What the figure counts. */
	label: string
}

/** Measured facts, set apart from the prose: the figure in the number role, tabular. */
export function Facts({ items, className }: { items: readonly Fact[]; className?: string }) {
	return (
		<dl
			className={cn(
				'mt-8 grid gap-x-10 gap-y-7 border-y border-line-soft py-7 sm:grid-cols-2',
				// Three figures sit in one row once the column is wide enough; four stay two by two.
				items.length === 3 && 'xl:grid-cols-3',
				className
			)}
		>
			{items.map((item) => (
				<div key={item.label} className="flex flex-col-reverse gap-1.5">
					<dt className="max-w-[30ch] text-pretty text-[15px] leading-snug text-ink-secondary">
						{item.label}
					</dt>
					<dd className="t-number text-[1.75rem] leading-none text-ink">{item.value}</dd>
				</div>
			))}
		</dl>
	)
}

/** A ledger: one figure and what it counts per row, the figures in a tabular column. */
export function Ledger({ items }: { items: readonly Fact[] }) {
	return (
		<dl className={cn('mt-6 divide-y divide-line-hairline border-y border-line-soft', MEASURE)}>
			{items.map((item) => (
				<div key={item.label} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-4 py-3.5">
					<dt className="order-2 text-pretty leading-snug text-ink-body">{item.label}</dt>
					<dd className="t-number order-1 text-ink">{item.value}</dd>
				</div>
			))}
		</dl>
	)
}

/** A phrase the app or the pet says, quoted in running copy. */
export function Said({ children }: { children: React.ReactNode }) {
	return <q className="text-ink">{children}</q>
}

/** A link in running copy: accent ink, underlined, so it reads as a link without colour. */
export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
	return (
		<Link
			href={href}
			className="font-medium text-brand-ink underline transition-colors duration-fast hover:text-ink"
		>
			{children}
		</Link>
	)
}
