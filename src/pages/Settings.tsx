import { useEffect, useRef, useState } from 'react'
import { TagListEditor } from '../components/TagListEditor'
import { importBackup } from '../data/backup'
import { useTagLists } from '../data/hooks'
import { saveBackupFile } from '../lib/backupFile'
import { requestPersist, storageStatus } from '../lib/platform'

export function Settings() {
  const tags = useTagLists()
  const [storage, setStorage] = useState<Awaited<ReturnType<typeof storageStatus>>>()
  const [msg, setMsg] = useState<string>()
  const [pending, setPending] = useState<File>()
  const fileInput = useRef<HTMLInputElement>(null)

  const refresh = () => storageStatus().then(setStorage)
  useEffect(() => { void refresh() }, [])

  async function doExport() {
    setMsg(undefined)
    try {
      const name = await saveBackupFile()
      if (name) setMsg(`Exported ${name}. Keep it private: it contains all your photos.`)
    } catch (e) {
      setMsg((e as Error).message)
    }
  }

  async function doImport(mode: 'merge' | 'replace') {
    if (!pending) return
    if (mode === 'replace' && !confirm('Replace ALL current looks, pieces, collections and photos with the backup? Current data will be deleted. This cannot be undone.')) return
    try {
      const r = await importBackup(pending, mode)
      setMsg(`Imported ${r.looks} looks, ${r.pieces} pieces, ${r.collections} collections, ${r.photos} photos.`)
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setPending(undefined)
      if (fileInput.current) fileInput.current.value = ''
      void refresh()
    }
  }

  return (
    <main className="page">
      <h1>Settings</h1>

      <section className="card stack">
        <h2>Backup</h2>
        <p className="muted">Your data lives only on this phone. Export a backup now and then.</p>
        <button type="button" className="btn primary" onClick={doExport}>Export backup (.zip)</button>
        <label className="btn">
          Import backup…
          <input ref={fileInput} type="file" accept=".zip,application/zip" hidden onChange={(e) => setPending(e.target.files?.[0])} />
        </label>
        {pending && (
          <div className="stack">
            <p>Import <strong>{pending.name}</strong>:</p>
            <div className="row">
              <button type="button" className="btn primary" onClick={() => doImport('merge')}>Merge</button>
              <button type="button" className="btn danger" onClick={() => doImport('replace')}>Replace all</button>
              <button type="button" className="btn" onClick={() => setPending(undefined)}>Cancel</button>
            </div>
          </div>
        )}
        {msg && <p role="status">{msg}</p>}
      </section>

      <section className="card stack">
        <h2>Storage</h2>
        <table className="table">
          <tbody>
            <tr><td>Protected from auto-clear</td><td className="num">{storage ? (storage.persisted ? 'Yes' : 'No') : '…'}</td></tr>
            {storage?.usedMB !== undefined && <tr><td>Used</td><td className="num">{storage.usedMB} MB</td></tr>}
          </tbody>
        </table>
        {storage && !storage.persisted && (
          <button type="button" className="btn" onClick={() => requestPersist().then(refresh)}>Ask browser to keep data</button>
        )}
      </section>

      <section className="card stack">
        <h2>Categories</h2>
        {tags && <TagListEditor kind="categories" values={tags.categories} />}
      </section>
      <section className="card stack">
        <h2>Styles</h2>
        {tags && <TagListEditor kind="styles" values={tags.styles} />}
      </section>

      <p className="muted small-print">Fitcheck keeps everything on this device. Nothing is uploaded.</p>
    </main>
  )
}
