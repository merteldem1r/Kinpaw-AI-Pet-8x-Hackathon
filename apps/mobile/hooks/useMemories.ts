import { useEffect, useState } from 'react'
import {
	keepPreviousData,
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
	type InfiniteData
} from '@tanstack/react-query'
import { MEMORY_PAGE_MAX, type PetMemoriesResponse } from '@app/contract'
import { useToast } from '@/contexts/ToastContext'
import { api } from '@/lib/api'
import { deviceTimeZone } from '@/lib/timeZone'

// What the pet remembers (docs/application/features/v2-memory-requirements.md, R16–R17), through
// GET /api/app/v1/pet/memories. Two views of the same facts: the pet's page shows the newest few
// (`useMemoryPreview`), and "Mochi remembers" pages through all of them with a search
// (`useMemoryPages`). Every cached view lives under MEMORIES_QUERY_KEY, so one invalidation (a
// fact kept while talking, one forgotten) refreshes them all.

export const MEMORIES_QUERY_KEY = ['pet', 'memories'] as const
/** How many the pet's page shows before "Manage all". */
export const MEMORY_PREVIEW = 5
/** How long typing must pause before the search is sent. */
const SEARCH_DEBOUNCE_MS = 300

type Pages = InfiniteData<PetMemoriesResponse, string | undefined>

/** The newest MEMORY_PREVIEW facts, with the totals. Only while signed in with a pet. */
export function useMemoryPreview(enabled = true) {
	return useQuery<PetMemoriesResponse>({
		queryKey: [...MEMORIES_QUERY_KEY, 'preview'],
		queryFn: ({ signal }) =>
			api('petMemories', {
				query: { time_zone: deviceTimeZone(), limit: MEMORY_PREVIEW },
				signal
			}),
		enabled
	})
}

/**
 * Every fact, a page of MEMORY_PAGE_MAX at a time, newest first, for `search` (empty: all).
 * While a new search loads, the last results stay on screen instead of a blank list.
 */
export function useMemoryPages(search: string) {
	return useInfiniteQuery({
		queryKey: [...MEMORIES_QUERY_KEY, 'pages', search],
		queryFn: ({ pageParam, signal }) =>
			api('petMemories', {
				query: {
					time_zone: deviceTimeZone(),
					q: search || undefined,
					cursor: pageParam,
					limit: MEMORY_PAGE_MAX
				},
				signal
			}),
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (last) => last.next_cursor ?? undefined,
		placeholderData: keepPreviousData
	})
}

/** `value`, once it has stopped changing for `ms`: what the search box sends. */
export function useDebounced<T>(value: T, ms: number = SEARCH_DEBOUNCE_MS): T {
	const [settled, setSettled] = useState(value)
	useEffect(() => {
		const t = setTimeout(() => setSettled(value), ms)
		return () => clearTimeout(t)
	}, [value, ms])
	return settled
}

/** One cached view without the fact `id`, its counts one lower. */
function without(id: string, page: PetMemoriesResponse): PetMemoriesResponse {
	if (!page.memories.some((memory) => memory.id === id)) return page
	return {
		...page,
		memories: page.memories.filter((memory) => memory.id !== id),
		total: Math.max(0, page.total - 1),
		matched: Math.max(0, page.matched - 1)
	}
}

/**
 * Forgets one fact: gone from every list at once (the preview and every search's pages), back
 * with a message if the server refuses, then refreshed from the server either way. `from` says
 * where (the list, or the intro's chips) for `memory_deleted`, recorded by the server.
 */
export function useForgetMemory(from: 'list' | 'intro') {
	const queryClient = useQueryClient()
	const { showToast } = useToast()
	return useMutation({
		mutationFn: (id: string) => api('deletePetMemory', { params: { id }, query: { from } }),
		onMutate: async (id) => {
			await queryClient.cancelQueries({ queryKey: MEMORIES_QUERY_KEY })
			const before = queryClient.getQueriesData<PetMemoriesResponse | Pages>({
				queryKey: MEMORIES_QUERY_KEY
			})
			queryClient.setQueriesData<PetMemoriesResponse | Pages>(
				{ queryKey: MEMORIES_QUERY_KEY },
				(data) => {
					if (!data) return data
					if ('pages' in data)
						return { ...data, pages: data.pages.map((page) => without(id, page)) }
					return without(id, data)
				}
			)
			return { before }
		},
		onError: (_error, _id, context) => {
			for (const [key, data] of context?.before ?? []) queryClient.setQueryData(key, data)
			showToast("Couldn't forget that just now. Try again.", 'error')
		},
		onSettled: () => queryClient.invalidateQueries({ queryKey: MEMORIES_QUERY_KEY })
	})
}
