import { usePhotoUrl } from '../data/hooks'

export function Photo({ photoId, alt, className }: { photoId?: string; alt: string; className?: string }) {
  const url = usePhotoUrl(photoId)
  return url ? <img src={url} alt={alt} className={className} /> : <div className={`${className ?? ''} photo-placeholder`} />
}
