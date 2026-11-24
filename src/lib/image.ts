const MAX_SIDE = 1600

/** Area to keep, as fractions (0–1) of the image width and height. */
export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

/** Resize to max 1600 px on the long side. WebP when the browser can encode it, else JPEG. */
export async function compressImage(file: Blob, crop?: CropRect): Promise<Blob> {
  const source = await decode(file)
  const c = crop ?? { x: 0, y: 0, width: 1, height: 1 }
  const sx = Math.round(c.x * source.width)
  const sy = Math.round(c.y * source.height)
  const sw = Math.max(1, Math.round(c.width * source.width))
  const sh = Math.max(1, Math.round(c.height * source.height))
  const scale = Math.min(1, MAX_SIDE / Math.max(sw, sh))
  const w = Math.round(sw * scale)
  const h = Math.round(sh * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not available')
  ctx.drawImage(source.image, sx, sy, sw, sh, 0, 0, w, h)
  source.close()

  const webp = await toBlob(canvas, 'image/webp', 0.82)
  if (webp && webp.type === 'image/webp') return webp
  const jpeg = await toBlob(canvas, 'image/jpeg', 0.85)
  if (!jpeg) throw new Error('Could not encode image')
  return jpeg
}

interface Decoded {
  image: CanvasImageSource
  width: number
  height: number
  close(): void
}

async function decode(file: Blob): Promise<Decoded> {
  if ('createImageBitmap' in window) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { image: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() }
    } catch {
      // fall through to <img> decoding (older Safari, some HEIC cases)
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return { image: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} }
  } catch {
    throw new Error('This image format cannot be opened. Try a JPEG or PNG.')
  } finally {
    URL.revokeObjectURL(url)
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}
