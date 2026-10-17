import type { AppApi } from '@shared/api'
import { createMockApi } from './mockApi'

export const api: AppApi = window.api ?? createMockApi()
