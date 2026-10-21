/**
 * A version 4 UUID, made on the phone for a row the server will store: a saved pet, a message to
 * the pet. Its job is to let a retried request find what the first one wrote, so it only has to
 * be unique, not secret: Math.random is enough, and the server decides who owns what (someone
 * else's id is refused). A native crypto module would need a store build for no gain here.
 */
export function newId(): string {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		const r = Math.floor(Math.random() * 16)
		return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
	})
}
