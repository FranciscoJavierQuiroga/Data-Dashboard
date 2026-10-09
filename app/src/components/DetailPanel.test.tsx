import { describe, it, expect } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DetailPanel } from "@/components/DetailPanel"
import { realData, override, withEmpty } from "@/test/fixtures/dashboardData"

async function seleccionarPrograma(user: ReturnType<typeof userEvent.setup>, programa: string) {
  await user.click(screen.getByRole("combobox"))
  await user.click(await screen.findByRole("option", { name: programa }))
}

describe("DetailPanel — matriz indicador × EPS", () => {
  it("renderiza encabezado con 2 columnas fijas + las 6 EPS de consolidado", () => {
    render(<DetailPanel data={realData()} />)
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent)
    expect(headers.slice(0, 2)).toEqual(["Programa", "Indicador"])
    expect(headers.slice(2)).toEqual([
      "Cajacopi", "Coosalud", "Famisanar", "Nueva_Eps", "Salud_Total", "Sanitas",
    ])
  })

  it("renderiza 17 filas (pares programa×indicador) + encabezado = 18 filas", () => {
    render(<DetailPanel data={realData()} />)
    expect(screen.getAllByRole("row")).toHaveLength(18)
  })

  it("muestra valores con un decimal: 210.5% (Nueva_Eps CCU) y 107.7% (Sanitas CCU)", () => {
    render(<DetailPanel data={realData()} />)
    expect(screen.getByText("210.5%")).toBeInTheDocument()
    expect(screen.getByText("107.7%")).toBeInTheDocument()
  })

  it("los 7 EJECUCION null se renderizan como guion '—', no como celda numérica", () => {
    render(<DetailPanel data={realData()} />)
    expect(screen.getAllByText("—")).toHaveLength(7)
    // 102 celdas - 7 nulls = 95 barras de progreso
    expect(screen.getAllByRole("progressbar")).toHaveLength(95)
  })

  it("BUG CONOCIDO: el wrapper shadcn no pasa `value` a Radix: las 95 barras quedan indeterminate y sin aria-valuenow", () => {
    render(<DetailPanel data={realData()} />)
    expect(screen.getByText(/proporciones del 0 al 1/)).toBeInTheDocument()

    const barras = screen.getAllByRole("progressbar")
    expect(barras).toHaveLength(95)
    for (const barra of barras) {
      expect(barra).toHaveAttribute("data-state", "indeterminate")
      expect(barra).not.toHaveAttribute("aria-valuenow")
    }
  })

  it("BUG CONOCIDO: con value>100 el transform genera CSS malformado (translateX(--110%)) que el navegador descarta", () => {
    render(<DetailPanel data={realData()} />)
    const celdaSobre100 = screen.getByText("210.5%").closest("td")!
    const indicadorSobre100 = celdaSobre100.querySelector("[data-slot=progress-indicator]")!
    // 100 - 210.45 = -110.45 → "translateX(--110.45%)" es inválido → sin style
    expect(indicadorSobre100.getAttribute("style")).toBeNull()

    // en cambio, un valor válido sí genera transform correcto
    const celdaNormal = screen.getByText("48.9%").closest("td")!
    const indicadorNormal = celdaNormal.querySelector("[data-slot=progress-indicator]")!
    expect(indicadorNormal.getAttribute("style")).toContain("translateX(-")
  })
})

describe("DetailPanel — filtro de programa", () => {
  it("al filtrar por 'DT cervix' la matriz queda en 5 filas", async () => {
    const user = userEvent.setup()
    render(<DetailPanel data={realData()} />)
    await seleccionarPrograma(user, "DT cervix")
    expect(screen.getAllByRole("row")).toHaveLength(6) // 1 + 5
    expect(screen.queryByText("210.5%")).toBeInTheDocument()
  })

  it("BUG CONOCIDO: la tarjeta 'Circuito Diagnóstico por EPS' es inalcanzable con datos reales", async () => {
    const user = userEvent.setup()
    render(<DetailPanel data={realData()} />)
    await seleccionarPrograma(user, "DT cervix")
    // consolidado usa 'DT cervix' y funnel usa 'Dt Cervix': el filtro exacto nunca coincide
    expect(screen.queryByText(/Circuito Diagnóstico por EPS/)).not.toBeInTheDocument()
  })
})

describe("DetailPanel — circuito diagnóstico (requiere vocabulario alineado)", () => {
  // Fixture que alinea el vocabulario de programa entre consolidado y funnel
  function dataAlineada() {
    const data = realData()
    return override(
      data,
      "consolidado",
      data.consolidado.map((c) =>
        c.PROGRAMA === "DT cervix" ? { ...c, PROGRAMA: "Dt Cervix" } : c,
      ),
    )
  }

  it("aparece la tarjeta con las 5 etapas de Dt Cervix", async () => {
    const user = userEvent.setup()
    render(<DetailPanel data={dataAlineada()} />)
    await seleccionarPrograma(user, "Dt Cervix")

    expect(screen.getByText(/Circuito Diagnóstico por EPS — Dt Cervix/)).toBeInTheDocument()
    for (const etapa of ["CCU Realizadas", "CCU Anormales", "ADN VPH Realizados", "ADN VPH Positivos", "Colposcopia + Biopsia"]) {
      expect(screen.getByText(etapa)).toBeInTheDocument()
    }
  })

  it("BUG CONOCIDO: pct null en el circuito se renderiza como '0.0%' rojo en vez de N/D", async () => {
    const user = userEvent.setup()
    render(<DetailPanel data={dataAlineada()} />)
    await seleccionarPrograma(user, "Dt Cervix")

    // Colposcopia + Biopsia × Salud Total: acumulado 2, pct_ejecucion null
    const fila = screen.getByText("Colposcopia + Biopsia").closest("tr")!
    const celdas = within(fila).getAllByRole("cell")
    // celdas: Etapa + [Coosalud, Famisanar, Nueva Eps, Proteger, Salud Total, Sanitas]
    expect(celdas).toHaveLength(7)
    const celdaSaludTotal = celdas[5]
    expect(celdaSaludTotal).toHaveTextContent("2")
    const pct = within(celdaSaludTotal).getByText("0.0%")
    expect(pct.className).toContain("text-red-600")
  })
})

describe("DetailPanel — estados vacíos", () => {
  it("BUG CONOCIDO: consolidado vacío renderiza solo el encabezado, sin mensaje de 'sin datos'", () => {
    render(<DetailPanel data={withEmpty(realData(), "consolidado")} />)
    expect(screen.getAllByRole("row")).toHaveLength(1)
    expect(screen.queryByText(/No hay datos/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/sin datos/i)).not.toBeInTheDocument()
  })
})
