import { describe, expect, it } from 'vitest'
import { readInAppRecords, subscriptionStatus } from './receipt'

// Tiny DER/BER encoder for building synthetic receipts.
function encodeLength(length: number): Buffer {
  if (length < 0x80) return Buffer.from([length])
  const bytes: number[] = []
  for (let value = length; value > 0; value = Math.floor(value / 256)) bytes.unshift(value & 0xff)
  return Buffer.from([0x80 | bytes.length, ...bytes])
}
const tlv = (tag: number, content: Buffer): Buffer => Buffer.concat([Buffer.from([tag]), encodeLength(content.length), content])
const indefinite = (tag: number, ...children: Buffer[]): Buffer =>
  Buffer.concat([Buffer.from([tag, 0x80]), ...children, Buffer.from([0, 0])])
const integer = (value: number): Buffer => {
  const bytes: number[] = []
  let rest = value
  do {
    bytes.unshift(rest & 0xff)
    rest = Math.floor(rest / 256)
  } while (rest > 0)
  if (bytes[0] & 0x80) bytes.unshift(0)
  return tlv(0x02, Buffer.from(bytes))
}
const utf8 = (text: string): Buffer => tlv(0x0c, Buffer.from(text))
const ia5 = (text: string): Buffer => tlv(0x16, Buffer.from(text))
const octets = (content: Buffer): Buffer => tlv(0x04, content)
const sequence = (...children: Buffer[]): Buffer => tlv(0x30, Buffer.concat(children))
const set = (...children: Buffer[]): Buffer => tlv(0x31, Buffer.concat(children))
const oid = Buffer.from([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x02])
const attribute = (type: number, value: Buffer): Buffer => sequence(integer(type), integer(1), octets(value))

function inApp(productId: string, expires: string, options: { cancelled?: boolean; intro?: boolean } = {}): Buffer {
  return attribute(
    17,
    set(
      attribute(1702, utf8(productId)),
      attribute(1704, ia5('2026-01-01T00:00:00Z')),
      attribute(1708, ia5(expires)),
      attribute(1712, ia5(options.cancelled ? '2026-01-05T00:00:00Z' : '')),
      attribute(1719, integer(options.intro ? 1 : 0))
    )
  )
}

/** Wraps a receipt payload in a PKCS#7 envelope using indefinite lengths like Apple does. */
function receipt(...attributes: Buffer[]): Buffer {
  const payload = set(attribute(2, utf8('de.kernich.colorpicker')), ...attributes)
  const signedData = indefinite(
    0x30,
    integer(1),
    set(),
    indefinite(0x30, oid, indefinite(0xa0, indefinite(0x24, octets(payload.subarray(0, 10)), octets(payload.subarray(10))))),
    set()
  )
  return indefinite(0x30, oid, indefinite(0xa0, signedData))
}

const PRODUCT = 'de.kernich.colorpicker.pro.yearly'

describe('receipt', () => {
  it('reads in-app records from a BER receipt with chunked payload', () => {
    const records = readInAppRecords(receipt(inApp(PRODUCT, '2026-02-01T00:00:00Z', { intro: true })))
    expect(records).toEqual([
      {
        productId: PRODUCT,
        purchaseDate: Date.parse('2026-01-01T00:00:00Z'),
        expiresDate: Date.parse('2026-02-01T00:00:00Z'),
        cancellationDate: null,
        isIntroOfferPeriod: true
      }
    ])
  })

  it('derives the subscription status from the latest period', () => {
    const records = readInAppRecords(
      receipt(
        inApp(PRODUCT, '2026-02-01T00:00:00Z', { intro: true }),
        inApp(PRODUCT, '2027-02-01T00:00:00Z'),
        inApp('other.product', '2030-01-01T00:00:00Z')
      )
    )
    expect(subscriptionStatus(records, PRODUCT, Date.parse('2026-06-01T00:00:00Z'))).toEqual({
      active: true,
      inIntroOffer: false,
      expiresAt: Date.parse('2027-02-01T00:00:00Z')
    })
    expect(subscriptionStatus(records, PRODUCT, Date.parse('2027-03-01T00:00:00Z')).active).toBe(false)
  })

  it('ignores refunded periods', () => {
    const records = readInAppRecords(receipt(inApp(PRODUCT, '2027-01-01T00:00:00Z', { cancelled: true })))
    expect(subscriptionStatus(records, PRODUCT, Date.parse('2026-06-01T00:00:00Z')).active).toBe(false)
  })

  it('rejects malformed data', () => {
    expect(() => readInAppRecords(Buffer.from([0x30, 0x05, 0x01]))).toThrow()
  })
})
