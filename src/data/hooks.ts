import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { getPhoto } from './photos'
import {
  collectionIdsForLook, getCollection, getLook, getPiece, getSetting, getTagLists, listCollections, listLookSummaries, listPieces,
} from './repo'

// UI reads data only through these hooks. `undefined` means still loading; `null` means not found.
export const useLookSummaries = () => useLiveQuery(listLookSummaries, [])
export const useLook = (id: string) => useLiveQuery(() => getLook(id), [id])
export const usePieces = () => useLiveQuery(listPieces, [])
export const usePiece = (id: string) => useLiveQuery(() => getPiece(id), [id])
export const useCollections = () => useLiveQuery(listCollections, [])
export const useCollection = (id: string) => useLiveQuery(() => getCollection(id), [id])
export const useLookCollectionIds = (lookId: string) => useLiveQuery(() => collectionIdsForLook(lookId), [lookId])
export const useTagLists = () => useLiveQuery(getTagLists, [])
export const useSetting = <T,>(key: string, fallback: T) => useLiveQuery(() => getSetting(key, fallback), [key])

export const usePhotoBlob = (photoId?: string) =>
  useLiveQuery(() => (photoId ? getPhoto(photoId) : undefined), [photoId])

export function usePhotoUrl(photoId?: string): string | undefined {
  const blob = usePhotoBlob(photoId)
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) {
      setUrl(undefined)
      return
    }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}
