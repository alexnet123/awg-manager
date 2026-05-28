export type AuthState = {
  apiKey: string
}

export function headers(auth: AuthState, extra?: Record<string, string>) {
  return {
    'X-API-Key': auth.apiKey,
    ...(extra || {}),
  }
}

export async function parseError(res: Response): Promise<string> {
  try {
    const payload = await res.json()
    return payload?.error || `HTTP ${res.status}`
  } catch {
    return `HTTP ${res.status}`
  }
}

export async function downloadWithAuth(auth: AuthState, url: string, filename: string) {
  const res = await fetch(url, { headers: headers(auth) })
  if (!res.ok) throw new Error(await parseError(res))
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(objectUrl)
}

export async function downloadBackup(auth: AuthState): Promise<void> {
  await downloadWithAuth(auth, '/backup/download', 'clients.db')
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

export async function restoreBackup(auth: AuthState, file: File): Promise<void> {
  const buffer = await file.arrayBuffer()
  const base64Payload = bytesToBase64(new Uint8Array(buffer))
  const res = await fetch('/backup/restore', {
    method: 'POST',
    headers: headers(auth, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ db_base64: base64Payload }),
  })
  if (!res.ok) throw new Error(await parseError(res))
}
