import { describe, expect, it } from 'vitest'
import { DAY_MS } from '../../shared/product'
import { evaluateTrial, touchTrial } from './trial'

describe('trial', () => {
  const start = Date.UTC(2026, 0, 1)

  it('starts on first launch', () => {
    expect(touchTrial(null, start)).toEqual({ firstLaunchAt: start, lastSeenAt: start })
  })

  it('is active for the configured number of days', () => {
    const record = touchTrial(null, start)
    expect(evaluateTrial(record, start + 29 * DAY_MS, 30)).toEqual({ active: true, trialEndsAt: start + 30 * DAY_MS })
    expect(evaluateTrial(record, start + 30 * DAY_MS, 30).active).toBe(false)
  })

  it('detects a clock that was turned back', () => {
    const record = touchTrial(touchTrial(null, start), start + 40 * DAY_MS)
    expect(evaluateTrial(record, start + 2 * DAY_MS, 30).active).toBe(false)
  })

  it('never moves last seen backwards', () => {
    const record = touchTrial(touchTrial(null, start + DAY_MS), start)
    expect(record.lastSeenAt).toBe(start + DAY_MS)
  })
})
