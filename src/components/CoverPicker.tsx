import { useRef, useState } from 'react'
import { CropEditor } from './CropEditor'
import { PasteButton } from './PasteButton'

/** Photo buttons: pick a file or paste a copied photo, crop it, get the result. */
export function CoverPicker({ label, onPicked }: { label: string; onPicked: (cover: Blob) => void | Promise<void> }) {
  const [image, setImage] = useState<Blob>()
  const [error, setError] = useState<string>()
  const input = useRef<HTMLInputElement>(null)
  const take = (b?: Blob) => {
    setError(undefined)
    setImage(b)
  }
  return (
    <>
      <label className="btn">
        {label}
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            take(e.target.files?.[0])
            if (input.current) input.current.value = ''
          }}
        />
      </label>
      <PasteButton onImage={take} onError={setError} />
      {error && <p className="error full-row">{error}</p>}
      {image && (
        <CropEditor
          image={image}
          onCancel={() => setImage(undefined)}
          onDone={async (b) => {
            await onPicked(b)
            setImage(undefined)
          }}
        />
      )}
    </>
  )
}
