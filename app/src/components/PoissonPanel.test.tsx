import { describe, it, expect } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PoissonPanel } from "@/components/PoissonPanel"
import { realData } from "@/test/fixtures/dashboardData"

function metricPorTitulo(titulo: string): HTMLElement {
  return screen.getByText(titulo).parentElement as HTMLElement
}

async function seleccionarPatologia(user: ReturnType<typeof userEvent.setup>, patologia: string) {
  await user.click(screen.getByRole("combobox"))
  await user.click(await screen.findByRole("option", { name: patologia }))
}

async function activarFactor(user: ReturnType<typeof userEvent.setup>, nombre: RegExp) {
  await user.click(screen.getByRole("switch", { name: nombre }))
}

function inputRrDe(switchEl: HTMLElement): HTMLInputElement {
  const fila = switchEl.closest("div") as HTMLElement
  return fila.querySelector('input[type="number"]') as HTMLInputElement
}

describe("PoissonPanel — render inicial (Cáncer de Mama)", () => {
  it("muestra la nota metodológica con la promesa del IC 95% en el gráfico", () => {
    render(<PoissonPanel data={realData()} />)
    expect(screen.getByText("Proyección a 10 años")).toBeInTheDocument()
    expect(
      screen.getByText(/Las barras proyectadas muestran el IC 95% \(Poisson\)/),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/tasa base se obtiene de los datos históricos de mortalidad/),
    ).toBeInTheDocument()
  })

  it("identifica la fuente de datos de la patología", () => {
    render(<PoissonPanel data={realData()} />)
    expect(screen.getByText("Comportamiento Cáncer · Mama (2005-2025)")).toBeInTheDocument()
    expect(
      screen.getByText("Datos históricos (2005-2025) · Proyección (10 años)"),
    ).toBeInTheDocument()
  })

  it("la tabla tiene 21 filas históricas + 10 proyectadas = 31 datos", () => {
    render(<PoissonPanel data={realData()} />)
    const tabla = screen.getByText("Proyección Detallada por Año").closest('[data-slot="card"]')!
    // header + 31 filas + footer
    expect(within(tabla).getAllByRole("row")).toHaveLength(33)
    expect(within(tabla).getByText("2026")).toBeInTheDocument()
    expect(within(tabla).getByText("2035")).toBeInTheDocument()
    expect(within(tabla).getByText("Total 10 años (proyectado)")).toBeInTheDocument()
  })

  it("las filas históricas muestran '—' en las columnas del IC", () => {
    render(<PoissonPanel data={realData()} />)
    const tabla = screen.getByText("Proyección Detallada por Año").closest('[data-slot="card"]')!
    expect(within(tabla).getAllByText("—")).toHaveLength(42) // 21 filas × 2 columnas
  })
})

describe("PoissonPanel — BUG CONOCIDO: la regresión no es Poisson y la tendencia sale 0.00%", () => {
  it("la tarjeta 'Tasa de crecimiento anual' siempre muestra 0.00%", () => {
    render(<PoissonPanel data={realData()} />)
    const card = metricPorTitulo("Tasa de crecimiento anual")
    expect(card).toHaveTextContent("0.00%")
    expect(card).toHaveTextContent("Pendiente de regresión lineal")
  })

  it("el bloque de tendencia muestra pendiente 0.00% y R² = 0.070 (la tendencia es ruido)", () => {
    render(<PoissonPanel data={realData()} />)
    expect(screen.getByText("Tendencia lineal: pendiente = 0.00% anual")).toBeInTheDocument()
    expect(screen.getByText("R² = 0.070")).toBeInTheDocument()
    expect(screen.getByText("Tasa base actual: 0.01%")).toBeInTheDocument()
  })

  it("el IC mostrado es Wald (casos ± 1.96·√casos), no un IC exacto de Poisson", () => {
    render(<PoissonPanel data={realData()} />)
    // 2026: casos 11 → [4, 18]  (Garwood exacto sería [5.49, 19.68])
    const filas = screen.getAllByRole("row")
    const fila2026 = filas.find((f) => f.textContent?.startsWith("2026"))!
    const celdas = within(fila2026).getAllByRole("cell")
    // Año | Población | Tasa | Casos base | IC inf | IC sup
    expect(celdas[1]).toHaveTextContent("138.796")
    expect(celdas[3]).toHaveTextContent("11")
    expect(celdas[4]).toHaveTextContent("4")
    expect(celdas[5]).toHaveTextContent("18")
  })
})

describe("PoissonPanel — métricas de resumen", () => {
  it("Casos esperados año 1 = 11 (2026) y acumulados 10 años = 120", () => {
    render(<PoissonPanel data={realData()} />)
    const card1 = metricPorTitulo("Casos esperados año 1")
    expect(card1).toHaveTextContent("11")
    expect(card1).toHaveTextContent("2026")

    const card2 = metricPorTitulo("Casos acumulados a 10 años")
    expect(card2).toHaveTextContent("120")
    expect(card2).toHaveTextContent("Sin factores de riesgo")
  })

  it("el footer suma 120 casos proyectados", () => {
    render(<PoissonPanel data={realData()} />)
    const tabla = screen.getByText("Proyección Detallada por Año").closest('[data-slot="card"]')!
    const footer = within(tabla).getByText(/Total 10 años/).closest("tr")!
    expect(footer).toHaveTextContent("120")
  })
})

describe("PoissonPanel — slider de años", () => {
  it("sube a 11 años con la tecla flecha y actualiza tabla y métricas", async () => {
    const user = userEvent.setup()
    render(<PoissonPanel data={realData()} />)
    expect(screen.getByText("Años a proyectar: 10")).toBeInTheDocument()

    const thumb = screen.getByRole("slider")
    thumb.focus()
    await user.keyboard("{ArrowRight}")

    expect(screen.getByText("Años a proyectar: 11")).toBeInTheDocument()
    expect(screen.getByText("Proyección a 11 años")).toBeInTheDocument()
    expect(screen.getByText("Total 11 años (proyectado)")).toBeInTheDocument()
    expect(screen.getByText("Casos acumulados a 11 años")).toBeInTheDocument()
    // 21 históricas + 11 proyectadas
    expect(screen.getAllByRole("row")).toHaveLength(34)
  })
})

describe("PoissonPanel — factores de riesgo", () => {
  it("activar BRCA (RR 10) ajusta la proyección y añade columnas/leyenda", async () => {
    const user = userEvent.setup()
    render(<PoissonPanel data={realData()} />)
    await activarFactor(user, /Mutación BRCA1\/BRCA2/)

    expect(screen.getByText("Casos ajustados")).toBeInTheDocument()
    expect(screen.getByText("Ajustado por RR")).toBeInTheDocument()
    expect(screen.getByText("Base (sin RR)")).toBeInTheDocument()
    // 120 base × RR 10 → 1.200 ajustados
    const card = metricPorTitulo("Casos acumulados a 10 años")
    expect(card).toHaveTextContent("1.200")
    expect(card).toHaveTextContent("120 base · RR 10.00×")
  })

  it("dos factores activos muestran la multiplicación combinada", async () => {
    const user = userEvent.setup()
    render(<PoissonPanel data={realData()} />)
    await activarFactor(user, /Antecedentes familiares 1\.° grado/)
    await activarFactor(user, /Mutación BRCA1\/BRCA2/)

    const p = screen.getByText(/RR combinado = /)
    expect(p).toHaveTextContent("RR combinado = 2.1 × 10.0 = 21.00×.")
    expect(p).toHaveTextContent("Multiplicación asume independencia — puede sobreestimar.")
  })

  it("BUG CONOCIDO: el cap de RR 50 contradice los operandos mostrados (1242 → 50.00×)", async () => {
    const user = userEvent.setup()
    render(<PoissonPanel data={realData()} />)
    await seleccionarPatologia(user, "Cáncer de Cérvix")
    expect(screen.getByText("Comportamiento Cáncer · Cuello Uterino (2005-2025)")).toBeInTheDocument()

    for (const factor of [
      /Infección VPH oncogénico/,
      /Fumadora activa/,
      /VIH positivo/,
      /Antecedentes familiares/,
      /Uso de ACO/,
      /Múltiples parejas/,
    ]) {
      await activarFactor(user, factor)
    }

    const p = screen.getByText(/RR combinado = /)
    // 20 × 2.3 × 5 × 1.8 × 1.5 × 2 = 1242, pero se muestra 50.00×
    expect(p).toHaveTextContent("RR combinado = 20.0 × 2.3 × 5.0 × 1.8 × 1.5 × 2.0 = 50.00×.")
  })

  it("BUG CONOCIDO: un RR negativo propaga NaN a los intervalos de confianza", async () => {
    const user = userEvent.setup()
    render(<PoissonPanel data={realData()} />)
    const sw = screen.getByRole("switch", { name: /Mutación BRCA1\/BRCA2/ })
    await user.click(sw)

    fireEvent.change(inputRrDe(sw), { target: { value: "-2" } })

    // casos ajustados = casos base × -2 → Math.sqrt(negativo) = NaN
    expect(screen.getAllByText("NaN").length).toBeGreaterThan(0)
    const card = metricPorTitulo("Casos acumulados a 10 años")
    expect(card).toHaveTextContent("-240")
    expect(card).toHaveTextContent("120 base · RR -2.00×")
  })
})

describe("PoissonPanel — patología Personalizada", () => {
  it("muestra el input de tasa y usa la nota de 'sin datos históricos'", async () => {
    const user = userEvent.setup()
    render(<PoissonPanel data={realData()} />)
    await seleccionarPatologia(user, "Personalizada")

    expect(screen.getByText("Ingrese su propia tasa")).toBeInTheDocument()
    expect(
      screen.getByText(/No hay datos históricos disponibles en el dashboard para esta patología/),
    ).toBeInTheDocument()
    const labelTasa = screen.getByText("Tasa de incidencia (por persona-año)")
    expect(labelTasa.parentElement!.querySelector("input")).not.toBeNull()
    // sin regresión no hay bloque de tendencia
    expect(screen.queryByText(/R² =/)).not.toBeInTheDocument()
    expect(metricPorTitulo("Tasa de crecimiento anual")).toHaveTextContent("—")
  })

  it("proyecta con la tasa de referencia: 139 casos en 2026 y 1.435 en 10 años", async () => {
    const user = userEvent.setup()
    render(<PoissonPanel data={realData()} />)
    await seleccionarPatologia(user, "Personalizada")

    expect(screen.getByText(/Tasa base: 0\.10%/)).toBeInTheDocument()
    const card1 = metricPorTitulo("Casos esperados año 1")
    expect(card1).toHaveTextContent("139")
    const card2 = metricPorTitulo("Casos acumulados a 10 años")
    expect(card2).toHaveTextContent("1.435")
  })

  it("BUG CONOCIDO: el empty-state 'No hay datos disponibles' es inalcanzable (siempre proyecta ≥5 años)", async () => {
    const user = userEvent.setup()
    render(<PoissonPanel data={realData()} />)
    await seleccionarPatologia(user, "Personalizada")

    expect(
      screen.queryByText("No hay datos disponibles para la proyección"),
    ).not.toBeInTheDocument()
    // 0 históricas + 10 proyectadas
    expect(screen.getAllByRole("row")).toHaveLength(12)
  })
})
