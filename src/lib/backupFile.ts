import { exportBackup, markBackedUp } from '../data/backup'
import { isIOS } from './platform'

/**
 * Builds the backup ZIP and hands it to the user: the share sheet on iPhone (so it can go to Files),
 * a download elsewhere. Records the time, which resets the backup reminder.
 * Returns the file name, or null when the user cancelled the share sheet.
 */
export async function saveBackupFile(): Promise<string | null> {
  const blob = await exportBackup()
  const name = `fitcheck-backup-${new Date().toISOString().slice(0, 10)}.zip`
  const file = new File([blob], name, { type: 'application/zip' })
  if (isIOS() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name })
      await markBackedUp()
      return name
    } catch (e) {
      if ((e as Error).name === 'AbortError') return null
      // share not allowed (for example, too long after the tap): fall back to a download
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  await markBackedUp()
  return name
}
