import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TrendsPanel } from "@/components/TrendsPanel"
import { realData } from "@/test/fixtures/dashboardData"

async function seleccionar(user: ReturnType<typeof userEvent.setup>, label: string, opcion: string) {
  const [combo] = screen.getAllByRole("combobox").filter((c) =>
    c.closest("div")?.textContent?.includes(label),
  )
  await user.click(combo)
  await user.click(await screen.findByRole("option", { name: new RegExp(`^${opcion}`) }))
}

describe("TrendsPanel — render inicial", () => {
  it("renderiza las 3 tarjetas con sus subtítulos", () => {
    render(<TrendsPanel data={realData()} />)
    expect(
      screen.getByText("Evolución Histórica Anual por Programa (2021-2025)"),
    ).toBeInTheDocument()
    expect(screen.getByText("Perfil de Desempeño por EPS (2025)")).toBeInTheDocument()
    expect(
      screen.getByText("Comparativo Ejecución Acumulada por EPS (2026)"),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Valores promedio municipal. Escala 0-1 donde 1 = 100% de cobertura."),
    ).toBeInTheDocument()
  })

  it("sin filtros no muestra el chip de 'Mostrando'", () => {
    render(<TrendsPanel data={realData()} />)
    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument()
  })

  it("el select de programa ofrece 'Todos' + los 4 programas de consolidado", async () => {
    const user = userEvent.setup()
    render(<TrendsPanel data={realData()} />)
    await user.click(screen.getAllByRole("combobox")[0])
    expect(await screen.findAllByRole("option")).toHaveLength(5)
  })

  it("el select de EPS ofrece 'Todas' + las 6 EPS del histórico (incluye Proteger)", async () => {
    const user = userEvent.setup()
    render(<TrendsPanel data={realData()} />)
    await user.click(screen.getAllByRole("combobox")[1])
    const opciones = await screen.findAllByRole("option")
    expect(opciones).toHaveLength(7)
    expect(opciones.map((o) => o.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining("Proteger")]),
    )
  })
})

describe("TrendsPanel — filtros", () => {
  it("filtrar por programa muestra el chip 'Mostrando solo programa'", async () => {
    const user = userEvent.setup()
    render(<TrendsPanel data={realData()} />)
    await seleccionar(user, "Programa", "DT cervix")
    expect(screen.getByText("Mostrando solo programa: DT cervix")).toBeInTheDocument()
  })

  it("filtrar por EPS muestra el chip 'Mostrando solo EPS'", async () => {
    const user = userEvent.setup()
    render(<TrendsPanel data={realData()} />)
    await seleccionar(user, "EPS", "Sanitas")
    expect(screen.getByText("Mostrando solo EPS: Sanitas")).toBeInTheDocument()
  })

  it("filtrar por ambos muestra el chip combinado", async () => {
    const user = userEvent.setup()
    render(<TrendsPanel data={realData()} />)
    await seleccionar(user, "Programa", "DT cervix")
    await seleccionar(user, "EPS", "Nueva Eps")
    expect(screen.getByText("Mostrando: DT cervix — Nueva Eps")).toBeInTheDocument()
  })
})

describe("TrendsPanel — BUG CONOCIDO: selecciones que dejan gráficos vacíos sin mensaje", () => {
  it("elegir 'Proteger' (existe en histórico pero no en consolidado) no muestra empty-state", async () => {
    const user = userEvent.setup()
    render(<TrendsPanel data={realData()} />)
    await seleccionar(user, "EPS", "Proteger")

    expect(screen.getByText("Mostrando solo EPS: Proteger")).toBeInTheDocument()
    // las tarjetas siguen renderizándose sin aviso de "sin datos"
    expect(
      screen.getByText("Comparativo Ejecución Acumulada por EPS (2026)"),
    ).toBeInTheDocument()
    expect(screen.queryByText(/No hay datos/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/sin datos/i)).not.toBeInTheDocument()
  })

  it("elegir programa 'DT cervix' no produce mensaje de datos vacíos", async () => {
    const user = userEvent.setup()
    render(<TrendsPanel data={realData()} />)
    await seleccionar(user, "Programa", "DT cervix")
    expect(screen.getByText("Mostrando solo programa: DT cervix")).toBeInTheDocument()
    expect(screen.queryByText(/No hay datos/i)).not.toBeInTheDocument()
  })
})
