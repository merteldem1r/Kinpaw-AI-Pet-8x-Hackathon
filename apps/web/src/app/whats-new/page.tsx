import type { Metadata } from 'next'
import { Container } from '@/components/Container'
import { PageHeader, PageShell } from '@/components/PageShell'
import { TrackEvent } from '@/components/TrackEvent'
import { BuiltChapter } from '@/components/whats-new/BuiltChapter'
import { Contents } from '@/components/whats-new/Contents'
import { LimitsChapter } from '@/components/whats-new/LimitsChapter'
import { LogChapter } from '@/components/whats-new/LogChapter'
import { LooksChapter, PostcardChapter } from '@/components/whats-new/LooksChapter'
import { MemoryChapter } from '@/components/whats-new/MemoryChapter'
import { NotesChapter } from '@/components/whats-new/NotesChapter'
import { PhotoChapter } from '@/components/whats-new/PhotoChapter'
import { PrivacyChapter } from '@/components/whats-new/PrivacyChapter'
import { VoiceChapter } from '@/components/whats-new/VoiceChapter'
import { TextLink } from '@/components/whats-new/parts'
import { FUNNEL_EVENTS } from '@/lib/analytics/events'

export const metadata: Metadata = {
	title: 'What is new in v2',
	description:
		'What Kinpaw v2 added, how each part works and what the tests measured: memory, notes from your pet, a voice, and a pet made from a photo.'
}

/*
 * The reviewers' page: what v2 built in answer to "why would someone open
 * Kinpaw on day 7?", how each part works, and the measured results. A reading
 * page, so it is one column of prose beside its contents list. Every fact is
 * from docs/application/updates/v2.md and docs/application/product.md ("v2
 * decisions"); change it there first.
 */
export default function WhatsNewPage() {
	return (
		<PageShell>
			{/* The landing page's `cta_clicked { cta: 'whats_new' }` over this says how many
          who followed the link arrived. */}
			<TrackEvent name={FUNNEL_EVENTS.whatsNewView} />
			<Container className="pb-28 sm:pb-36">
				<PageHeader
					title="Why you would open Kinpaw on day 7"
					lead="A reviewer asked that question about v1. v2 is the answer: the pet remembers you, it tells you when it misses you, it speaks, and it can look like your real pet. This page says what is built, how each part works and what the tests measured."
				/>
				<p className="mt-5 max-w-[68ch] text-pretty leading-relaxed text-ink-secondary">
					Kinpaw is a hackathon build. Everything described here runs on localhost: a local server,
					the iOS Simulator and an iPhone. It is not in the App Store. To see the features rather
					than read about them, <TextLink href="/#week">spend the week with Mochi</TextLink>.
				</p>

				<div className="mt-14 lg:mt-20 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-x-16">
					<Contents />
					<article className="mt-14 min-w-0 lg:mt-0">
						<BuiltChapter />
						<MemoryChapter />
						<NotesChapter />
						<VoiceChapter />
						<PhotoChapter />
						<LooksChapter />
						<PostcardChapter />
						<LimitsChapter />
						<PrivacyChapter />
						<LogChapter />
					</article>
				</div>
			</Container>
		</PageShell>
	)
}
