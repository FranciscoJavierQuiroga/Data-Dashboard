import type { DashboardData } from "@/hooks/useData"

import kpisJson from "../../../public/data/kpis.json"
import funnelJson from "../../../public/data/funnel.json"
import historicoJson from "../../../public/data/historico.json"
import alertasJson from "../../../public/data/alertas.json"
import consolidadoJson from "../../../public/data/consolidado_eps.json"
import burnupJson from "../../../public/data/burnup.json"
import mensualJson from "../../../public/data/operativo_mensual.json"
import comportamientoJson from "../../../public/data/comportamiento_cancer.json"
import poblacionJson from "../../../public/data/poblacion_sogamoso.json"

export const realKpis = kpisJson
export const realFunnel = funnelJson
export const realHistorico = historicoJson
export const realAlertas = alertasJson
export const realConsolidado = consolidadoJson
export const realBurnup = burnupJson
export const realMensual = mensualJson
export const realComportamiento = comportamientoJson
export const realPoblacion = poblacionJson

/**
 * Fixture base: los 9 datasets reales del dashboard.
 * Se castea porque los JSON contienen `null` en campos que la interfaz
 * `DashboardData` declara como `number` (documentado en dataContracts.test.ts).
 */
export function realData(): DashboardData {
  return {
    kpis: kpisJson as DashboardData["kpis"],
    funnel: funnelJson as DashboardData["funnel"],
    historico: historicoJson as DashboardData["historico"],
    alertas: alertasJson as DashboardData["alertas"],
    consolidado: consolidadoJson as DashboardData["consolidado"],
    burnup: burnupJson as DashboardData["burnup"],
    mensual: mensualJson as DashboardData["mensual"],
    comportamientoCancer: comportamientoJson as DashboardData["comportamientoCancer"],
    poblacion: poblacionJson as DashboardData["poblacion"],
  }
}

export function withEmpty<K extends keyof DashboardData>(
  data: DashboardData,
  key: K,
): DashboardData {
  return { ...data, [key]: [] as unknown as DashboardData[K] }
}

export function override<K extends keyof DashboardData>(
  data: DashboardData,
  key: K,
  rows: DashboardData[K],
): DashboardData {
  return { ...data, [key]: rows }
}
