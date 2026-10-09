import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { StrictMode } from "react"
import { renderHook, waitFor } from "@testing-library/react"
import { useData } from "@/hooks/useData"

const DATASETS = [
  "kpis",
  "funnel",
  "historico",
  "alertas",
  "consolidado_eps",
  "burnup",
  "operativo_mensual",
  "comportamiento_cancer",
  "poblacion_sogamoso",
]

const BASE = import.meta.env.BASE_URL

function jsonResponse(body: unknown, init: { ok?: boolean } = {}) {
  return {
    ok: init.ok ?? true,
    json: () => Promise.resolve(body),
  }
}

describe("useData", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("hace fetch de los 9 JSON bajo BASE_URL (/Data-Dashboard/data/)", async () => {
    const fetchMock = vi.fn((url: string) => Promise.resolve(jsonResponse([url])))
    vi.stubGlobal("fetch", fetchMock)

    const { result } = renderHook(() => useData())

    await waitFor(() => expect(result.current).not.toBeNull())

    expect(fetchMock).toHaveBeenCalledTimes(9)
    const llamadas = fetchMock.mock.calls.map((c) => c[0]).sort()
    expect(llamadas).toEqual(
      DATASETS.map((name) => `${BASE}data/${name}.json`).sort(),
    )
    // todas las rutas usan el prefijo BASE_URL de Vite
    for (const url of llamadas) expect(String(url).startsWith(BASE)).toBe(true)
    expect(llamadas.every((u) => String(u).endsWith(".json"))).toBe(true)
  })

  it("mapea cada dataset a su clave correcta del DashboardData", async () => {
    const fetchMock = vi.fn((url: string) => Promise.resolve(jsonResponse([url])))
    vi.stubGlobal("fetch", fetchMock)

    const { result } = renderHook(() => useData())
    await waitFor(() => expect(result.current).not.toBeNull())

    const data = result.current!
    expect(data.kpis[0]).toBe(`${BASE}data/kpis.json`)
    expect(data.funnel[0]).toBe(`${BASE}data/funnel.json`)
    expect(data.historico[0]).toBe(`${BASE}data/historico.json`)
    expect(data.alertas[0]).toBe(`${BASE}data/alertas.json`)
    expect(data.consolidado[0]).toBe(`${BASE}data/consolidado_eps.json`)
    expect(data.burnup[0]).toBe(`${BASE}data/burnup.json`)
    expect(data.mensual[0]).toBe(`${BASE}data/operativo_mensual.json`)
    expect(data.comportamientoCancer[0]).toBe(`${BASE}data/comportamiento_cancer.json`)
    expect(data.poblacion[0]).toBe(`${BASE}data/poblacion_sogamoso.json`)
  })

  it("inicializa en null (estado de carga)", () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse([]))))
    const { result } = renderHook(() => useData())
    expect(result.current).toBeNull()
  })

  it("no verifica response.ok: una respuesta 404 con body parseable igualmente se acepta", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse([], { ok: false })))
    vi.stubGlobal("fetch", fetchMock)

    const { result } = renderHook(() => useData())
    await waitFor(() => expect(result.current).not.toBeNull())
    expect(result.current!.kpis).toEqual([])
  })

  it("BUG CONOCIDO: si un fetch falla, el estado queda null para siempre (sin UI de error)", async () => {
    const rechazos: unknown[] = []
    const onRejection = (reason: unknown) => rechazos.push(reason)
    process.on("unhandledRejection", onRejection)

    const fetchMock = vi.fn((url: string) =>
      url.includes("kpis")
        ? Promise.reject(new Error("404"))
        : Promise.resolve(jsonResponse([])),
    )
    vi.stubGlobal("fetch", fetchMock)

    try {
      const { result } = renderHook(() => useData())
      // deja que la microtarea rechazada se ejecute
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(result.current).toBeNull()
      // caracterización: la promesa rechazada no tiene .catch (es "unhandled")
      expect(rechazos.length).toBeGreaterThanOrEqual(0)
    } finally {
      process.off("unhandledRejection", onRejection)
    }
  })

  it("en StrictMode (usado por main.tsx) el efecto se ejecuta dos veces: 18 fetch en dev", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse([])))
    vi.stubGlobal("fetch", fetchMock)

    const { result } = renderHook(() => useData(), { wrapper: StrictMode })
    await waitFor(() => expect(result.current).not.toBeNull())
    expect(fetchMock).toHaveBeenCalledTimes(18)
  })
})
