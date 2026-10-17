import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { Action, migrate, reduce, ReduceContext } from '../shared/state'
import type { AppData } from '../shared/types'

const SAVE_DELAY_MS = 300

/** Persists a JSON document atomically (write to temp file, then rename). */
export function writeJsonAtomic(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  const temp = `${path}.tmp`
  writeFileSync(temp, JSON.stringify(value, null, 2))
  renameSync(temp, path)
}

export function readJson(path: string): unknown {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    console.error(`Could not read ${path}`, error)
    return null
  }
}

/** Single source of truth for user data. Lives in the main process; windows receive snapshots. */
export class DataStore {
  private data: AppData
  private saveTimer: NodeJS.Timeout | null = null
  private readonly listeners = new Set<(data: AppData, previous: AppData) => void>()
  private readonly context: ReduceContext = { now: () => Date.now(), id: () => randomUUID() }

  constructor(private readonly path: string) {
    this.data = migrate(readJson(path))
  }

  get state(): AppData {
    return this.data
  }

  dispatch(action: Action): AppData {
    const previous = this.data
    const next = reduce(previous, action, this.context)
    if (next === previous) return next
    this.data = next
    this.scheduleSave()
    this.listeners.forEach((listener) => listener(next, previous))
    return next
  }

  subscribe(listener: (data: AppData, previous: AppData) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  flush(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = null
    try {
      writeJsonAtomic(this.path, this.data)
    } catch (error) {
      console.error('Could not save data', error)
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => this.flush(), SAVE_DELAY_MS)
  }
}
