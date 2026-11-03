import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { StrictMode, act } from "react"
import { renderHook, waitFor } from "@testing-library/react"
import { useData, EMPTY_DASHBOARD } from "@/hooks/useData"

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
  "proyeccion_poisson",
]

const BASE = import.meta.env.BASE_URL
const API = "/api/v1/dashboard"

function jsonResponse(body: unknown, init: { ok?: boolean } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.ok === false ? 500 : 200,
    json: () => Promise.resolve(body),
  }
}

function staticFallbackMock(apiResponse: () => Promise<unknown> = () => Promise.reject(new Error("sin API"))) {
  return vi.fn((url: string) => {
    if (url === API) return apiResponse()
    return Promise.resolve(jsonResponse([url]))
  })
}

describe("useData", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("usa la API cuando está disponible y no descarga los JSON estáticos", async () => {
    const apiData = { kpis: [{ programa: "API" }], funnel: [] }
    const fetchMock = vi.fn((url: string) => {
      expect(url).toBe(API)
      return Promise.resolve(jsonResponse(apiData))
    })
    vi.stubGlobal("fetch", fetchMock)

    const { result } = renderHook(() => useData())
    await waitFor(() => expect(result.current).not.toBeNull())

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.current!.kpis[0]).toEqual({ programa: "API" })
  })

  it("si la API falla, usa los 10 JSON estáticos bajo BASE_URL", async () => {
    const fetchMock = staticFallbackMock(() => Promise.resolve(jsonResponse({}, { ok: false })))
    vi.stubGlobal("fetch", fetchMock)

    const { result } = renderHook(() => useData())
    await waitFor(() => expect(result.current).not.toBeNull())

    expect(fetchMock).toHaveBeenCalledTimes(11)
    const llamadas = fetchMock.mock.calls.map((c) => c[0]).filter((url) => url !== API).sort()
    expect(llamadas).toEqual(DATASETS.map((name) => `${BASE}data/${name}.json`).sort())
    expect(result.current!.kpis[0]).toBe(`${BASE}data/kpis.json`)
    expect(result.current!.proyeccionPoisson[0]).toBe(`${BASE}data/proyeccion_poisson.json`)
  })

  it("mapea cada dataset estático a su clave correcta del DashboardData", async () => {
    vi.stubGlobal("fetch", staticFallbackMock())

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
    expect(data.proyeccionPoisson[0]).toBe(`${BASE}data/proyeccion_poisson.json`)
  })

  it("inicializa en null (estado de carga)", () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse([]))))
    const { result } = renderHook(() => useData())
    expect(result.current).toBeNull()
  })

  it("si API y JSON fallan, entrega un dashboard vacío en vez de quedar cargando", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("sin red"))))

    const { result } = renderHook(() => useData())
    await waitFor(() => expect(result.current).not.toBeNull())
    expect(result.current).toEqual(EMPTY_DASHBOARD)
  })

  it("en StrictMode (usado por main.tsx) el efecto se ejecuta dos veces: 2 fetch a la API", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({})))
    vi.stubGlobal("fetch", fetchMock)

    const { result } = renderHook(() => useData(), { wrapper: StrictMode })
    await waitFor(() => expect(result.current).not.toBeNull())
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("recarga los datos al recibir dashboard:refresh", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({ kpis: [], funnel: [] })))
    vi.stubGlobal("fetch", fetchMock)

    const { result } = renderHook(() => useData())
    await waitFor(() => expect(result.current).not.toBeNull())
    expect(fetchMock).toHaveBeenCalledTimes(1)

    act(() => {
      window.dispatchEvent(new Event("dashboard:refresh"))
    })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })
})
