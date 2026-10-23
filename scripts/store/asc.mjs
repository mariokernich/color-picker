// Minimal App Store Connect API client. Needs an API key with the App Manager role:
// ASC_KEY_ID and ASC_ISSUER (App Store Connect → Users and Access → Integrations), and the key
// file in ~/.appstoreconnect/private_keys/AuthKey_<ASC_KEY_ID>.p8 (or ASC_KEY_PATH).
import { createPrivateKey, sign } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const KEY_ID = process.env.ASC_KEY_ID
const ISSUER = process.env.ASC_ISSUER
if (!KEY_ID || !ISSUER) throw new Error('Set ASC_KEY_ID and ASC_ISSUER.')
const key = createPrivateKey(
  readFileSync(
    process.env.ASC_KEY_PATH ??
      join(homedir(), '.appstoreconnect', 'private_keys', `AuthKey_${KEY_ID}.p8`)
  )
)

function token() {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const header = encode({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })
  const payload = encode({ iss: ISSUER, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' })
  const signature = sign('sha256', Buffer.from(`${header}.${payload}`), {
    key,
    dsaEncoding: 'ieee-p1363'
  }).toString('base64url')
  return `${header}.${payload}.${signature}`
}

export async function asc(method, path, body) {
  const response = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status}\n${text}`)
  return text ? JSON.parse(text) : null
}

/** `{ data: { type, id?, attributes?, relationships? } }`; relationships as `name: [type, id]`. */
export function resource(type, attributes, relationships = {}, id) {
  const links = Object.entries(relationships).map(([name, [kind, value]]) => [
    name,
    { data: { type: kind, id: value } }
  ])
  return {
    data: {
      type,
      ...(id ? { id } : {}),
      ...(Object.keys(attributes).length ? { attributes } : {}),
      ...(links.length ? { relationships: Object.fromEntries(links) } : {})
    }
  }
}
