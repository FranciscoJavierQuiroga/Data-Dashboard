import { describe, it, expect } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MonthlyPanel } from "@/components/MonthlyPanel"
import { realData, override, withEmpty } from "@/test/fixtures/dashboardData"

async function seleccionar(user: ReturnType<typeof userEvent.setup>, label: string, opcion: string) {
  const [combo] = screen.getAllByRole("combobox").filter((c) =>
    c.closest("div")?.textContent?.includes(label),
  )
  await user.click(combo)
  // los items de EPS llevan badge de mes, así que el nombre accesible es "Sanitas Mar"
  await user.click(await screen.findByRole("option", { name: new RegExp(`^${opcion}`) }))
}

function tarjetaRitmo(programa: string): HTMLElement {
  const candidatos = screen
    .getAllByText(programa)
    .map((el) => el.closest('[data-slot="card"]'))
    .filter((c): c is HTMLElement => c !== null)
  const tarjeta = candidatos.find((c) => c.textContent?.includes("Faltan"))
  expect(tarjeta, `no se encontró tarjeta de ritmo para ${programa}`).toBeDefined()
  return tarjeta as HTMLElement
}

describe("MonthlyPanel — tarjetas de ritmo (estado inicial)", () => {
  it("renderiza 4 tarjetas (una por programa de burnup) y el burn-up", () => {
    render(<MonthlyPanel data={realData()} />)
    for (const prog of ["Dt Cervix", "Dt Mama", "Dt Prostata", "Dt Colon Y Recto"]) {
      expect(tarjetaRitmo(prog)).toBeInTheDocument()
    }
    expect(screen.getByText("Burn-up Chart — Avance Acumulado Mensual")).toBeInTheDocument()
    expect(screen.queryByText("Contribución Mensual por EPS")).not.toBeInTheDocument()
  })

  it("muestra el subtítulo por defecto del burn-up", () => {
    render(<MonthlyPanel data={realData()} />)
    expect(
      screen.getByText("Solo indicadores de cobertura real (CCU, mamografía, PSA, sangre oculta). 2026."),
    ).toBeInTheDocument()
  })

  it("Dt Mama muestra acumulado 1.247, faltan 7.472 y ritmo 934/mes", () => {
    render(<MonthlyPanel data={realData()} />)
    const card = tarjetaRitmo("Dt Mama")
    expect(card).toHaveTextContent("Acumulado (Ene-Abr)")
    expect(card).toHaveTextContent("1.247")
    expect(card).toHaveTextContent("7.472")
    expect(card).toHaveTextContent("934/mes")
  })

  it("Dt Colon Y Recto muestra faltan 17.040,5 y ritmo 2.131/mes", () => {
    render(<MonthlyPanel data={realData()} />)
    const card = tarjetaRitmo("Dt Colon Y Recto")
    expect(card).toHaveTextContent("17.040,5")
    expect(card).toHaveTextContent("2.131/mes")
  })
})

describe("MonthlyPanel — BUG CONOCIDO: meta superada genera Faltan y ritmo negativos", () => {
  it("Dt Cervix (2.983 acumulados vs meta 1.876,71) imprime 'Faltan -1.106,29' en rojo", () => {
    render(<MonthlyPanel data={realData()} />)
    const card = tarjetaRitmo("Dt Cervix")
    expect(card).toHaveTextContent("Meta anual 2026")
    expect(card).toHaveTextContent("1.876,71")

    const labelFaltan = within(card).getByText("Faltan")
    const filaFaltan = labelFaltan.closest("div") as HTMLElement
    expect(filaFaltan).toHaveTextContent("-1.106,29")
    const valor = within(filaFaltan).getByText("-1.106,29")
    expect(valor.className).toContain("text-red-600")
  })

  it("Dt Cervix imprime ritmo mensual requerido negativo '-138/mes' en ámbar", () => {
    render(<MonthlyPanel data={realData()} />)
    const card = tarjetaRitmo("Dt Cervix")
    const valor = within(card).getByText("-138/mes")
    expect(valor.className).toContain("text-amber-600")
    expect(card).toHaveTextContent("A ritmo actual: 746 por mes · Para meta: -138 por mes")
  })
})

describe("MonthlyPanel — filtros", () => {
  it("al elegir un programa aparece 'Contribución Mensual por EPS' y cambia el subtítulo", async () => {
    const user = userEvent.setup()
    render(<MonthlyPanel data={realData()} />)
    await seleccionar(user, "Programa", "Dt Cervix")

    expect(screen.getByText("Contribución Mensual por EPS")).toBeInTheDocument()
    expect(
      screen.getByText("Solo indicadores de cobertura real. Línea punteada = meta proporcional mensual. 2026."),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Desagregación de actividades de cobertura por aseguradora para Dt Cervix."),
    ).toBeInTheDocument()
  })

  it("al elegir programa + EPS aparece el chip y cambian los subtítulos", async () => {
    const user = userEvent.setup()
    render(<MonthlyPanel data={realData()} />)
    await seleccionar(user, "Programa", "Dt Cervix")
    await seleccionar(user, "EPS", "Sanitas")

    expect(screen.getByText(/Mostrando solo datos de/)).toHaveTextContent("Sanitas")
    expect(
      screen.getByText("Solo indicadores de cobertura real — Sanitas. Línea punteada = meta proporcional mensual. 2026."),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Actividades de cobertura mensuales — Sanitas."),
    ).toBeInTheDocument()
  })

  it("el select de EPS muestra el último mes con datos por EPS (badge)", async () => {
    const user = userEvent.setup()
    render(<MonthlyPanel data={realData()} />)
    await user.click(screen.getAllByRole("combobox")[1])
    expect(await screen.findByRole("option", { name: /Famisanar/ })).toHaveTextContent("Abr")
    expect(screen.getByRole("option", { name: /Sanitas/ })).toHaveTextContent("Mar")
  })
})

describe("MonthlyPanel — estados vacíos", () => {
  it("BUG CONOCIDO: burnup vacío elimina las tarjetas de ritmo sin mostrar mensaje", () => {
    render(<MonthlyPanel data={withEmpty(realData(), "burnup")} />)
    expect(screen.queryByText("Faltan")).not.toBeInTheDocument()
    expect(screen.getByText("Burn-up Chart — Avance Acumulado Mensual")).toBeInTheDocument()
    expect(screen.queryByText(/No hay datos/i)).not.toBeInTheDocument()
  })

  it("BUG CONOCIDO: con burnup en ceros cae al fallback mes='Mar' y mesesTranscurridos=3", () => {
    const data = realData()
    const burnupCero = override(
      data,
      "burnup",
      data.burnup.map((b) => ({ ...b, VALOR_MES: 0, ACUMULADO_CALCULADO: 0 })),
    )
    render(<MonthlyPanel data={burnupCero} />)

    const card = tarjetaRitmo("Dt Cervix")
    expect(card).toHaveTextContent("Acumulado (Ene-Mar)") // fallback hardcodeado 'Mar'
    expect(card).toHaveTextContent("0")
    expect(card).toHaveTextContent("Faltan")
    expect(card).toHaveTextContent("1.876,71") // faltan = meta completa
    // ritmo = meta / (12 - 3)
    expect(card).toHaveTextContent("209/mes")
  })
})
