import { Endpoints } from '#common/constants'
import { ApiContextEnum } from '#common/enums'
import { createImageLinks, useFetch } from '#common/helpers'
import { createSongPayload } from '#modules/songs/helpers'
import type { SongAPIResponseModel, SongModel, SongSuggestionAPIResponseModel } from '#modules/songs/models'
import type { z } from 'zod'

export const NEW_RELEASE_LANGUAGES = ['tamil', 'malayalam', 'hindi', 'english', 'telugu', 'kannada'] as const
export type NewReleaseLanguage = (typeof NEW_RELEASE_LANGUAGES)[number]

interface NewReleaseAPIItem {
  id?: string
  title?: string
  subtitle?: string
  header_desc?: string
  type?: string
  perma_url?: string
  image?: string
  language?: string
  year?: string
  play_count?: string
  explicit_content?: string
  more_info?: {
    release_date?: string
    song_count?: string
    music?: string
    artistMap?: {
      primary_artists?: { id: string; name: string; role?: string; image?: string; perma_url?: string }[]
    }
  }
}

export class DiscoveryService {
  async getNewReleases(language: NewReleaseLanguage, page: number, limit: number) {
    const { data } = await useFetch<NewReleaseAPIItem[] | { data?: NewReleaseAPIItem[]; count?: number }>({
      endpoint: Endpoints.home.newReleases,
      params: { language, p: page, n: limit },
      cacheTTL: 900
    })

    const items = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []

    return items.map((album) => ({
      id: album.id ?? '',
      name: album.title ?? '',
      subtitle: album.subtitle ?? null,
      description: album.header_desc ?? null,
      type: album.type ?? 'album',
      year: album.year ? Number(album.year) : null,
      releaseDate: album.more_info?.release_date ?? null,
      language: album.language ?? language,
      playCount: album.play_count ? Number(album.play_count) : null,
      explicitContent: album.explicit_content === '1',
      songCount: album.more_info?.song_count ? Number(album.more_info.song_count) : null,
      url: album.perma_url ?? '',
      artists: (album.more_info?.artistMap?.primary_artists ?? []).map((artist) => ({
        id: artist.id,
        name: artist.name,
        role: artist.role ?? '',
        url: artist.perma_url ?? '',
        image: createImageLinks(artist.image ?? '')
      })),
      image: createImageLinks(album.image ?? '')
    }))
  }

  async getHomeData() {
    const { data } = await useFetch<Record<string, unknown>>({
      endpoint: Endpoints.home.launchData,
      params: {}
    })

    return data
  }

  async getTopSearches() {
    const { data } = await useFetch<unknown[]>({
      endpoint: Endpoints.home.topSearches,
      params: {}
    })

    return Array.isArray(data) ? data : []
  }

  async createFeaturedRadioStation(name: string) {
    const { data } = await useFetch<{ stationid?: string }>({
      endpoint: Endpoints.radio.featured,
      params: { name },
      context: ApiContextEnum.ANDROID
    })

    return data.stationid || null
  }

  async createArtistRadioStation(name: string, query: string) {
    const { data } = await useFetch<{ stationid?: string }>({
      endpoint: Endpoints.radio.artist,
      params: { name, query },
      context: ApiContextEnum.ANDROID
    })

    return data.stationid || null
  }

  async createEntityRadioStation(entityId: string, entityType: string) {
    const encodedEntityId = entityType === 'queue' ? JSON.stringify([encodeURIComponent(entityId)]) : entityId

    const { data } = await useFetch<{ stationid?: string } | unknown[]>({
      endpoint: Endpoints.radio.entity,
      params: {
        entity_id: encodedEntityId,
        entity_type: entityType
      },
      context: ApiContextEnum.ANDROID
    })

    if (Array.isArray(data)) {
      return null
    }

    return data.stationid || null
  }

  async getRadioSongs(stationId: string, limit: number): Promise<z.infer<typeof SongModel>[]> {
    const { data } = await useFetch<z.infer<typeof SongSuggestionAPIResponseModel> | { error?: string }>({
      endpoint: Endpoints.radio.songs,
      params: {
        stationid: stationId,
        k: limit
      },
      context: ApiContextEnum.ANDROID
    })

    if ('error' in data && data.error) {
      return []
    }

    const suggestions = Object.values(data)
      .filter((item): item is { song: z.infer<typeof SongAPIResponseModel> } => {
        return typeof item === 'object' && item !== null && 'song' in item
      })
      .map((item) => createSongPayload(item.song))
      .slice(0, limit)

    return suggestions
  }

  async getSongRecommendations(songId: string): Promise<z.infer<typeof SongModel>[]> {
    const { data } = await useFetch<Record<string, z.infer<typeof SongAPIResponseModel>[]> | unknown[]>({
      endpoint: Endpoints.recommendations.songs,
      params: { pid: songId },
      context: ApiContextEnum.ANDROID
    })

    if (Array.isArray(data)) {
      return []
    }

    const candidates = Array.isArray(data[songId]) ? data[songId] : Object.values(data).flat()

    return candidates.map((song) => createSongPayload(song))
  }

  async getAlbumRecommendations(albumId: string) {
    const { data } = await useFetch<unknown[]>({
      endpoint: Endpoints.recommendations.albums,
      params: { albumid: albumId },
      context: ApiContextEnum.ANDROID
    })

    return Array.isArray(data) ? data : []
  }

  async getArtistOtherTopSongs(artistIds: string, songId: string): Promise<z.infer<typeof SongModel>[]> {
    const { data } = await useFetch<z.infer<typeof SongAPIResponseModel>[]>({
      endpoint: Endpoints.recommendations.artistOtherTopSongs,
      params: {
        artist_ids: artistIds,
        song_id: songId
      },
      context: ApiContextEnum.ANDROID
    })

    if (!Array.isArray(data)) {
      return []
    }

    return data.map((song) => createSongPayload(song))
  }
}
