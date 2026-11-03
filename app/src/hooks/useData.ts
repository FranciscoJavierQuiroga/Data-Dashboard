import { useState, useEffect } from 'react';
import { getDashboard } from '@/lib/api';

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

export interface PoblacionData {
  year: number;
  poblacion: number;
}

// ─── Proyección Poisson (GLM ajustado en backend) ──────────────────────────

export interface ProyeccionObservado {
  year: number;
  cases: number;
  poblacion: number;
  rate_observed: number | null;
}

export interface ProyeccionFitted {
  year: number;
  rate_fitted: number;
  cases_fitted: number;
}

export interface ProyeccionModelo {
  beta0: number;
  beta1: number;
  cov_beta0_beta0: number;
  cov_beta1_beta1: number;
  cov_beta0_beta1: number;
  dispersion: number;
  overdispersed: boolean;
  cpae_pct: number;
  cpae_ci_low: number;
  cpae_ci_high: number;
  deviance: number;
  df_resid: number;
  aic: number;
}

export interface ProyeccionPoissonData {
  indicador: string;
  n_years: number;
  first_year: number;
  last_year: number;
  observed: ProyeccionObservado[];
  model: ProyeccionModelo | null;
  fitted: ProyeccionFitted[] | null;
  warning: string | null;
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
  poblacion: PoblacionData[];
  proyeccionPoisson: ProyeccionPoissonData[];
}

export const EMPTY_DASHBOARD: DashboardData = {
  kpis: [],
  funnel: [],
  historico: [],
  alertas: [],
  consolidado: [],
  burnup: [],
  mensual: [],
  comportamientoCancer: [],
  poblacion: [],
  proyeccionPoisson: [],
};

async function loadStaticData(): Promise<DashboardData> {
  const base = import.meta.env.BASE_URL;
  const [kpis, funnel, historico, alertas, consolidado, burnup, mensual, comportamientoCancer, poblacion, proyeccionPoisson] =
    await Promise.all([
      fetch(`${base}data/kpis.json`).then(r => r.json()),
      fetch(`${base}data/funnel.json`).then(r => r.json()),
      fetch(`${base}data/historico.json`).then(r => r.json()),
      fetch(`${base}data/alertas.json`).then(r => r.json()),
      fetch(`${base}data/consolidado_eps.json`).then(r => r.json()),
      fetch(`${base}data/burnup.json`).then(r => r.json()),
      fetch(`${base}data/operativo_mensual.json`).then(r => r.json()),
      fetch(`${base}data/comportamiento_cancer.json`).then(r => r.json()),
      fetch(`${base}data/poblacion_sogamoso.json`).then(r => r.json()),
      fetch(`${base}data/proyeccion_poisson.json`).then(r => r.json()),
    ]);
  return {
    kpis,
    funnel,
    historico,
    alertas,
    consolidado,
    burnup,
    mensual,
    comportamientoCancer,
    poblacion,
    proyeccionPoisson,
  };
}

export function useData(): DashboardData | null {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const apiData = await getDashboard<DashboardData>();
        if (active) setData(apiData);
        return;
      } catch {
        // Sin API disponible: se conserva el modo estático para GitHub Pages.
      }
      try {
        const staticData = await loadStaticData();
        if (active) setData(staticData);
      } catch {
        if (active) setData(EMPTY_DASHBOARD);
      }
    }

    load();
    window.addEventListener('dashboard:refresh', load);
    return () => {
      active = false;
      window.removeEventListener('dashboard:refresh', load);
    };
  }, []);

  return data;
}
