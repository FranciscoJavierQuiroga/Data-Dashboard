import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  ApiError,
  clearSession,
  getDashboard,
  getSession,
  login,
  saveSession,
  uploadImport,
  type Session,
} from "@/lib/api"

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: () => Promise.resolve(body),
  }
}

const SESSION: Session = {
  access_token: "token-123",
  token_type: "bearer",
  role: "admin",
  email: "admin@example.com",
}

describe("api client", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("login envía JSON al endpoint /auth/login-json", async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<unknown>>(() => Promise.resolve(jsonResponse(SESSION)))
    vi.stubGlobal("fetch", fetchMock)

    await expect(login("admin@example.com", "secret")).resolves.toEqual(SESSION)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("/api/v1/auth/login-json")
    expect(init.method).toBe("POST")
    expect(init.body).toBe(JSON.stringify({ email: "admin@example.com", password: "secret" }))
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json")
  })

  it("adjunta el token guardado a las peticiones autenticadas", async () => {
    saveSession(SESSION)
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<unknown>>(() => Promise.resolve(jsonResponse({ kpis: [] })))
    vi.stubGlobal("fetch", fetchMock)

    await getDashboard()
    const init = fetchMock.mock.calls[0][1]
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token-123")
  })

  it("persiste y limpia la sesión en localStorage", () => {
    expect(getSession()).toBeNull()
    saveSession(SESSION)
    expect(getSession()).toEqual(SESSION)
    clearSession()
    expect(getSession()).toBeNull()
  })

  it("convierte respuestas de error en ApiError con el detalle del backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<(url: string, init?: RequestInit) => Promise<unknown>>(() =>
        Promise.resolve(jsonResponse({ detail: "Credenciales inválidas" }, { ok: false, status: 401 })),
      ),
    )

    await expect(login("admin@example.com", "mala")).rejects.toMatchObject({
      status: 401,
      message: "Credenciales inválidas",
    })
    await expect(login("admin@example.com", "mala")).rejects.toBeInstanceOf(ApiError)
  })

  it("uploadImport envía multipart con archivo, tipo y confirmación", async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<unknown>>(() => Promise.resolve(jsonResponse({ id: 1 })))
    vi.stubGlobal("fetch", fetchMock)
    const file = new File(["contenido"], "datos.xlsx")

    await uploadImport(file, "auto", true)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("/api/v1/imports")
    expect(init.method).toBe("POST")
    const body = init.body as FormData
    expect(body.get("dataset_type")).toBe("auto")
    expect(body.get("commit")).toBe("true")
    expect(body.get("file")).toBe(file)
    expect(new Headers(init.headers).get("Content-Type")).toBeNull()
  })
})
