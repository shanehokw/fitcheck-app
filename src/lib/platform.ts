export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isIOS(): boolean {
  const ua = navigator.userAgent
  // iPadOS 13+ reports as Mac; detect by touch support.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

export async function requestPersist(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  if (await navigator.storage.persisted()) return true
  return navigator.storage.persist()
}

export async function storageStatus(): Promise<{ persisted: boolean; usedMB?: number; quotaMB?: number }> {
  const persisted = (await navigator.storage?.persisted?.()) ?? false
  const est = await navigator.storage?.estimate?.()
  const mb = (n?: number) => (n === undefined ? undefined : Math.round((n / 1024 / 1024) * 10) / 10)
  return { persisted, usedMB: mb(est?.usage), quotaMB: mb(est?.quota) }
}
