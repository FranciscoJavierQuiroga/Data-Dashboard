import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ExecutivePanel } from "@/components/ExecutivePanel"
import { realData, override } from "@/test/fixtures/dashboardData"

// El selector de Radix renderiza opciones en un portal con role="option"
async function seleccionarEps(user: ReturnType<typeof userEvent.setup>, eps: string) {
  const trigger = screen.getByRole("combobox")
  await user.click(trigger)
  await user.click(await screen.findByRole("option", { name: new RegExp(`^${eps}`) }))
}

function cardPorTitulo(titulo: string): HTMLElement {
  const tituloEl = screen.getByText(titulo)
  return tituloEl.closest(".rounded-xl, .rounded-lg, [class*='rounded']") as HTMLElement
}

describe("ExecutivePanel — resumen de alertas", () => {
  it("muestra los conteos reales: 7 críticas, 3 altas, 8 medias", () => {
    render(<ExecutivePanel data={realData()} />)
    expect(screen.getByText("Alertas Críticas").parentElement).toHaveTextContent("7")
    expect(screen.getByText("Alertas Altas").parentElement).toHaveTextContent("3")
    expect(screen.getByText("Alertas Medias").parentElement).toHaveTextContent("8")
  })

  it("BUG CONOCIDO: 'Programas Activos' es el literal 4, no está derivado de los datos", () => {
    const data = realData()
    render(<ExecutivePanel data={data} />)
    expect(screen.getByText("Programas Activos").parentElement).toHaveTextContent("4")
    // incluso con datos que contienen 4 programas distintos, es un hardcode
    expect(new Set(data.kpis.map((k) => k.programa)).size).toBe(4)
  })
})

describe("ExecutivePanel — tarjetas KPI (vista Todas)", () => {
  it("renderiza las 7 tarjetas de kpis.json", () => {
    render(<ExecutivePanel data={realData()} />)
    for (const k of realData().kpis) {
      expect(screen.getByText(k.label)).toBeInTheDocument()
    }
  })

  it("formatea Cobertura CCU con locale es-CO: 2.983 / meta 1.876,71 / 158.9% / 52.45%", () => {
    render(<ExecutivePanel data={realData()} />)
    const card = cardPorTitulo("Cobertura CCU")
    expect(card).toHaveTextContent("2.983")
    expect(card).toHaveTextContent("Meta: 1.876,71")
    expect(card).toHaveTextContent("158.9%")
    expect(card).toHaveTextContent("52.45%")
  })

  it("colorea por avance: >=50% emerald, >=25% amber, <25% red", () => {
    render(<ExecutivePanel data={realData()} />)
    // Cobertura CCU: 158.9% → emerald; Tacto Rectal: 26.7% → amber; SOMF: 10.1% → red
    expect(cardPorTitulo("Cobertura CCU").className).toContain("bg-emerald-50")
    expect(cardPorTitulo("Tacto Rectal").className).toContain("bg-amber-50")
    expect(cardPorTitulo("Cobertura SOMF").className).toContain("bg-red-50")
  })
})

describe("ExecutivePanel — tabla de alertas", () => {
  it("lista las 18 alertas con la columna EPS en modo Todas", () => {
    render(<ExecutivePanel data={realData()} />)
    // 1 encabezado + 18 filas (solo existe una tabla en el panel)
    expect(screen.getAllByRole("row")).toHaveLength(19)
    expect(screen.getByRole("columnheader", { name: "EPS" })).toBeInTheDocument()
  })

  it("muestra el mensaje vacío cuando la EPS seleccionada no tiene alertas", async () => {
    const user = userEvent.setup()
    render(<ExecutivePanel data={realData()} />)
    await seleccionarEps(user, "Salud Total")
    expect(
      screen.getByText("No hay alertas registradas para Salud Total"),
    ).toBeInTheDocument()
  })
})

describe("ExecutivePanel — filtro por EPS", () => {
  it("al seleccionar una EPS muestra el chip y oculta la columna EPS", async () => {
    const user = userEvent.setup()
    render(<ExecutivePanel data={realData()} />)
    await seleccionarEps(user, "Sanitas")

    expect(screen.getByText(/Mostrando datos solo para/)).toHaveTextContent("Sanitas")
    expect(screen.queryByRole("columnheader", { name: "EPS" })).not.toBeInTheDocument()
    expect(screen.getByText(/Registro de Alertas y Gestión Clínica/)).toHaveTextContent(
      "— Sanitas",
    )
  })

  it("filtra las alertas: Sanitas tiene 5 de 18", async () => {
    const user = userEvent.setup()
    render(<ExecutivePanel data={realData()} />)
    await seleccionarEps(user, "Sanitas")

    expect(screen.getAllByRole("row")).toHaveLength(6) // 1 encabezado + 5
  })

  it("recalcula los KPIs desde funnel para la EPS elegida (Sanitas CCU: 455 / 422,4 / 107.7% / 35.55%)", async () => {
    const user = userEvent.setup()
    render(<ExecutivePanel data={realData()} />)
    await seleccionarEps(user, "Sanitas")

    const card = cardPorTitulo("Cobertura CCU")
    expect(card).toHaveTextContent("455")
    expect(card).toHaveTextContent("Meta: 422,4")
    expect(card).toHaveTextContent("107.7%")
    expect(card).toHaveTextContent("35.55%")
  })

  it("el trigger del select muestra el último mes con datos por EPS (badge 'Mar' para Sanitas)", async () => {
    const user = userEvent.setup()
    render(<ExecutivePanel data={realData()} />)
    const trigger = screen.getByRole("combobox")
    await user.click(trigger)
    const opcionSanitas = await screen.findByRole("option", { name: /Sanitas/ })
    expect(opcionSanitas).toHaveTextContent("Mar")
    const opcionFamisanar = screen.getByRole("option", { name: /Famisanar/ })
    expect(opcionFamisanar).toHaveTextContent("Abr")
  })

  it("BUG CONOCIDO: una EPS sin fila en funnel muestra KPIs con acumulado fabricado 0", async () => {
    const data = realData()
    // quitar la fila de Cobertura CCU de Salud Total
    const filtrado = override(
      data,
      "funnel",
      data.funnel.filter(
        (f) => !(f.eps === "Salud Total" && f.tipo_indicador === "COBERTURA CCU"),
      ),
    )
    const user = userEvent.setup()
    render(<ExecutivePanel data={filtrado} />)
    await seleccionarEps(user, "Salud Total")

    const card = cardPorTitulo("Cobertura CCU")
    // el código usa `?? 0`: muestra 0 y N/D en vez de ocultar la tarjeta
    expect(card).toHaveTextContent("0acum.")
    expect(card).toHaveTextContent("N/D")
  })
})
