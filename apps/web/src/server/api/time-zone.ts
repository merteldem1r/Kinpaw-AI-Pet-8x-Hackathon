import { isValidTimeZone } from '@app/contract'
import { invalidInput } from './app-errors'

/**
 * The caller's time zone, or a 400. The contract only checks it is a short string, since the
 * phone may know zones this server doesn't; the server checks it can compute days and nights in
 * it before anything is read or written.
 */
export function requireTimeZone(timeZone: string): string {
	if (!isValidTimeZone(timeZone)) {
		throw invalidInput({ path: 'time_zone', message: 'Not a time zone this server knows.' })
	}
	return timeZone
}
