import { describe, it, expect } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FunnelPanel } from "@/components/FunnelPanel"
import { realData, override, withEmpty } from "@/test/fixtures/dashboardData"

async function seleccionar(user: ReturnType<typeof userEvent.setup>, label: string, opcion: string) {
  const [combo] = screen.getAllByRole("combobox").filter((c) => {
    const wrapper = c.closest("div")
    return wrapper?.textContent?.includes(label)
  })
  await user.click(combo)
  await user.click(await screen.findByRole("option", { name: opcion }))
}

function filaEtapa(etapa: string): HTMLElement {
  return screen.getByText(etapa).closest("tr") as HTMLElement
}

function pctMeta(etapa: string): string {
  const celdas = within(filaEtapa(etapa)).getAllByRole("cell")
  return celdas[3].textContent ?? ""
}

describe("FunnelPanel — render inicial (Dt Cervix, Todas)", () => {
  it("muestra los títulos de las tres tarjetas", () => {
    render(<FunnelPanel data={realData()} />)
    expect(screen.getByText("Funnel de Tamización y Diagnóstico")).toBeInTheDocument()
    expect(screen.getByText("Tasa de Conversión entre Etapas")).toBeInTheDocument()
    expect(screen.getByText("Detalle por Etapa")).toBeInTheDocument()
  })

  it("fusiona las etapas de Dt Cervix en 3 etapas (STAGE_MERGE) con valores municipales", () => {
    render(<FunnelPanel data={realData()} />)
    // filas de la tabla Detalle por Etapa
    expect(filaEtapa("Tamizaje (CCU + ADN VPH)")).toBeInTheDocument()
    expect(filaEtapa("Anormales")).toBeInTheDocument()
    expect(filaEtapa("Colposcopia + Biopsia")).toBeInTheDocument()

    // acumulados y % recalculados municipalmente
    expect(filaEtapa("Tamizaje (CCU + ADN VPH)")).toHaveTextContent("3.424")
    expect(pctMeta("Tamizaje (CCU + ADN VPH)")).toBe("37.1%")
    expect(pctMeta("Anormales")).toBe("391.7%")
    expect(pctMeta("Colposcopia + Biopsia")).toBe("183.3%")
  })

  it("la tabla de conversión muestra 2 transiciones con sus tasas", () => {
    render(<FunnelPanel data={realData()} />)
    expect(screen.getByText("Tamizaje (CCU + ADN VPH) → Anormales")).toBeInTheDocument()
    expect(screen.getByText("Anormales → Colposcopia + Biopsia")).toBeInTheDocument()
    expect(screen.getByText("1.4%")).toBeInTheDocument()
    expect(screen.getByText("23.4%")).toBeInTheDocument()
    expect(screen.queryByText("Datos insuficientes")).not.toBeInTheDocument()
  })

  it("los selects ofrecen 4 programas y 7 opciones de EPS (Todas + 6)", async () => {
    const user = userEvent.setup()
    render(<FunnelPanel data={realData()} />)
    expect(screen.getAllByRole("combobox")[0]).toHaveTextContent("Dt Cervix")

    await user.click(screen.getAllByRole("combobox")[1])
    expect(await screen.findAllByRole("option")).toHaveLength(7)
  })
})

describe("FunnelPanel — BUG CONOCIDO: agregación municipal muestra el % de la primera EPS", () => {
  // 'Dt Colon Y Recto' no tiene entrada en STAGE_MERGE → mergedStages devuelve
  // los rows agregados SIN recalcular pct_ejecucion (heredado de la primera EPS, Nueva Eps)
  it("SOMF Realizadas muestra 9.2% (Nueva Eps) en vez del 10.1% municipal", async () => {
    const user = userEvent.setup()
    render(<FunnelPanel data={realData()} />)
    await seleccionar(user, "Programa", "Dt Colon Y Recto")

    expect(pctMeta("SOMF Realizadas")).toBe("9.2%")
    expect(filaEtapa("SOMF Realizadas")).toHaveTextContent("1.915") // acumulado SÍ está sumado
    // el valor municipal correcto sería 1915/18955.5 = 10.1%
  })

  it("SOMF Positivas muestra 4.8% en vez del 1116.7% municipal", async () => {
    const user = userEvent.setup()
    render(<FunnelPanel data={realData()} />)
    await seleccionar(user, "Programa", "Dt Colon Y Recto")
    expect(pctMeta("SOMF Positivas")).toBe("4.8%")
  })

  it("Colonoscopias muestra 0.0% en vez del 50.0% municipal", async () => {
    const user = userEvent.setup()
    render(<FunnelPanel data={realData()} />)
    await seleccionar(user, "Programa", "Dt Colon Y Recto")
    expect(pctMeta("Colonoscopias")).toBe("0.0%")
  })

  it("los % de colonoscopias sí son correctos al elegir una EPS individual", async () => {
    const user = userEvent.setup()
    render(<FunnelPanel data={realData()} />)
    await seleccionar(user, "Programa", "Dt Colon Y Recto")
    await seleccionar(user, "EPS", "Sanitas")

    expect(pctMeta("SOMF Realizadas")).toBe("6.9%")
    expect(pctMeta("Colonoscopias")).toBe("N/D") // pct_ejecucion null en Sanitas
  })
})

describe("FunnelPanel — seleccionar EPS individual", () => {
  it("al elegir una EPS el acumulado deja de ser la suma municipal", async () => {
    const user = userEvent.setup()
    render(<FunnelPanel data={realData()} />)
    await seleccionar(user, "EPS", "Nueva Eps")

    const fila = filaEtapa("Tamizaje (CCU + ADN VPH)")
    expect(fila).not.toHaveTextContent("3.424")
    expect(fila).toHaveTextContent("2.336") // CCU 2.228 + ADN VPH 108 de Nueva Eps
  })
})

describe("FunnelPanel — estados vacíos", () => {
  it("con una sola etapa la conversión muestra 'Datos insuficientes'", () => {
    const data = realData()
    const reducido = override(
      data,
      "funnel",
      data.funnel.filter(
        (f) => f.programa === "Dt Cervix" && f.stage === "Colposcopia + Biopsia",
      ),
    )
    render(<FunnelPanel data={reducido} />)
    expect(screen.getByText("Datos insuficientes")).toBeInTheDocument()
    expect(filaEtapa("Colposcopia + Biopsia")).toBeInTheDocument()
  })

  it("BUG CONOCIDO: funnel vacío no muestra mensaje de error, solo 'Datos insuficientes' en conversión", () => {
    render(<FunnelPanel data={withEmpty(realData(), "funnel")} />)
    expect(screen.getByText("Datos insuficientes")).toBeInTheDocument()
    expect(screen.getByText("Detalle por Etapa")).toBeInTheDocument()
    expect(screen.queryByText(/No hay datos/i)).not.toBeInTheDocument()
    // sin filas de etapas
    expect(screen.getAllByRole("row")).toHaveLength(3)
  })
})
