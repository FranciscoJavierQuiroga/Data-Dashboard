import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import Home from "@/pages/Home"
import { realData, override } from "@/test/fixtures/dashboardData"

const { useDataMock } = vi.hoisted(() => ({ useDataMock: vi.fn() }))
vi.mock("@/hooks/useData", () => ({ useData: useDataMock }))

describe("Home", () => {
  beforeEach(() => {
    useDataMock.mockReset()
  })

  it("muestra 'Cargando datos...' mientras useData devuelve null", () => {
    useDataMock.mockReturnValue(null)
    render(<Home />)
    expect(screen.getByText("Cargando datos...")).toBeInTheDocument()
    expect(screen.queryByText(/Dashboard Analítico/)).not.toBeInTheDocument()
  })

  it("renderiza el encabezado con el rango de meses derivado de los datos", () => {
    useDataMock.mockReturnValue(realData())
    render(<Home />)
    // hay datos con VALOR_MES > 0 hasta ABRIL
    expect(
      screen.getByText(/Datos acumulados Ene-Abr 2026/),
    ).toBeInTheDocument()
    expect(screen.getByText(/Municipio de Sogamoso/)).toBeInTheDocument()
  })

  it("usa '2026' sin rango de meses cuando ningún mes tiene VALOR_MES > 0", () => {
    const data = realData()
    const dataSinValores = override(
      data,
      "mensual",
      data.mensual.map((m) => ({ ...m, VALOR_MES: 0 })),
    )
    useDataMock.mockReturnValue(dataSinValores)
    render(<Home />)
    expect(screen.getByText(/Datos acumulados 2026/)).toBeInTheDocument()
  })

  it("abre por defecto el panel Ejecutivo", () => {
    useDataMock.mockReturnValue(realData())
    render(<Home />)
    expect(screen.getByText("Alertas Críticas")).toBeInTheDocument()
    expect(screen.getByText(/Registro de Alertas y Gestión Clínica/)).toBeInTheDocument()
  })

  it("cambia de vista al hacer click en el sidebar", async () => {
    const user = userEvent.setup()
    useDataMock.mockReturnValue(realData())
    render(<Home />)

    await user.click(screen.getByRole("button", { name: /Tendencias/ }))
    expect(screen.queryByText("Alertas Críticas")).not.toBeInTheDocument()
    expect(screen.getByText(/Evolución Histórica Anual por Programa/)).toBeInTheDocument()
  })

  it("renderiza todos los paneles sin crashear al recorrer las 6 vistas", async () => {
    const user = userEvent.setup()
    useDataMock.mockReturnValue(realData())
    render(<Home />)

    for (const vista of ["Tendencias", "Funnel Operativo", "Avance Mensual", "Detalle EPS", "Proyección", "Ejecutivo"]) {
      await user.click(screen.getByRole("button", { name: new RegExp(vista) }))
      expect(screen.queryByText(/Cargando datos/)).not.toBeInTheDocument()
    }
  })

  it("pasa el contador total de alertas al sidebar", () => {
    useDataMock.mockReturnValue(realData())
    render(<Home />)
    expect(screen.getByRole("button", { name: /Ejecutivo/ })).toHaveTextContent("18")
  })
})
