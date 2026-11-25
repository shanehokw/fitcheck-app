import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { backupStatus, snoozeBackupReminder } from '../data/backup'
import { saveBackupFile } from '../lib/backupFile'

/** Shown when the last export is over 7 days old, or 10+ looks and pieces were added since. */
export function BackupReminder() {
  const status = useLiveQuery(() => backupStatus(), [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  if (!status?.due) return null

  const days = status.daysSince
  const when = days === undefined ? 'You have never backed up.' : `Last backup ${days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} ago`}.`
  const added = status.added > 0 ? ` ${status.added} looks and pieces added since.` : ''

  return (
    <div className="banner" role="note">
      <p>
        <strong>Back up your data.</strong> {when}{added} Clearing Safari's website data deletes everything.
        {error && <span className="error"> {error}</span>}
      </p>
      <div className="row banner-actions">
        <button
          type="button"
          className="btn small primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            setError(undefined)
            try { await saveBackupFile() } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
          }}
        >
          {busy ? 'Saving…' : 'Back up now'}
        </button>
        <button type="button" className="btn small" disabled={busy} onClick={() => snoozeBackupReminder()}>Later</button>
      </div>
    </div>
  )
}
