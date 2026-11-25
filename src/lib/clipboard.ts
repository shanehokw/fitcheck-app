// Reading a copied photo. Two ways in:
// 1. A "Paste" button: navigator.clipboard.read(). Safari shows its own "Paste" bubble; Chrome may ask once.
// 2. Cmd/Ctrl+V on a page: the paste event carries the image file.

export const canReadClipboard = () => typeof navigator !== 'undefined' && typeof navigator.clipboard?.read === 'function'

export async function readClipboardImage(): Promise<Blob> {
  let items: ClipboardItems
  try {
    items = await navigator.clipboard.read()
  } catch (e) {
    if ((e as Error).name === 'NotAllowedError') throw new Error('Paste was blocked. Allow clipboard access, or upload the photo instead.')
    throw new Error('Could not read the clipboard.')
  }
  for (const item of items) {
    const type = item.types.find((t) => t.startsWith('image/'))
    if (type) return item.getType(type)
  }
  throw new Error('No photo on the clipboard. Copy a photo first.')
}

/** The first image in a paste event, or null. */
export function imageFromPaste(e: ClipboardEvent): File | null {
  for (const item of e.clipboardData?.items ?? []) {
    if (item.kind === 'file' && item.type.startsWith('image/')) return item.getAsFile()
  }
  return null
}
