import { useRef, useState } from 'react'
import { CropEditor } from './CropEditor'

/** "Add/Change cover" button: pick a photo, crop it, get the result. */
export function CoverPicker({ label, onPicked }: { label: string; onPicked: (cover: Blob) => void | Promise<void> }) {
  const [file, setFile] = useState<File>()
  const input = useRef<HTMLInputElement>(null)
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
            setFile(e.target.files?.[0])
            if (input.current) input.current.value = ''
          }}
        />
      </label>
      {file && (
        <CropEditor
          image={file}
          onCancel={() => setFile(undefined)}
          onDone={async (b) => {
            await onPicked(b)
            setFile(undefined)
          }}
        />
      )}
    </>
  )
}
