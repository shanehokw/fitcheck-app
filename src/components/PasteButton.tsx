import { canReadClipboard, readClipboardImage } from '../lib/clipboard'

interface Props {
  onImage: (b: Blob) => void
  onError: (message: string) => void
  className?: string
  disabled?: boolean
}

/** "Paste" button for a copied photo. Hidden in browsers that cannot read images from the clipboard. */
export function PasteButton({ onImage, onError, className = 'btn', disabled }: Props) {
  if (!canReadClipboard()) return null
  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      onClick={async () => {
        try {
          onImage(await readClipboardImage())
        } catch (e) {
          onError((e as Error).message)
        }
      }}
    >
      Paste
    </button>
  )
}
