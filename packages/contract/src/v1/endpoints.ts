import type { z } from 'zod'
import { deleteAccountResponse } from './account'
import { appConfigSchema } from './config'
import {
	createPetBody,
	createPetResponse,
	updatePetBody,
	updatePetResponse,
	petActionBody,
	petActionResponse,
	petResponse
} from './pets'
import {
	deletePetMemoryParams,
	deletePetMemoryQuery,
	deletePetMemoryResponse,
	petMemoriesQuery,
	petMemoriesResponse
} from './memory'
import {
	addFriendBody,
	addFriendResponse,
	getFriendsQuery,
	getFriendsResponse,
	lookupFriendBody,
	lookupFriendResponse,
	removeFriendParams,
	removeFriendResponse,
	resetFriendCodeBody,
	resetFriendCodeResponse
} from './friends'
import { greetingBody, greetingResponse } from './greeting'
import { voiceBody, voiceResponse } from './voice'
import { introBody, introResponse } from './intro'
import {
	PHOTO_MAX_BODY_BYTES,
	photoReadResponse,
	readPetPhotoBody,
	redoPetPhotoBody
} from './photo'
import { profileResponse, updateProfileBody } from './profile'
import { talkBody, talkResponse } from './talk'
import { createUploadBody, createUploadResponse } from './uploads'

// Every /api/app/v1 route, once: its method, path, who may call it, and the
// schemas for what goes in and what comes back. The web builds each route from
// its entry (src/server/api/app-route.ts); the app's API client
// (apps/mobile/lib/api.ts) calls routes by name and parses responses with the
// same schemas.

export type Endpoint = {
	method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
	/** `:name` marks a path parameter, validated by `params`. */
	path: `/api/app/v1/${string}`
	/** `user`: a Supabase access token as `Authorization: Bearer …`. */
	auth: 'user' | 'public'
	query?: z.ZodType
	params?: z.ZodType
	body?: z.ZodType
	response: z.ZodType
	/** The success status. A POST that finds its `id` already created answers 200. */
	status: 200 | 201
	/**
	 * A body larger than this (by `Content-Length`) is refused before it is read. Unset: no limit
	 * of the route's own. For the photo routes, whose body is an image.
	 */
	maxBodyBytes?: number
}

export const endpoints = {
	getConfig: {
		method: 'GET',
		path: '/api/app/v1/config',
		auth: 'public',
		response: appConfigSchema,
		status: 200
	},
	getProfile: {
		method: 'GET',
		path: '/api/app/v1/profile',
		auth: 'user',
		response: profileResponse,
		status: 200
	},
	updateProfile: {
		method: 'PATCH',
		path: '/api/app/v1/profile',
		auth: 'user',
		body: updateProfileBody,
		response: profileResponse,
		status: 200
	},
	getPet: {
		method: 'GET',
		path: '/api/app/v1/pet',
		auth: 'user',
		response: petResponse,
		status: 200
	},
	createPet: {
		method: 'POST',
		path: '/api/app/v1/pet',
		auth: 'user',
		body: createPetBody,
		response: createPetResponse,
		status: 201
	},
	updatePet: {
		method: 'PATCH',
		path: '/api/app/v1/pet',
		auth: 'user',
		body: updatePetBody,
		response: updatePetResponse,
		status: 200
	},
	petAction: {
		method: 'POST',
		path: '/api/app/v1/pet/actions',
		auth: 'user',
		body: petActionBody,
		response: petActionResponse,
		status: 200
	},
	petTalk: {
		method: 'POST',
		path: '/api/app/v1/pet/talk',
		auth: 'user',
		body: talkBody,
		response: talkResponse,
		status: 200
	},
	/** What the pet remembers (v2-memory-requirements.md, R16–R17). */
	petMemories: {
		method: 'GET',
		path: '/api/app/v1/pet/memories',
		auth: 'user',
		query: petMemoriesQuery,
		response: petMemoriesResponse,
		status: 200
	},
	deletePetMemory: {
		method: 'DELETE',
		path: '/api/app/v1/pet/memories/:id',
		auth: 'user',
		params: deletePetMemoryParams,
		query: deletePetMemoryQuery,
		response: deletePetMemoryResponse,
		status: 200
	},
	/** "Tell me about you" (v2-memory-requirements.md, R18–R25): send, or skip for good. */
	petIntro: {
		method: 'POST',
		path: '/api/app/v1/pet/intro',
		auth: 'user',
		body: introBody,
		response: introResponse,
		status: 200
	},
	/** "I missed you" (v2-memory-requirements.md, R26–R28): on open, how long away, a due question. */
	petGreeting: {
		method: 'POST',
		path: '/api/app/v1/pet/greeting',
		auth: 'user',
		body: greetingBody,
		response: greetingResponse,
		status: 200
	},
	/** Mochi speaks (v2-voice-requirements.md, R1–R6): a reply just counted, in the pet's voice. */
	petVoice: {
		method: 'POST',
		path: '/api/app/v1/pet/voice',
		auth: 'user',
		body: voiceBody,
		response: voiceResponse,
		status: 200
	},
	/** Friends (v2-friends-requirements.md, R17–R21): the caller's code and their friends' pets. */
	getFriends: {
		method: 'GET',
		path: '/api/app/v1/friends',
		auth: 'user',
		query: getFriendsQuery,
		response: getFriendsResponse,
		status: 200
	},
	/** Whose code this is, before adding. Writes nothing. */
	lookupFriend: {
		method: 'POST',
		path: '/api/app/v1/friends/lookup',
		auth: 'user',
		body: lookupFriendBody,
		response: lookupFriendResponse,
		status: 200
	},
	/** Add, for both people. 200 when already friends. */
	addFriend: {
		method: 'POST',
		path: '/api/app/v1/friends',
		auth: 'user',
		body: addFriendBody,
		response: addFriendResponse,
		status: 201
	},
	removeFriend: {
		method: 'DELETE',
		path: '/api/app/v1/friends/:id',
		auth: 'user',
		params: removeFriendParams,
		response: removeFriendResponse,
		status: 200
	},
	/** A new code for the caller; the old one stops working. */
	resetFriendCode: {
		method: 'POST',
		path: '/api/app/v1/friends/code',
		auth: 'user',
		body: resetFriendCodeBody,
		response: resetFriendCodeResponse,
		status: 200
	},
	deleteAccount: {
		method: 'DELETE',
		path: '/api/app/v1/account',
		auth: 'user',
		response: deleteAccountResponse,
		status: 200
	},
	createUpload: {
		method: 'POST',
		path: '/api/app/v1/uploads',
		auth: 'user',
		body: createUploadBody,
		response: createUploadResponse,
		status: 201
	},
	/** Signed out, while creating the pet: limited per iPhone, network and day (photo.ts). */
	readPetPhoto: {
		method: 'POST',
		path: '/api/app/v1/pet/photo/read',
		auth: 'public',
		body: readPetPhotoBody,
		response: photoReadResponse,
		status: 200,
		maxBodyBytes: PHOTO_MAX_BODY_BYTES
	},
	/** Plus only, once a local day: a new look for the caller's pet, not saved until PATCH pet. */
	redoPetPhoto: {
		method: 'POST',
		path: '/api/app/v1/pet/photo/redo',
		auth: 'user',
		body: redoPetPhotoBody,
		response: photoReadResponse,
		status: 200,
		maxBodyBytes: PHOTO_MAX_BODY_BYTES
	}
} as const satisfies Record<string, Endpoint>

export type EndpointName = keyof typeof endpoints
