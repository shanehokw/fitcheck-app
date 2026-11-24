import { db } from './dexie/db'

export async function putPhoto(blob: Blob): Promise<string> {
  const id = crypto.randomUUID()
  await db.photos.put({ id, blob, createdAt: Date.now() })
  return id
}

export async function getPhoto(id: string): Promise<Blob | undefined> {
  return (await db.photos.get(id))?.blob
}

export async function deletePhoto(id: string): Promise<void> {
  await db.photos.delete(id)
}
