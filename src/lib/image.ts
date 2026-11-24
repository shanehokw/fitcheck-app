const MAX_SIDE = 1600

/** Resize to max 1600 px on the long side. WebP when the browser can encode it, else JPEG. */
export async function compressImage(file: Blob): Promise<Blob> {
  const source = await decode(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(source.width, source.height))
  const w = Math.round(source.width * scale)
  const h = Math.round(source.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not available')
  ctx.drawImage(source.image, 0, 0, w, h)
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
