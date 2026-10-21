import { Fragment } from 'react'

/**
 * A paragraph whose words light up as it is scrolled into reading position:
 * each word starts dim and is full by the time it reaches the upper middle of
 * the screen (`.scrub-word` in globals.css, a scroll-driven CSS animation, so
 * it costs no script). Where scroll-driven CSS is missing, and under Reduce
 * Motion, the words are simply there. Screen readers read the sentence as
 * text: the words are plain spans.
 */
export function ScrubText({ text }: { text: string }) {
	const words = text.split(' ')
	return words.map((word, i) => (
		<Fragment key={i}>
			<span className="scrub-word">{word}</span>
			{i < words.length - 1 ? ' ' : null}
		</Fragment>
	))
}
