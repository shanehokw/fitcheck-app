import { useEffect, useState } from 'react'
import { ReactCrop, type PercentCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { compressImage } from '../lib/image'

const FULL: PercentCrop = { unit: '%', x: 0, y: 0, width: 100, height: 100 }

interface Props {
  /** The image to crop: the original file on upload, or the saved photo on re-crop. */
  image: Blob
  /** Receives the cropped, resized image (max 1600 px). Uncropped images are still resized. */
  onDone: (result: Blob) => void | Promise<void>
  onCancel: () => void
  /** Disable Save until the selection differs from the full image (re-crop of a saved photo). */
  requireChange?: boolean
}

export function CropEditor({ image, onDone, onCancel, requireChange = false }: Props) {
  // Normally the original. If the browser cannot show it in <img> (for example HEIC outside Safari),
  // switch to a resized copy, which createImageBitmap can often still decode.
  const [source, setSource] = useState<Blob>(image)
  const [url, setUrl] = useState<string>()
  const [crop, setCrop] = useState<PercentCrop>(FULL)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    const u = URL.createObjectURL(source)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [source])

  async function onImgError() {
    if (source !== image) {
      setError('This image format cannot be opened. Try a JPEG or PNG.')
      return
    }
    try {
      setSource(await compressImage(image))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const isFull = crop.width >= 99.5 && crop.height >= 99.5

  async function save() {
    setBusy(true)
    setError(undefined)
    try {
      const out = await compressImage(
        source,
        isFull ? undefined : { x: crop.x / 100, y: crop.y / 100, width: crop.width / 100, height: crop.height / 100 },
      )
      await onDone(out)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="crop-overlay" role="dialog" aria-modal="true" aria-label="Crop photo">
      <div className="crop-stage">
        {url && (
          <ReactCrop crop={crop} keepSelection ruleOfThirds minWidth={40} minHeight={40} onChange={(_px, pct) => setCrop(pct)}>
            <img src={url} alt="Photo to crop" className="crop-img" onError={onImgError} />
          </ReactCrop>
        )}
      </div>
      <div className="crop-bar">
        {error && <p className="error">{error}</p>}
        <div className="row crop-actions">
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="btn primary" onClick={save} disabled={busy || (requireChange && isFull)}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
