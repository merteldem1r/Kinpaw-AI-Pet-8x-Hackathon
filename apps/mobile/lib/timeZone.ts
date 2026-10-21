import { localDay } from '@app/contract'

/**
 * The phone's IANA time zone ("Europe/Istanbul"): no permission and no native
 * module, read from the JavaScript runtime. The needs decay in it on the phone,
 * and every care action sends it, so the server's night window is the same one
 * the person sees (docs/application/features/m5-home-core-loop-requirements.md,
 * Decision 3). UTC if the runtime can't say, which only shifts the night.
 */
export function deviceTimeZone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
	} catch {
		return 'UTC'
	}
}

/** Today on the phone, as YYYY-MM-DD in its own time zone: for "Tomorrow", "Was Friday". */
export function localDayNow(): string {
	return localDay(new Date(), deviceTimeZone())
}
