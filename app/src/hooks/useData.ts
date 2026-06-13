import { useState, useEffect } from 'react';

export interface KpiData {
  programa: string;
  indicador: string;
  label: string;
  acumulado_2026: number;
  meta_2026: number;
  poblacion: number;
  tasa_cobertura: number;
  pct_avance_meta: number;
}

export interface FunnelData {
  programa: string;
  eps: string;
  stage: string;
  tipo_indicador: string;
  poblacion_elegible: number;
  acumulado: number;
  meta: number;
  pct_ejecucion: number;
  enero: number;
  febrero: number;
  marzo: number;
}

export interface HistoricoData {
  INDICADOR_CLEAN: string;
  EPS_CLEAN: string;
  AÑO: number;
  VALOR: number;
}

export interface AlertaData {
  nivel: string;
  programa: string;
  eps: string;
  tipo: string;
  mensaje: string;
}

export interface ConsolidadoData {
  PROGRAMA: string;
  TIPO_INDICADOR: string;
  NOMBRE_INDICADOR: string;
  EPS: string;
  EJECUCION: number;
  Avance_Cumplimiento: number;
}

export interface BurnupData {
  PROGRAMA: string;
  MES: string;
  VALOR_MES: number;
  MES_ORDEN: number;
  ACUMULADO_CALCULADO: number;
}

export interface MensualData {
  PROGRAMA: string;
  TIPO_INDICADOR: string;
  EPS: string;
  MES: string;
  VALOR_MES: number;
  ACUMULADO_ACTIVIDADES: number;
  META_2026: number;
  PCT_EJECUCION: number;
  POBLACION_CORTE: number;
}

export interface ComportamientoCancerData {
  indicador: string;
  year: number;
  cases: number;
}

export interface DashboardData {
  kpis: KpiData[];
  funnel: FunnelData[];
  historico: HistoricoData[];
  alertas: AlertaData[];
  consolidado: ConsolidadoData[];
  burnup: BurnupData[];
  mensual: MensualData[];
  comportamientoCancer: ComportamientoCancerData[];
}

export function useData(): DashboardData | null {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    async function load() {
      const base = import.meta.env.BASE_URL;
      const [kpis, funnel, historico, alertas, consolidado, burnup, mensual, comportamientoCancer] = await Promise.all([
        fetch(`${base}data/kpis.json`).then(r => r.json()),
        fetch(`${base}data/funnel.json`).then(r => r.json()),
        fetch(`${base}data/historico.json`).then(r => r.json()),
        fetch(`${base}data/alertas.json`).then(r => r.json()),
        fetch(`${base}data/consolidado_eps.json`).then(r => r.json()),
        fetch(`${base}data/burnup.json`).then(r => r.json()),
        fetch(`${base}data/operativo_mensual.json`).then(r => r.json()),
        fetch(`${base}data/comportamiento_cancer.json`).then(r => r.json()),
      ]);
      setData({ kpis, funnel, historico, alertas, consolidado, burnup, mensual, comportamientoCancer });
    }
    load();
  }, []);

  return data;
}
