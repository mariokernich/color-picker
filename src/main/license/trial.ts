import { DAY_MS } from '../../shared/product'

export interface TrialRecord {
  firstLaunchAt: number
  lastSeenAt: number
}

export interface TrialResult {
  active: boolean
  trialEndsAt: number
}

/** Allowed backwards clock drift before the trial is considered tampered with. */
const CLOCK_TOLERANCE_MS = DAY_MS

export function evaluateTrial(record: TrialRecord, now: number, trialDays: number): TrialResult {
  const trialEndsAt = record.firstLaunchAt + trialDays * DAY_MS
  const clockRolledBack = now + CLOCK_TOLERANCE_MS < record.lastSeenAt
  return { active: !clockRolledBack && now < trialEndsAt, trialEndsAt }
}

/** Updates the last-seen timestamp; it never moves backwards. */
export function touchTrial(record: TrialRecord | null, now: number): TrialRecord {
  if (!record) return { firstLaunchAt: now, lastSeenAt: now }
  return { ...record, lastSeenAt: Math.max(record.lastSeenAt, now) }
}
