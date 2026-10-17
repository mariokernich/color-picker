/**
 * Minimal reader for the Mac App Store receipt (PKCS#7, BER encoded). It extracts the
 * subscription records the app needs to decide whether the user is entitled.
 *
 * The signature is NOT verified. This is a client-side convenience check; anything that must
 * be tamper proof belongs on a server using the App Store Server API.
 */

interface BerNode {
  tag: number
  constructed: boolean
  /** Primitive content, or the concatenated content of a constructed string. */
  content: Buffer
  children: BerNode[]
}

const TAG = { integer: 0x02, octetString: 0x04, utf8String: 0x0c, ia5String: 0x16, sequence: 0x10, set: 0x11 }

function parseNode(buffer: Buffer, offset: number): { node: BerNode; end: number } {
  if (offset + 2 > buffer.length) throw new Error('Unexpected end of data')
  const first = buffer[offset]
  const constructed = (first & 0x20) !== 0
  let tag = first & 0x1f
  let position = offset + 1
  if (tag === 0x1f) {
    tag = 0
    let byte: number
    do {
      byte = buffer[position++]
      tag = (tag << 7) | (byte & 0x7f)
    } while (byte & 0x80)
  }
  // Context-specific and application tags are kept distinguishable from universal ones.
  const tagClass = first & 0xc0
  if (tagClass !== 0) tag = (tagClass << 8) | tag

  let length = buffer[position++]
  const indefinite = length === 0x80
  if (length & 0x80 && !indefinite) {
    const bytes = length & 0x7f
    if (bytes > 4) throw new Error('Length too large')
    length = 0
    for (let i = 0; i < bytes; i++) length = length * 256 + buffer[position++]
  }

  if (!constructed) {
    if (indefinite) throw new Error('Indefinite length on primitive value')
    const end = position + length
    if (end > buffer.length) throw new Error('Value exceeds data')
    return { node: { tag, constructed, content: buffer.subarray(position, end), children: [] }, end }
  }

  const children: BerNode[] = []
  let end: number
  if (indefinite) {
    while (!(buffer[position] === 0 && buffer[position + 1] === 0)) {
      const child = parseNode(buffer, position)
      children.push(child.node)
      position = child.end
    }
    end = position + 2
  } else {
    end = position + length
    if (end > buffer.length) throw new Error('Value exceeds data')
    while (position < end) {
      const child = parseNode(buffer, position)
      children.push(child.node)
      position = child.end
    }
  }
  // BER allows octet strings to be split into constructed chunks.
  const content =
    tag === TAG.octetString ? Buffer.concat(children.map((child) => child.content)) : Buffer.alloc(0)
  return { node: { tag, constructed, content, children }, end }
}

export function parseBer(buffer: Buffer): BerNode {
  return parseNode(buffer, 0).node
}

function readInteger(node: BerNode): number {
  let value = 0
  for (const byte of node.content) value = value * 256 + byte
  return value
}

/** Decodes an attribute value, which is itself a BER encoded primitive. */
function decodeValue(content: Buffer): string | number | null {
  try {
    const node = parseBer(content)
    if (node.tag === TAG.integer) return readInteger(node)
    if (node.tag === TAG.utf8String || node.tag === TAG.ia5String) return node.content.toString('utf8')
  } catch {
    // Unknown or malformed values are ignored.
  }
  return null
}

function readAttributes(set: BerNode): Map<number, Buffer[]> {
  const attributes = new Map<number, Buffer[]>()
  for (const item of set.children) {
    const [type, , value] = item.children
    if (!type || !value || type.tag !== TAG.integer || value.tag !== TAG.octetString) continue
    const key = readInteger(type)
    attributes.set(key, [...(attributes.get(key) ?? []), value.content])
  }
  return attributes
}

export interface InAppRecord {
  productId: string
  purchaseDate: number | null
  expiresDate: number | null
  cancellationDate: number | null
  isIntroOfferPeriod: boolean
}

const parseDate = (value: string | number | null): number | null => {
  if (typeof value !== 'string' || !value) return null
  const time = Date.parse(value)
  return isNaN(time) ? null : time
}

const IN_APP = { productId: 1702, purchaseDate: 1704, expiresDate: 1708, cancellationDate: 1712, introOffer: 1719 }
const RECEIPT_IN_APP = 17

/** Returns the in-app purchase records of an App Store receipt. Throws on malformed input. */
export function readInAppRecords(receipt: Buffer): InAppRecord[] {
  const contentInfo = parseBer(receipt)
  // ContentInfo -> [0] -> SignedData -> encapContentInfo -> [0] -> OCTET STRING
  const signedData = contentInfo.children[1]?.children[0]
  const encapsulated = signedData?.children.find(
    (child) => child.tag === TAG.sequence && child.children.length === 2
  )
  const payloadOctets = encapsulated?.children[1]?.children[0]
  if (!payloadOctets) throw new Error('Receipt payload not found')
  const payload = parseBer(payloadOctets.content)
  if (payload.tag !== TAG.set) throw new Error('Unexpected receipt payload')

  return (readAttributes(payload).get(RECEIPT_IN_APP) ?? []).map((value) => {
    const fields = readAttributes(parseBer(value))
    const field = (key: number): string | number | null => {
      const raw = fields.get(key)?.[0]
      return raw ? decodeValue(raw) : null
    }
    return {
      productId: String(field(IN_APP.productId) ?? ''),
      purchaseDate: parseDate(field(IN_APP.purchaseDate)),
      expiresDate: parseDate(field(IN_APP.expiresDate)),
      cancellationDate: parseDate(field(IN_APP.cancellationDate)),
      isIntroOfferPeriod: field(IN_APP.introOffer) === 1
    }
  })
}

export interface SubscriptionStatus {
  active: boolean
  inIntroOffer: boolean
  expiresAt: number | null
}

/** Picks the latest non-refunded period of `productId`. */
export function subscriptionStatus(records: InAppRecord[], productId: string, now: number): SubscriptionStatus {
  const periods = records
    .filter((record) => record.productId === productId && record.expiresDate && !record.cancellationDate)
    .sort((a, b) => (b.expiresDate ?? 0) - (a.expiresDate ?? 0))
  const latest = periods[0]
  if (!latest) return { active: false, inIntroOffer: false, expiresAt: null }
  return {
    active: (latest.expiresDate ?? 0) > now,
    inIntroOffer: latest.isIntroOfferPeriod,
    expiresAt: latest.expiresDate
  }
}
