export const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1'

const TOKEN_KEY = 'sogamoso-dashboard-token'
const SESSION_KEY = 'sogamoso-dashboard-session'

export type Role = 'admin' | 'editor' | 'viewer'

export interface Session {
  access_token: string
  token_type: string
  role: Role
  email: string
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface Eps {
  id: number
  name: string
  code: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface Program {
  id: number
  name: string
  code: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface Indicator {
  id: number
  program_id: number
  name: string
  kind: 'cobertura' | 'positividad' | 'otro'
  unit: string
  active: boolean
  program_name: string | null
  created_at: string
  updated_at: string
}

export interface ImportBatch {
  id: number
  filename: string
  original_name: string
  sha256: string
  dataset_type: string
  status: string
  row_count: number
  error_count: number
  warning_count: number
  summary: Record<string, unknown>
  errors: Array<Record<string, unknown>>
  warnings: string[]
  preview: Array<Record<string, unknown>>
  uploaded_by_id: number | null
  created_at: string
  committed_at: string | null
}

export interface ImportCommitResult {
  batch: ImportBatch
  inserted: number
  updated: number
  skipped: number
}

export interface User {
  id: number
  email: string
  full_name: string
  role: Role
  active: boolean
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: number
  user_id: number | null
  action: string
  entity: string
  entity_id: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  created_at: string
}

export interface DashboardMeta {
  counts: Record<string, number>
  monthly_years: number[]
  latest_import: {
    id: number
    original_name: string
    status: string
    created_at: string | null
  } | null
}

export class ApiError extends Error {
  status: number
  detail: unknown

  constructor(status: number, detail: unknown) {
    super(
      typeof detail === 'string'
        ? detail
        : typeof detail === 'object' && detail && 'message' in detail
          ? String((detail as { message: unknown }).message)
          : `Error HTTP ${status}`,
    )
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

export function getSession(): Session | null {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Session
  } catch {
    return null
  }
}

export function saveSession(session: Session): void {
  localStorage.setItem(TOKEN_KEY, session.access_token)
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(SESSION_KEY)
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

function errorMessageFromPayload(payload: unknown): unknown {
  if (typeof payload !== 'object' || payload === null || !('detail' in payload)) {
    return payload
  }
  return (payload as { detail: unknown }).detail
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ApiError(response.status, errorMessageFromPayload(payload))
  }
  return payload as T
}

export function login(email: string, password: string): Promise<Session> {
  return request<Session>('/auth/login-json', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function getCurrentUser(): Promise<User> {
  return request<User>('/auth/me')
}

export function getDashboard<T>(year?: number): Promise<T> {
  const query = year ? `?year=${year}` : ''
  return request<T>(`/dashboard${query}`)
}

export function getDashboardMeta(): Promise<DashboardMeta> {
  return request<DashboardMeta>('/dashboard/meta')
}

export function listEps(): Promise<Eps[]> {
  return request<Eps[]>('/catalogs/eps')
}

export function createEps(name: string): Promise<Eps> {
  return request<Eps>('/catalogs/eps', { method: 'POST', body: JSON.stringify({ name }) })
}

export function updateEps(id: number, data: Partial<Pick<Eps, 'name' | 'code' | 'active'>>): Promise<Eps> {
  return request<Eps>(`/catalogs/eps/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
}

export function deleteEps(id: number): Promise<Eps> {
  return request<Eps>(`/catalogs/eps/${id}`, { method: 'DELETE' })
}

export function listPrograms(): Promise<Program[]> {
  return request<Program[]>('/catalogs/programs')
}

export function createProgram(name: string): Promise<Program> {
  return request<Program>('/catalogs/programs', { method: 'POST', body: JSON.stringify({ name }) })
}

export function updateProgram(
  id: number,
  data: Partial<Pick<Program, 'name' | 'code' | 'active'>>,
): Promise<Program> {
  return request<Program>(`/catalogs/programs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteProgram(id: number): Promise<Program> {
  return request<Program>(`/catalogs/programs/${id}`, { method: 'DELETE' })
}

export function listIndicators(): Promise<Indicator[]> {
  return request<Indicator[]>('/catalogs/indicators')
}

export function createIndicator(data: {
  program_id: number
  name: string
  kind?: Indicator['kind']
}): Promise<Indicator> {
  return request<Indicator>('/catalogs/indicators', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function deleteIndicator(id: number): Promise<Indicator> {
  return request<Indicator>(`/catalogs/indicators/${id}`, { method: 'DELETE' })
}

export function listImports(): Promise<Page<ImportBatch>> {
  return request<Page<ImportBatch>>('/imports?page_size=100')
}

export function uploadImport(
  file: File,
  datasetType: string,
  commit = false,
): Promise<ImportBatch> {
  const body = new FormData()
  body.append('file', file)
  body.append('dataset_type', datasetType)
  body.append('commit', String(commit))
  return request<ImportBatch>('/imports', { method: 'POST', body })
}

export function commitImport(id: number): Promise<ImportCommitResult> {
  return request<ImportCommitResult>(`/imports/${id}/commit`, { method: 'POST' })
}

export function rollbackImport(id: number): Promise<ImportBatch> {
  return request<ImportBatch>(`/imports/${id}/rollback`, { method: 'POST' })
}

export function listUsers(): Promise<User[]> {
  return request<User[]>('/users')
}

export function createUser(data: {
  email: string
  password: string
  full_name: string
  role: Role
}): Promise<User> {
  return request<User>('/users', { method: 'POST', body: JSON.stringify(data) })
}

export function updateUser(
  id: number,
  data: Partial<Pick<User, 'email' | 'full_name' | 'role' | 'active'>> & { password?: string },
): Promise<User> {
  return request<User>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
}

export function deactivateUser(id: number): Promise<User> {
  return request<User>(`/users/${id}`, { method: 'DELETE' })
}

export function listAudit(): Promise<Page<AuditLog>> {
  return request<Page<AuditLog>>('/audit?page_size=200')
}
