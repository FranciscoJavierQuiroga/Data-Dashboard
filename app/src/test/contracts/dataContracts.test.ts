import { readFileSync } from "node:fs"
import { describe, it, expect } from "vitest"
import { z } from "zod"
import {
  realKpis,
  realFunnel,
  realHistorico,
  realAlertas,
  realConsolidado,
  realBurnup,
  realMensual,
  realComportamiento,
  realPoblacion,
} from "@/test/fixtures/dashboardData"

const nullable = z.number().nullable()

const kpiSchema = z.array(
  z.object({
    programa: z.string(),
    indicador: z.string(),
    label: z.string(),
    acumulado_2026: z.number(),
    meta_2026: z.number(),
    poblacion: z.number(),
    tasa_cobertura: z.number(),
    pct_avance_meta: z.number(),
  }),
)

const funnelSchema = z.array(
  z.object({
    programa: z.string(),
    eps: z.string(),
    stage: z.string(),
    tipo_indicador: z.string(),
    poblacion_elegible: z.number(),
    acumulado: z.number(),
    meta: z.number(),
    pct_ejecucion: nullable,
    enero: nullable,
    febrero: nullable,
    marzo: nullable,
  }),
)

const historicoSchema = z.array(
  z.object({
    INDICADOR_CLEAN: z.string(),
    EPS_CLEAN: z.string(),
    AÑO: z.number(),
    VALOR: z.number(),
  }),
)

const alertasSchema = z.array(
  z.object({
    nivel: z.string(),
    programa: z.string(),
    eps: z.string(),
    tipo: z.string(),
    mensaje: z.string(),
  }),
)

const consolidadoSchema = z.array(
  z.object({
    PROGRAMA: z.string(),
    TIPO_INDICADOR: z.string(),
    NOMBRE_INDICADOR: z.string(),
    EPS: z.string(),
    EJECUCION: nullable,
    Avance_Cumplimiento: nullable,
  }),
)

const burnupSchema = z.array(
  z.object({
    PROGRAMA: z.string(),
    MES: z.string(),
    VALOR_MES: z.number(),
    MES_ORDEN: z.number(),
    ACUMULADO_CALCULADO: z.number(),
  }),
)

const mensualSchema = z.array(
  z.object({
    PROGRAMA: z.string(),
    TIPO_INDICADOR: z.string(),
    EPS: z.string(),
    MES: z.string(),
    VALOR_MES: z.number(),
    ACUMULADO_ACTIVIDADES: z.number(),
    META_2026: z.number(),
    PCT_EJECUCION: nullable,
    POBLACION_CORTE: nullable,
  }),
)

const comportamientoSchema = z.array(
  z.object({
    indicador: z.string(),
    year: z.number(),
    cases: z.number(),
  }),
)

const poblacionSchema = z.array(
  z.object({
    year: z.number(),
    poblacion: z.number(),
  }),
)

const MONTHS_ORDER = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
]

function approx(a: number, b: number, tolerance = 1e-6) {
  return Math.abs(a - b) <= tolerance
}

describe("contratos de esquema (9 JSON)", () => {
  it("kpis.json cumple su esquema", () => {
    expect(() => kpiSchema.parse(realKpis)).not.toThrow()
  })
  it("funnel.json cumple su esquema (con nulls permitidos)", () => {
    expect(() => funnelSchema.parse(realFunnel)).not.toThrow()
  })
  it("historico.json cumple su esquema", () => {
    expect(() => historicoSchema.parse(realHistorico)).not.toThrow()
  })
  it("alertas.json cumple su esquema", () => {
    expect(() => alertasSchema.parse(realAlertas)).not.toThrow()
  })
  it("consolidado_eps.json cumple su esquema (con nulls permitidos)", () => {
    expect(() => consolidadoSchema.parse(realConsolidado)).not.toThrow()
  })
  it("burnup.json cumple su esquema", () => {
    expect(() => burnupSchema.parse(realBurnup)).not.toThrow()
  })
  it("operativo_mensual.json cumple su esquema (con nulls permitidos)", () => {
    expect(() => mensualSchema.parse(realMensual)).not.toThrow()
  })
  it("comportamiento_cancer.json cumple su esquema", () => {
    expect(() => comportamientoSchema.parse(realComportamiento)).not.toThrow()
  })
  it("poblacion_sogamoso.json cumple su esquema", () => {
    expect(() => poblacionSchema.parse(realPoblacion)).not.toThrow()
  })
})

describe("DOCUMENTACIÓN: la interfaz DashboardData miente sobre null", () => {
  // useData.ts declara pct_ejecucion/EJECUCION/etc. como `number`, pero los
  // JSON reales contienen `null`. Este contrato fija cuántos nulls hay hoy,
  // para que cualquier cambio en analisis.py se detecte aquí.
  it("funnel.pct_ejecucion tiene exactamente 7 nulls", () => {
    const nulls = realFunnel.filter((r) => r.pct_ejecucion === null)
    expect(nulls).toHaveLength(7)
  })
  it("funnel tiene nulls en enero/febrero/marzo", () => {
    expect(realFunnel.filter((r) => r.enero === null)).toHaveLength(2)
    expect(realFunnel.filter((r) => r.febrero === null)).toHaveLength(2)
    expect(realFunnel.filter((r) => r.marzo === null)).toHaveLength(22)
  })
  it("consolidado tiene 7 nulls en EJECUCION y 18 en Avance_Cumplimiento", () => {
    expect(realConsolidado.filter((r) => r.EJECUCION === null)).toHaveLength(7)
    expect(realConsolidado.filter((r) => r.Avance_Cumplimiento === null)).toHaveLength(18)
  })
  it("operativo_mensual tiene nulls en PCT_EJECUCION y POBLACION_CORTE", () => {
    expect(realMensual.filter((r) => r.PCT_EJECUCION === null)).toHaveLength(26)
    expect(realMensual.filter((r) => r.POBLACION_CORTE === null)).toHaveLength(173)
  })
})

describe("kpis.json", () => {
  it("tiene 7 filas, todas de indicadores de COBERTURA", () => {
    expect(realKpis).toHaveLength(7)
    for (const k of realKpis) {
      expect(k.indicador).toContain("COBERTURA")
    }
  })
  it("pct_avance_meta === round(acumulado/meta, 4)", () => {
    for (const k of realKpis) {
      expect(approx(k.pct_avance_meta, Math.round((k.acumulado_2026 / k.meta_2026) * 1e4) / 1e4, 1e-4)).toBe(true)
    }
  })
  it("tasa_cobertura === round(acumulado/poblacion, 4)", () => {
    for (const k of realKpis) {
      expect(approx(k.tasa_cobertura, Math.round((k.acumulado_2026 / k.poblacion) * 1e4) / 1e4, 1e-4)).toBe(true)
    }
  })
  it("los 4 programas representados", () => {
    const programas = [...new Set(realKpis.map((k) => k.programa))].sort()
    expect(programas).toEqual(["Dt Cervix", "Dt Colon Y Recto", "Dt Mama", "Dt Prostata"])
  })
})

describe("alertas.json", () => {
  it("niveles solo crítico/alto/medio con conteos 7/3/8", () => {
    const niveles = new Set(realAlertas.map((a) => a.nivel))
    expect([...niveles].sort()).toEqual(["alto", "crítico", "medio"])
    expect(realAlertas.filter((a) => a.nivel === "crítico")).toHaveLength(7)
    expect(realAlertas.filter((a) => a.nivel === "alto")).toHaveLength(3)
    expect(realAlertas.filter((a) => a.nivel === "medio")).toHaveLength(8)
  })
  it("18 alertas en total, todas con mensaje no vacío", () => {
    expect(realAlertas).toHaveLength(18)
    for (const a of realAlertas) expect(a.mensaje.length).toBeGreaterThan(0)
  })
})

describe("funnel.json", () => {
  const epsEsperadas = ["Coosalud", "Famisanar", "Nueva Eps", "Proteger", "Salud Total", "Sanitas"]
  it("6 EPS y 4 programas", () => {
    expect([...new Set(realFunnel.map((f) => f.eps))].sort()).toEqual(epsEsperadas)
    expect([...new Set(realFunnel.map((f) => f.programa))].sort()).toEqual([
      "Dt Cervix", "Dt Colon Y Recto", "Dt Mama", "Dt Prostata",
    ])
  })
  it("pct_ejecucion === acumulado/meta cuando meta !== 1 (denominador real)", () => {
    const filas = realFunnel.filter(
      (f) => f.pct_ejecucion !== null && f.meta !== null && f.meta !== 1,
    )
    expect(filas.length).toBeGreaterThan(40)
    for (const f of filas) {
      expect(approx(f.pct_ejecucion as number, f.acumulado / f.meta)).toBe(true)
    }
  })
  it("meta === 1 es un placeholder: esas filas NO cumplen pct === acum/meta", () => {
    const placeholders = realFunnel.filter((f) => f.pct_ejecucion !== null && f.meta === 1)
    expect(placeholders).toHaveLength(47)
    const inconsistentes = placeholders.filter(
      (f) => !approx(f.pct_ejecucion as number, f.acumulado / f.meta),
    )
    expect(inconsistentes).toHaveLength(26)
  })
  it("pct_ejecucion puede superar 1.0 (8 filas) — base del '210.5%' de DetailPanel", () => {
    const sobre100 = realFunnel.filter(
      (f) => f.pct_ejecucion !== null && f.pct_ejecucion > 1,
    )
    expect(sobre100).toHaveLength(8)
  })
})

describe("operativo_mensual.json", () => {
  it("MES ⊆ MONTHS_ORDER; datos hasta ABRIL", () => {
    for (const r of realMensual) expect(MONTHS_ORDER).toContain(r.MES)
    const meses = [...new Set(realMensual.map((r) => r.MES))]
    expect(meses.sort((a, b) => MONTHS_ORDER.indexOf(a) - MONTHS_ORDER.indexOf(b))).toEqual([
      "ENERO", "FEBRERO", "MARZO", "ABRIL",
    ])
  })
  it("hay filas con VALOR_MES > 0 en ABRIL (define monthRange 'Ene-Abr')", () => {
    const abril = realMensual.filter((r) => r.MES === "ABRIL" && r.VALOR_MES > 0)
    expect(abril.length).toBeGreaterThan(0)
  })
  it("PCT_EJECUCION === ACUMULADO/META cuando META_2026 !== 1", () => {
    const filas = realMensual.filter(
      (r) => r.PCT_EJECUCION !== null && r.META_2026 !== 1,
    )
    expect(filas.length).toBeGreaterThan(100)
    for (const r of filas) {
      expect(approx(r.PCT_EJECUCION as number, r.ACUMULADO_ACTIVIDADES / r.META_2026)).toBe(true)
    }
  })
  it("mismas 6 EPS que funnel", () => {
    const epsMen = [...new Set(realMensual.map((r) => r.EPS))].sort()
    const epsFunnel = [...new Set(realFunnel.map((r) => r.eps))].sort()
    expect(epsMen).toEqual(epsFunnel)
  })
})

describe("burnup.json", () => {
  it("16 filas: 4 programas × 4 meses", () => {
    expect(realBurnup).toHaveLength(16)
    const porPrograma = new Map<string, number>()
    for (const r of realBurnup) {
      porPrograma.set(r.PROGRAMA, (porPrograma.get(r.PROGRAMA) ?? 0) + 1)
    }
    expect([...porPrograma.values()].every((n) => n === 4)).toBe(true)
  })
  it("ACUMULADO_CALCULADO === suma acumulada de VALOR_MES por programa", () => {
    for (const programa of [...new Set(realBurnup.map((r) => r.PROGRAMA))]) {
      const filas = realBurnup
        .filter((r) => r.PROGRAMA === programa)
        .sort((a, b) => a.MES_ORDEN - b.MES_ORDEN)
      let suma = 0
      for (const fila of filas) {
        suma += fila.VALOR_MES
        expect(fila.ACUMULADO_CALCULADO).toBe(suma)
      }
    }
  })
  it("el acumulado final de cada programa coincide con al menos un kpis", () => {
    for (const programa of [...new Set(realBurnup.map((r) => r.PROGRAMA))]) {
      const filas = realBurnup.filter((r) => r.PROGRAMA === programa)
      const ultimo = Math.max(...filas.map((r) => r.ACUMULADO_CALCULADO))
      const kpisPrograma = realKpis.filter((k) => k.programa === programa)
      expect(kpisPrograma.some((k) => k.acumulado_2026 === ultimo)).toBe(true)
    }
  })
})

describe("historico.json", () => {
  it("años exactamente 2021..2025", () => {
    const años = [...new Set(realHistorico.map((h) => h.AÑO))].sort()
    expect(años).toEqual([2021, 2022, 2023, 2024, 2025])
  })
  it("incluye la fila agregada 'Total Municipio'", () => {
    expect([...new Set(realHistorico.map((h) => h.EPS_CLEAN))]).toContain("Total Municipio")
  })
  it("VALOR dentro de [0, 1] (es una proporción)", () => {
    for (const h of realHistorico) {
      expect(h.VALOR).toBeGreaterThanOrEqual(0)
      expect(h.VALOR).toBeLessThanOrEqual(1)
    }
  })
})

describe("consolidado_eps.json", () => {
  it("usa nombres de EPS con guion bajo: Nueva_Eps, Salud_Total, Cajacopi", () => {
    expect([...new Set(realConsolidado.map((c) => c.EPS))].sort()).toEqual([
      "Cajacopi", "Coosalud", "Famisanar", "Nueva_Eps", "Salud_Total", "Sanitas",
    ])
  })
  it("EJECUCION puede superar 1.0 (8 filas)", () => {
    const sobre100 = realConsolidado.filter((c) => c.EJECUCION !== null && c.EJECUCION > 1)
    expect(sobre100).toHaveLength(8)
  })
  it("programas con vocabulario distinto al resto del proyecto (DT cervix vs Dt Cervix)", () => {
    expect([...new Set(realConsolidado.map((c) => c.PROGRAMA))].sort()).toEqual([
      "DT Colon y Recto", "DT Prostata", "DT cervix", "DT mama",
    ])
  })
})

describe("comportamiento_cancer.json", () => {
  it("5 enfermedades × 21 años (2005-2025) = 105 filas", () => {
    expect(realComportamiento).toHaveLength(105)
    const indicadores = [...new Set(realComportamiento.map((c) => c.indicador))].sort()
    expect(indicadores).toEqual(["Colon y Recto", "Cuello Uterino", "Mama", "Próstata", "Pulmón"])
    for (const ind of indicadores) {
      const años = realComportamiento
        .filter((c) => c.indicador === ind)
        .map((c) => c.year)
        .sort((a, b) => a - b)
      expect(años).toEqual(Array.from({ length: 21 }, (_, i) => 2005 + i))
    }
  })
  it("cases >= 0", () => {
    for (const c of realComportamiento) expect(c.cases).toBeGreaterThanOrEqual(0)
  })
  it("el archivo tiene BOM UTF-8 (solo legible con codificación utf-8-sig)", () => {
    const buffer = readFileSync("public/data/comportamiento_cancer.json")
    expect([0xef, 0xbb, 0xbf]).toEqual([...buffer.subarray(0, 3)])
  })
})

describe("poblacion_sogamoso.json", () => {
  it("38 años consecutivos 2005-2042 en orden creciente", () => {
    expect(realPoblacion).toHaveLength(38)
    const años = realPoblacion.map((p) => p.year)
    expect(años[0]).toBe(2005)
    expect(años[años.length - 1]).toBe(2042)
    for (let i = 1; i < años.length; i++) {
      expect(años[i]).toBe(años[i - 1] + 1)
    }
  })
  it("la población 2025 es 137839 (valor hardcodeado en PoissonPanel)", () => {
    expect(realPoblacion.find((p) => p.year === 2025)?.poblacion).toBe(137839)
  })
})

describe("consistencia cruzada entre archivos", () => {
  it("todo programa de kpis/alertas/burnup existe en funnel", () => {
    const programasFunnel = new Set(realFunnel.map((f) => f.programa))
    for (const k of realKpis) expect(programasFunnel.has(k.programa)).toBe(true)
    for (const a of realAlertas) expect(programasFunnel.has(a.programa)).toBe(true)
    for (const b of realBurnup) expect(programasFunnel.has(b.PROGRAMA)).toBe(true)
  })
  it("todo (programa, indicador) de kpis existe en funnel (base del cálculo de KPI por EPS)", () => {
    const paresFunnel = new Set(realFunnel.map((f) => `${f.programa}|${f.tipo_indicador}`))
    for (const k of realKpis) {
      expect(paresFunnel.has(`${k.programa}|${k.indicador}`)).toBe(true)
    }
  })
  it("todo indicador de kpis existe en operativo_mensual", () => {
    const tiposMensual = new Set(realMensual.map((m) => m.TIPO_INDICADOR))
    for (const k of realKpis) expect(tiposMensual.has(k.indicador)).toBe(true)
  })
  it("DISCREPANCIA documentada: EPS de consolidado ≠ EPS de funnel/mensual", () => {
    const epsFunnel = [...new Set(realFunnel.map((f) => f.eps))].sort()
    const epsConsolidado = [...new Set(realConsolidado.map((c) => c.EPS))].sort()
    expect(epsConsolidado).not.toEqual(epsFunnel)
    // 'Proteger' existe en funnel pero no en consolidado; 'Cajacopi' al revés
    expect(epsFunnel).toContain("Proteger")
    expect(epsConsolidado).not.toContain("Proteger")
    expect(epsConsolidado).toContain("Cajacopi")
    expect(epsFunnel).not.toContain("Cajacopi")
    // y los nombres con espacio usan guion bajo en consolidado
    expect(epsConsolidado).toContain("Nueva_Eps")
    expect(epsFunnel).toContain("Nueva Eps")
  })
  it("DISCREPANCIA documentada: vocabulario de programas difiere entre archivos", () => {
    const programasConsolidado = new Set(realConsolidado.map((c) => c.PROGRAMA))
    const programasFunnel = new Set(realFunnel.map((f) => f.programa))
    // ninguna clave de consolidado coincide exactamente con funnel
    for (const p of programasConsolidado) expect(programasFunnel.has(p)).toBe(false)
  })
})
