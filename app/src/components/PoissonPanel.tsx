import { useMemo, useState, useCallback } from 'react';
import { Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart, Cell, ErrorBar } from 'recharts';
import type { DashboardData } from '@/hooks/useData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Activity, Info, TrendingUp } from 'lucide-react';

// ─── Disease → Dashboard Data Mapping ────────────────────────────────────────────

interface DiseaseMapping {
  program: string;
  historicoKey: string;
  kpiIndicators: string[];
}

const DISEASE_MAP: Record<string, DiseaseMapping | null> = {
  'Cáncer de Mama':     { program: 'Dt Mama', historicoKey: 'Mama', kpiIndicators: ['COBERTURA MAMOGRAFIA'] },
  'Cáncer de Cérvix':   { program: 'Dt Cervix', historicoKey: 'Cuello Uterino', kpiIndicators: ['COBERTURA CCU'] },
  'Cáncer de Próstata': { program: 'Dt Prostata', historicoKey: 'Próstata', kpiIndicators: ['COBERTURA PSA'] },
  'Cáncer de Colon':    { program: 'Dt Colon Y Recto', historicoKey: 'Colon y Recto', kpiIndicators: ['COBERTURA TAMIZACION SANGRE OCULTA EN HECES'] },
  'Cáncer de Pulmón':   { program: 'Dt Pulmon', historicoKey: 'Pulmón', kpiIndicators: [] },
  'Personalizada':      null,
};

// ─── Presets de patologías (fallback cuando no hay modelo ajustado) ───────────────

const DISEASE_PRESETS: Record<string, { rate: number; desc: string }> = {
  'Cáncer de Pulmón':    { rate: 0.00061, desc: '61 por 100.000 · Globocan Colombia' },
  'Cáncer de Mama':      { rate: 0.00103, desc: '103 por 100.000 · Globocan Colombia' },
  'Cáncer de Cérvix':    { rate: 0.00036, desc: '36 por 100.000 · Globocan Colombia' },
  'Cáncer de Próstata':  { rate: 0.00107, desc: '107 por 100.000 · Globocan Colombia' },
  'Cáncer de Colon':     { rate: 0.00028, desc: '28 por 100.000 · Globocan Colombia' },
  'Personalizada':       { rate: 0.001,   desc: 'Ingrese su propia tasa' },
};

// ─── Factores de riesgo por patología ──────────────────────────────────────────────

interface RiskFactor {
  id: string;
  label: string;
  rr: string;
  active: boolean;
}

const RISK_FACTORS_BY_DISEASE: Record<string, RiskFactor[]> = {
  'Cáncer de Pulmón': [
    { id: 'smoking', label: 'Fumador activo',           rr: '15.0', active: false },
    { id: 'exsmoking', label: 'Exfumador (>10 años)',   rr: '4.0',  active: false },
    { id: 'family',  label: 'Antecedentes familiares',  rr: '2.0',  active: false },
    { id: 'age',     label: 'Edad > 50 años',           rr: '2.0',  active: false },
    { id: 'radon',   label: 'Exposición a radón',       rr: '1.7',  active: false },
    { id: 'asbesto', label: 'Exposición a asbesto',     rr: '5.0',  active: false },
  ],
  'Cáncer de Mama': [
    { id: 'family',   label: 'Antecedentes familiares 1.° grado', rr: '2.1', active: false },
    { id: 'brca',     label: 'Mutación BRCA1/BRCA2',              rr: '10.0', active: false },
    { id: 'age',      label: 'Edad > 50 años',                    rr: '2.0',  active: false },
    { id: 'obesity',  label: 'Obesidad (IMC ≥ 30) posmenopáusica',rr: '1.4',  active: false },
    { id: 'alcohol',  label: 'Consumo alto de alcohol',           rr: '1.4',  active: false },
    { id: 'nullipara',label: 'Nuliparidad',                       rr: '1.3',  active: false },
    { id: 'hrt',      label: 'TRH combinada > 5 años',            rr: '1.6',  active: false },
  ],
  'Cáncer de Cérvix': [
    { id: 'hpv',       label: 'Infección VPH oncogénico (16/18)', rr: '20.0', active: false },
    { id: 'smoking',   label: 'Fumadora activa',                  rr: '2.3',  active: false },
    { id: 'hiv',       label: 'VIH positivo',                     rr: '5.0',  active: false },
    { id: 'family',    label: 'Antecedentes familiares',          rr: '1.8',  active: false },
    { id: 'aco',       label: 'Uso de ACO > 5 años',              rr: '1.5',  active: false },
    { id: 'partners',  label: 'Múltiples parejas sexuales',       rr: '2.0',  active: false },
  ],
  'Cáncer de Próstata': [
    { id: 'family',   label: 'Antecedentes familiares 1.° grado', rr: '2.5',  active: false },
    { id: 'brca2',    label: 'Mutación BRCA2',                    rr: '5.0',  active: false },
    { id: 'age',      label: 'Edad > 65 años',                    rr: '3.0',  active: false },
    { id: 'ethnicity',label: 'Ascendencia africana',              rr: '1.7',  active: false },
    { id: 'obesity',  label: 'Obesidad (IMC ≥ 30)',               rr: '1.2',  active: false },
  ],
  'Cáncer de Colon': [
    { id: 'family',   label: 'Antecedentes familiares 1.° grado', rr: '2.2',  active: false },
    { id: 'hnpcc',    label: 'Síndrome Lynch / HNPCC',            rr: '10.0', active: false },
    { id: 'polyps',   label: 'Pólipos adenomatosos previos',      rr: '4.0',  active: false },
    { id: 'age',      label: 'Edad > 50 años',                    rr: '2.0',  active: false },
    { id: 'obesity',  label: 'Obesidad (IMC ≥ 30)',               rr: '1.5',  active: false },
    { id: 'alcohol',  label: 'Consumo alto de alcohol',           rr: '1.4',  active: false },
    { id: 'smoking',  label: 'Fumador activo',                    rr: '1.5',  active: false },
    { id: 'red_meat', label: 'Consumo alto de carne roja/proc.',  rr: '1.3',  active: false },
    { id: 'sedentary',label: 'Sedentarismo',                      rr: '1.2',  active: false },
  ],
  'Personalizada': [
    { id: 'smoking',  label: 'Fumador activo',          rr: '2.5',  active: false },
    { id: 'obesity',  label: 'Obesidad (IMC ≥ 30)',     rr: '1.5',  active: false },
    { id: 'family',   label: 'Antecedentes familiares', rr: '2.0',  active: false },
    { id: 'age',      label: 'Edad > 50 años',          rr: '2.0',  active: false },
    { id: 'alcohol',  label: 'Consumo alto de alcohol', rr: '1.5',  active: false },
  ],
};

// ─── Format helpers ──────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return Math.round(n).toLocaleString('es-CO');
}

// ─── Componente principal ─────────────────────────────────────────────────────────

export function PoissonPanel({ data }: { data: DashboardData }) {
  const [disease, setDisease] = useState('Cáncer de Mama');
  const [rawRate, setRawRate] = useState('0.00103');

  const [projectionYears, setProjectionYears] = useState(10);
  const [riskFactors, setRiskFactors] = useState<RiskFactor[]>(
    () => RISK_FACTORS_BY_DISEASE['Cáncer de Mama'].map(rf => ({ ...rf }))
  );

  const diseaseInfo = DISEASE_MAP[disease];

  // ─── Población lookup por año (proyecciones DANE) ──────────────────────────
  const poblacionMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const p of data.poblacion) {
      map.set(p.year, p.poblacion);
    }
    return map;
  }, [data.poblacion]);

  // ─── Modelo GLM de Poisson precalculado en el backend ──────────────────────
  const proyeccion = useMemo(() => {
    if (!diseaseInfo) return null;
    return data.proyeccionPoisson.find(p => p.indicador === diseaseInfo.historicoKey) ?? null;
  }, [data.proyeccionPoisson, diseaseInfo]);

  const model = proyeccion?.model ?? null;
  const hasModel = model !== null;

  // ─── Tasa efectiva base (para mostrar / para el caso sin modelo) ───────────
  const effectiveRate = useMemo(() => {
    if (model) {
      const lastYear = proyeccion!.last_year;
      return Math.exp(model.beta0 + model.beta1 * lastYear);
    }
    return parseFloat(rawRate) || 0.001;
  }, [model, proyeccion, rawRate]);

  // ─── Combined risk factor RR ────────────────────────────────────────────────
  const combinedRR = useMemo(() => {
    const active = riskFactors.filter(rf => rf.active);
    if (active.length === 0) return 1;
    const raw = active.reduce((acc, rf) => acc * (parseFloat(rf.rr) || 1), 1);
    return Math.min(raw, 50);
  }, [riskFactors]);

  const activeFactors = riskFactors.filter(rf => rf.active);
  const hasFactors = activeFactors.length > 0;

  // ─── Build chart data ──────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const result: any[] = [];

    // Puntos históricos: usar los observados que ya vienen con el modelo
    // ajustado (mismos datos que antes, solo que ahora los sirve el backend).
    const observed = proyeccion?.observed ?? [];
    for (const o of observed) {
      result.push({
        year: o.year,
        label: String(o.year),
        cases: o.cases,
        rate: o.rate_observed ?? 0,
        errorY: [0, 0],
        group: 'Histórico',
      });
    }

    const lastHistYear = observed.length > 0 ? observed[observed.length - 1].year : 2025;
    const startYear = lastHistYear + 1;

    for (let i = 0; i < projectionYears; i++) {
      const year = startYear + i;
      const pop = poblacionMap.get(year) ?? poblacionMap.get(2025) ?? 137839;

      let rateBase: number;
      let ciLowBase: number;
      let ciHighBase: number;

      if (model) {
        // log(tasa) = beta0 + beta1 * año  →  propagación de varianza (método delta)
        const logRate = model.beta0 + model.beta1 * year;
        rateBase = Math.exp(logRate);

        const varLogRate =
          model.cov_beta0_beta0 +
          year * year * model.cov_beta1_beta1 +
          2 * year * model.cov_beta0_beta1;
        const seLogRate = Math.sqrt(Math.max(varLogRate, 0));

        const casesBase = rateBase * pop;

        // Varianza total = incertidumbre de los parámetros del modelo
        // (propagada a la escala de conteos) + varianza de Poisson del
        // proceso (media = varianza), ajustada por la dispersión estimada.
        const varParam = (casesBase * seLogRate) ** 2;
        const varPoisson = casesBase * model.dispersion;
        const seTotal = Math.sqrt(varParam + varPoisson);

        ciLowBase = Math.max(0, casesBase - 1.96 * seTotal);
        ciHighBase = casesBase + 1.96 * seTotal;
      } else {
        // Sin modelo ajustado (datos insuficientes): usar tasa de referencia fija.
        rateBase = effectiveRate;
        const casesBase = rateBase * pop;
        const std = Math.sqrt(casesBase || 1);
        ciLowBase = Math.max(0, casesBase - 1.96 * std);
        ciHighBase = casesBase + 1.96 * std;
      }

      const casesBase = Math.round(rateBase * pop);
      const casesAdj = hasFactors ? Math.round(casesBase * combinedRR) : casesBase;
      const ciLow = hasFactors ? Math.round(ciLowBase * combinedRR) : Math.round(ciLowBase);
      const ciHigh = hasFactors ? Math.round(ciHighBase * combinedRR) : Math.round(ciHighBase);

      result.push({
        year,
        label: String(year),
        cases: casesAdj,
        casesBase,
        rate: rateBase,
        ciLow,
        ciHigh,
        // Rango de error asimétrico para el ErrorBar visual: distancia
        // desde la barra (casesAdj) hasta el límite inferior y superior
        // del IC 95%. No modifica casesAdj/casesBase, solo se usa para
        // dibujar la incertidumbre encima de la barra ya calculada.
        errorY: [Math.max(0, casesAdj - ciLow), Math.max(0, ciHigh - casesAdj)],
        group: 'Proyectado',
        isAdjusted: hasFactors,
      });
    }

    return result;
  }, [proyeccion, model, effectiveRate, poblacionMap, projectionYears, hasFactors, combinedRR]);

  // ─── Totals ─────────────────────────────────────────────────────────────────
  const totalProjected = useMemo(() => {
    const proj = chartData.filter(d => d.group === 'Proyectado');
    if (proj.length === 0) return { base: 0, adj: 0 };
    return {
      base: proj.reduce((s, d) => s + d.casesBase, 0),
      adj: proj.reduce((s, d) => s + d.cases, 0),
    };
  }, [chartData]);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleDiseaseChange = useCallback((value: string) => {
    setDisease(value);
    const preset = DISEASE_PRESETS[value];
    if (preset) setRawRate(String(preset.rate));
    const factors = RISK_FACTORS_BY_DISEASE[value];
    if (factors) setRiskFactors(factors.map(rf => ({ ...rf })));
  }, []);

  function toggleRisk(id: string) {
    setRiskFactors(prev => prev.map(rf => rf.id === id ? { ...rf, active: !rf.active } : rf));
  }

  function updateRR(id: string, value: string) {
    setRiskFactors(prev => prev.map(rf => rf.id === id ? { ...rf, rr: value } : rf));
  }

  // ─── Helpers for rendering ──────────────────────────────────────────────────

  const hasDashboardData = (proyeccion?.observed.length ?? 0) > 0;
  const dataSource = hasDashboardData
    ? `Comportamiento Cáncer (defunciones) · ${diseaseInfo!.historicoKey} (${proyeccion!.first_year}-${proyeccion!.last_year})`
    : DISEASE_PRESETS[disease]?.desc ?? '';

  // ─── RENDER ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Nota metodológica ─────────────────────────────────────────────── */}
      <Card className="border-emerald-200 bg-emerald-50/50">
        <CardContent className="p-4 flex items-start gap-3">
          <Info size={20} className="text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-sm text-slate-700 space-y-1">
            <p>
              <strong className="text-slate-800">Proyección a {projectionYears} años</strong>
              {' — '}defunciones anuales esperadas mediante un modelo lineal generalizado (GLM)
              de Poisson, ajustado sobre la serie histórica municipal.
            </p>
            <p className="text-xs text-slate-500">
              {hasModel
                ? 'La tasa se modela como log(tasa) = β₀ + β₁·año, con la población como offset. β₁ corresponde al Cambio Porcentual Anual Estimado (CPAE). El intervalo de confianza combina la incertidumbre de los parámetros del modelo con la varianza de Poisson del proceso.'
                : hasDashboardData
                  ? 'No hay suficientes años de datos históricos para ajustar un modelo confiable; se usa la tasa de referencia (Globocan Colombia) mientras se acumula más histórico.'
                  : 'No hay datos históricos disponibles en el dashboard para esta patología. La proyección usa la tasa de incidencia de referencia (Globocan Colombia).'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Advertencia del modelo (datos insuficientes / sobredispersión) ──── */}
      {proyeccion?.warning && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">{proyeccion.warning}</p>
          </CardContent>
        </Card>
      )}

      {/* ── Parámetros + Factores ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Parámetros base ──────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity size={16} />Parámetros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Patología</label>
              <Select value={disease} onValueChange={handleDiseaseChange}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(DISEASE_PRESETS).map(d =>
                    <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-slate-400 mt-1">{dataSource}</p>
            </div>

            {!hasModel && (
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Tasa de incidencia (por persona-año)
                </label>
                <Input type="number" step="0.00001" min="0" value={rawRate}
                  onChange={e => setRawRate(e.target.value)} />
                <p className="text-[10px] text-slate-400 mt-1">
                  {(parseFloat(rawRate || '0') * 100000).toFixed(1)} por 100.000 por año
                </p>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Años a proyectar: {projectionYears}
              </label>
              <Slider value={[projectionYears]} onValueChange={([v]) => setProjectionYears(v)}
                min={5} max={20} step={1} />
            </div>

            {model && (
              <div className="bg-slate-50 rounded p-2 text-[10px] text-slate-500 space-y-0.5">
                <p>
                  CPAE (GLM Poisson): {model.cpae_pct >= 0 ? '+' : ''}{model.cpae_pct.toFixed(2)}% anual
                  {' '}(IC95%: {model.cpae_ci_low.toFixed(2)}% a {model.cpae_ci_high.toFixed(2)}%)
                </p>
                <p>Tasa base actual: {(effectiveRate * 100).toFixed(3)}%</p>
                <p>Dispersión: {model.dispersion.toFixed(2)} {model.overdispersed ? '(sobredispersión)' : '(dentro de lo esperado)'}</p>
                <p>Deviance: {model.deviance.toFixed(2)} · AIC: {model.aic.toFixed(1)} · n = {proyeccion!.n_years} años</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Factores de riesgo ────────────────────────────────────────────── */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle size={16} />Factores de Riesgo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500 mb-3">
              Activa los factores presentes. El RR combinado ajusta la proyección de casos.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {riskFactors.map(rf => (
                <div key={rf.id}
                  className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-slate-50 transition-colors">
                  <Switch checked={rf.active} onCheckedChange={() => toggleRisk(rf.id)}
                    id={`rf-${rf.id}`} />
                  <Label htmlFor={`rf-${rf.id}`}
                    className="text-sm text-slate-700 cursor-pointer min-w-0 flex-1 leading-tight">
                    {rf.label}
                  </Label>
                  <div className="flex items-center gap-1 ml-auto shrink-0">
                    <span className="text-[10px] text-slate-400">RR:</span>
                    <Input type="number" step="0.1" min="0.1" value={rf.rr}
                      onChange={e => updateRR(rf.id, e.target.value)}
                      className="w-16 h-7 text-xs text-right" />
                  </div>
                </div>
              ))}
            </div>
            {activeFactors.length > 1 && (
              <p className="text-[10px] text-amber-600 pt-2">
                RR combinado = {activeFactors.map(f => f.rr).join(' × ')} = <strong>{combinedRR.toFixed(2)}×</strong>.
                {' '}Multiplicación asume independencia — puede sobreestimar.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Métricas de resumen ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <div className="text-xs text-emerald-700 font-medium">Casos esperados año 1</div>
          <div className="text-2xl font-bold text-emerald-800">
            {chartData.filter(d => d.group === 'Proyectado')[0]?.cases?.toLocaleString('es-CO') ?? '—'}
          </div>
          <div className="text-[10px] text-emerald-600">
            {chartData.filter(d => d.group === 'Proyectado')[0]?.label ?? '—'}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-xs text-blue-700 font-medium">
            Casos acumulados a {projectionYears} años
          </div>
          <div className="text-2xl font-bold text-blue-800">
            {hasFactors ? fmt(totalProjected.adj) : fmt(totalProjected.base)}
          </div>
          <div className="text-[10px] text-blue-600">
            {hasFactors
              ? `${fmt(totalProjected.base)} base · RR ${combinedRR.toFixed(2)}×`
              : 'Sin factores de riesgo'}
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="text-xs text-amber-700 font-medium">
            CPAE (tendencia anual)
          </div>
          <div className="text-2xl font-bold text-amber-800">
            {model ? `${model.cpae_pct >= 0 ? '+' : ''}${model.cpae_pct.toFixed(2)}%` : '—'}
          </div>
          <div className="text-[10px] text-amber-600">
            {model ? 'Cambio Porcentual Anual Estimado (GLM Poisson)' : 'Sin modelo ajustado'}
          </div>
        </div>
      </div>

      {/* ── Gráfico de proyección ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp size={16} />Proyección de Casos por Año
          </CardTitle>
          <p className="text-xs text-slate-500">
            {hasDashboardData
              ? `Datos históricos (${proyeccion!.first_year}-${proyeccion!.last_year}) · Proyección (${projectionYears} años)`
              : `Proyección basada en tasa de referencia${hasFactors ? ' · Ajustada por factores de riesgo' : ''}`}
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-96">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}
                  margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }}
                    tickFormatter={v => v >= 1000 ? v.toLocaleString('es-CO') : String(v)} />
                  <Tooltip
                    formatter={(val: number, name: string, props: any) => {
                      if (name === 'cases') {
                        const p = props?.payload;
                        if (p?.group === 'Proyectado') {
                          return [`${val.toLocaleString('es-CO')}  (IC95%: ${p.ciLow.toLocaleString('es-CO')} – ${p.ciHigh.toLocaleString('es-CO')})`, 'Casos'];
                        }
                        return [val.toLocaleString('es-CO'), 'Casos'];
                      }
                      if (name === 'casesBase') return [val.toLocaleString('es-CO'), 'Casos (base)'];
                      return [val, name];
                    }}
                    labelFormatter={l => `Año ${l}`} />
                  <Legend />

                  <Bar dataKey="cases" name="Casos" radius={[4, 4, 0, 0]}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={
                        d.group === 'Histórico' ? '#94a3b8' :
                        hasFactors ? '#f59e0b' : '#059669'
                      } />
                    ))}
                    <ErrorBar dataKey="errorY" width={4} strokeWidth={1.5} stroke="#334155" />
                  </Bar>

                  {hasFactors && (
                    <Line type="monotone" dataKey="casesBase" name="Casos (base)"
                      stroke="#059669" strokeWidth={2} strokeDasharray="5 5"
                      dot={false} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                No hay datos disponibles para la proyección
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-slate-400 inline-block" /> Histórico
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-emerald-600 inline-block" /> Proyectado
            </span>
            <span className="flex items-center gap-1">
              <span className="w-0.5 h-3 bg-slate-700 inline-block" /> IC 95% (parámetros del modelo + Poisson)
            </span>
            {hasFactors && (
              <>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-amber-500 inline-block" /> Ajustado por RR
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-4 h-0.5 bg-emerald-600 inline-block" style={{borderTop: '2px dashed #059669'}} /> Base (sin RR)
                </span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Tabla año por año ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Proyección Detallada por Año</CardTitle>
          <p className="text-xs text-slate-500">
            Población según proyecciones DANE Sogamoso · Tasa base: {(effectiveRate * 100).toFixed(3)}%
            {hasFactors ? ` · RR combinado: ${combinedRR.toFixed(2)}×` : ''}
            {model ? ` · IC 95% del modelo (parámetros + Poisson)` : ` · IC 95% aproximado (Poisson)`}
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Año</th>
                  <th className="text-right px-3 py-2 font-medium">Población</th>
                  <th className="text-right px-3 py-2 font-medium">Tasa</th>
                  <th className="text-right px-3 py-2 font-medium">Casos base</th>
                  {hasFactors && <th className="text-right px-3 py-2 font-medium">Casos ajustados</th>}
                  <th className="text-right px-3 py-2 font-medium">IC 95% (inf)</th>
                  <th className="text-right px-3 py-2 font-medium">IC 95% (sup)</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map(d => (
                  <tr key={d.year}
                    className={`border-b border-slate-100 hover:bg-slate-50
                      ${d.group === 'Proyectado' ? '' : 'text-slate-500'}`}>
                    <td className="px-3 py-2 font-medium text-slate-800">
                      {d.label}
                    </td>
                    <td className="px-3 py-2 text-right">{(poblacionMap.get(d.year) ?? 137839).toLocaleString('es-CO')}</td>
                    <td className="px-3 py-2 text-right">{(d.rate * 100).toFixed(3)}%</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {d.group === 'Proyectado' ? fmt(d.casesBase) : fmt(d.cases)}
                    </td>
                    {hasFactors && (
                      <td className="px-3 py-2 text-right font-semibold text-amber-700">
                        {d.group === 'Proyectado' ? fmt(d.cases) : '—'}
                      </td>
                    )}
                    <td className="px-3 py-2 text-right">
                      {d.group === 'Proyectado' ? fmt(d.ciLow) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {d.group === 'Proyectado' ? fmt(d.ciHigh) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-medium">
                <tr>
                  <td className="px-3 py-2 text-slate-700">
                    Total {projectionYears} años (proyectado)
                  </td>
                  <td />
                  <td />
                  <td className="px-3 py-2 text-right">
                    {fmt(totalProjected.base)}
                  </td>
                  {hasFactors && (
                    <td className="px-3 py-2 text-right text-amber-700">
                      {fmt(totalProjected.adj)}
                    </td>
                  )}
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}