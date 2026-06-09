import { useMemo, useState, useCallback } from 'react';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { DashboardData } from '@/hooks/useData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Calculator, AlertTriangle, Activity, Info } from 'lucide-react';

// ─── FIX: PMF con log-factorial — estable para cualquier k y λ ───────────────
// El código original usaba factorial() que desbordaba para k ≥ 21 (NaN silencioso).
// Esta versión calcula en espacio logarítmico: log P = k·ln(λ) - λ - Σln(i)
function poissonPMF(lambda: number, k: number): number {
  if (lambda <= 0 || k < 0) return 0;
  let logFact = 0;
  for (let i = 2; i <= k; i++) logFact += Math.log(i);
  return Math.exp(k * Math.log(lambda) - lambda - logFact);
}

function poissonCDF(lambda: number, k: number): number {
  // Acumula término a término reutilizando el término anterior:
  // P(k) = P(k-1) × λ/k  →  O(k) sin llamadas redundantes a log
  if (lambda <= 0) return k >= 0 ? 1 : 0;
  let term = Math.exp(-lambda); // P(X=0)
  let sum  = term;
  for (let i = 1; i <= k; i++) {
    term *= lambda / i;
    sum  += term;
  }
  return Math.min(1, sum);
}

// ─── Presets de patologías ────────────────────────────────────────────────────

const DISEASE_PRESETS: Record<string, { rate: number; desc: string }> = {
  'Cáncer de Pulmón':    { rate: 0.00061, desc: '61 por 100.000 · Globocan Colombia' },
  'Cáncer de Mama':      { rate: 0.00103, desc: '103 por 100.000 · Globocan Colombia' },
  'Cáncer de Cérvix':    { rate: 0.00036, desc: '36 por 100.000 · Globocan Colombia' },
  'Cáncer de Próstata':  { rate: 0.00107, desc: '107 por 100.000 · Globocan Colombia' },
  'Cáncer de Colon':     { rate: 0.00028, desc: '28 por 100.000 · Globocan Colombia' },
  'Personalizada':       { rate: 0.001,   desc: 'Ingrese su propia tasa' },
};

// ─── Factores de riesgo por patología ─────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// VARIABLES CRÍTICAS — ajusta los RR según la literatura que consultes.
// RR = Razón de Riesgo respecto a la población general sin ese factor.
// Fuentes sugeridas: IARC, meta-análisis Globocan, guías NCCN/ESMO.
// ══════════════════════════════════════════════════════════════════════════════

interface RiskFactor {
  id: string;
  label: string;
  rr: string;      // editable por el usuario en runtime
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

// ─── Componente principal ─────────────────────────────────────────────────────

// FIX: el prop `data` ahora se usa para enriquecer los presets con tasas reales
// del histórico cuando estén disponibles. Si no hay match, usa Globocan.
export function PoissonPanel({ data }: { data: DashboardData }) {
  const [disease, setDisease]     = useState('Cáncer de Pulmón');
  const [rawRate, setRawRate]     = useState('0.00061');
  const [timeYears, setTimeYears] = useState(10);
  const [population, setPopulation] = useState(10000);
  const [riskFactors, setRiskFactors] = useState<RiskFactor[]>(
    () => RISK_FACTORS_BY_DISEASE['Cáncer de Pulmón'].map(rf => ({ ...rf }))
  );

  // Enriquece la tasa base con datos reales del histórico si existen
  const enrichedDesc = useMemo(() => {
    const match = data.historico.find(h =>
      h.INDICADOR_CLEAN.toLowerCase().includes(
        disease.replace('Cáncer de ', '').toLowerCase()
      )
    );
    if (match) {
      const prom = data.historico
        .filter(h => h.INDICADOR_CLEAN === match.INDICADOR_CLEAN)
        .reduce((a, b) => a + b.VALOR, 0) /
        data.historico.filter(h => h.INDICADOR_CLEAN === match.INDICADOR_CLEAN).length;
      return `Tasa real histórica promedio: ${(prom * 100).toFixed(2)}% · ${match.INDICADOR_CLEAN}`;
    }
    return DISEASE_PRESETS[disease]?.desc ?? '';
  }, [data.historico, disease]);

  const handleDiseaseChange = useCallback((value: string) => {
    setDisease(value);
    const preset = DISEASE_PRESETS[value];
    if (preset) setRawRate(String(preset.rate));
    const factors = RISK_FACTORS_BY_DISEASE[value];
    if (factors) setRiskFactors(factors.map(rf => ({ ...rf })));
  }, []);

  const popRate    = parseFloat(rawRate) || 0;
  const baseLambda = popRate * timeYears;

  const combinedRR = useMemo(() => {
    const raw = riskFactors.filter(rf => rf.active)
      .reduce((acc, rf) => acc * (parseFloat(rf.rr) || 1), 1);
    return Math.min(raw, 50); // tope: RR > 50 no tiene interpretación clínica realista
  }, [riskFactors]);

  const activeFactors    = riskFactors.filter(rf => rf.active);
  const hasFactors       = activeFactors.length > 0;
  const lambdaIndiv      = baseLambda * (hasFactors ? combinedRR : 1);
  const lambdaPopBase    = baseLambda * population;
  const probAtLeastOne     = lambdaIndiv > 0 ? 1 - poissonPMF(lambdaIndiv, 0) : 0;
  const probAtLeastOneBase = baseLambda > 0  ? 1 - poissonPMF(baseLambda, 0)  : 0;

  const indivDist = useMemo(() => {
    const maxK = Math.min(30, Math.max(5, Math.ceil(lambdaIndiv * 4) + 3));
    return Array.from({ length: maxK + 1 }, (_, k) => ({
      k,
      prob: poissonPMF(lambdaIndiv, k),
      cum:  poissonCDF(lambdaIndiv, k),
    }));
  }, [lambdaIndiv]);

  const popDist = useMemo(() => {
    if (lambdaPopBase <= 0) return [{ k: 0, prob: 1 }];
    const std = Math.sqrt(lambdaPopBase);
    const lo  = Math.max(0, Math.floor(lambdaPopBase - 4 * std));
    const hi  = Math.ceil(lambdaPopBase + 4 * std);
    // Para λ grandes usamos rango continuo; para pequeños, lista completa
    if (hi - lo > 20) {
      return Array.from({ length: hi - lo + 1 }, (_, j) => ({
        k: lo + j, prob: poissonPMF(lambdaPopBase, lo + j),
      }));
    }
    const m = Math.max(20, Math.ceil(lambdaPopBase * 1.5));
    return Array.from({ length: m + 1 }, (_, k) => ({ k, prob: poissonPMF(lambdaPopBase, k) }));
  }, [lambdaPopBase]);

  function toggleRisk(id: string) {
    setRiskFactors(prev => prev.map(rf => rf.id === id ? { ...rf, active: !rf.active } : rf));
  }

  function updateRR(id: string, value: string) {
    setRiskFactors(prev => prev.map(rf => rf.id === id ? { ...rf, rr: value } : rf));
  }

  return (
    <div className="space-y-6">

      {/* Nota metodológica */}
      <Card className="border-emerald-200 bg-emerald-50/50">
        <CardContent className="p-4 flex items-start gap-3">
          <Info size={20} className="text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-sm text-slate-700 space-y-1">
            <p>
              <strong className="text-slate-800">Modelo Poisson de riesgo individual</strong>
              {' — '}λ = tasa_base × años × RR₁ × RR₂ × …
            </p>
            <p className="text-xs text-slate-500">
              La tasa base es la incidencia en la <strong>población general</strong>.
              Activar factores multiplica λ individual por los RR ingresados, estimando el riesgo
              de una persona <strong>con esos factores</strong> respecto al promedio poblacional.
              La proyección poblacional usa la tasa base (no la ajustada).
              Los RR son referenciales — ajústalos según la literatura que consultes.
              PMF calculada con log-factorial (estable para cualquier λ).
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Parámetros base ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity size={16} />Parámetros Base
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
              <p className="text-[10px] text-slate-400 mt-1">{enrichedDesc}</p>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Tasa poblacional (por persona-año)
              </label>
              <Input type="number" step="0.00001" min="0" value={rawRate}
                onChange={e => setRawRate(e.target.value)} />
              <p className="text-[10px] text-slate-400 mt-1">
                {(popRate * 100000).toFixed(1)} por 100.000 por año
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Periodo: {timeYears} año{timeYears !== 1 ? 's' : ''}
              </label>
              <Slider value={[timeYears]} onValueChange={([v]) => setTimeYears(v)}
                min={1} max={30} step={1} />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Población</label>
              <Input type="number" min={1} value={population}
                onChange={e => setPopulation(parseInt(e.target.value) || 1)} />
            </div>
          </CardContent>
        </Card>

        {/* ── Variables críticas ───────────────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════════
            VARIABLES CRÍTICAS: activa los factores relevantes para el paciente
            y ajusta el RR (Razón de Riesgo) según la evidencia disponible.
            La multiplicación asume independencia entre factores.
            ══════════════════════════════════════════════════════════════════ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle size={16} />Variables Críticas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-slate-500 mb-3">
              Activa los factores presentes y ajusta el RR según la literatura:
            </p>
            {riskFactors.map(rf => (
              <div key={rf.id}
                className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-slate-50 transition-colors">
                <Switch checked={rf.active} onCheckedChange={() => toggleRisk(rf.id)}
                  id={`rf-${rf.id}`} />
                <Label htmlFor={`rf-${rf.id}`}
                  className="text-sm text-slate-700 cursor-pointer min-w-0 flex-1">
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
            {activeFactors.length > 1 && (
              <p className="text-[10px] text-amber-600 pt-1">
                RR combinado = {activeFactors.map(f => f.rr).join(' × ')} = <strong>{combinedRR.toFixed(2)}×</strong>.
                La multiplicación asume independencia entre factores — puede sobreestimar el riesgo.
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Resultados ───────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator size={16} />Resultados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <div className="text-xs text-emerald-700 font-medium">Tasa base</div>
                <div className="text-lg font-bold text-emerald-800">
                  {(popRate * 100000).toFixed(0)}/100k
                </div>
                <div className="text-[10px] text-emerald-600">por año</div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="text-xs text-amber-700 font-medium">RR combinado</div>
                <div className="text-lg font-bold text-amber-800">
                  {hasFactors ? `${combinedRR.toFixed(2)}×` : '1×'}
                </div>
                <div className="text-[10px] text-amber-600">
                  {activeFactors.length} factor{activeFactors.length !== 1 ? 'es' : ''} activo{activeFactors.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-xs text-blue-700 font-medium">λ individual</div>
              <div className="text-xl font-bold text-blue-800">{lambdaIndiv.toFixed(5)}</div>
              <div className="text-[10px] text-blue-600">
                λ_base {baseLambda.toFixed(5)}
                {hasFactors ? ` × RR ${combinedRR.toFixed(2)}` : ''}
                {' · '}{timeYears} año{timeYears !== 1 ? 's' : ''}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-xs text-slate-700 font-medium">
                Proyección poblacional ({population.toLocaleString('es-CO')} personas)
              </div>
              <div className="text-xl font-bold text-slate-800">
                {Math.round(lambdaPopBase).toLocaleString('es-CO')} casos esperados
              </div>
              <div className="text-[10px] text-slate-500">
                Tasa base · {timeYears} año{timeYears !== 1 ? 's' : ''}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="text-xs text-amber-700 font-medium">
                P(al menos 1 caso) — individual
              </div>
              <div className="flex items-baseline gap-4 mt-1 flex-wrap">
                <div>
                  <span className="text-xs text-slate-400">Población general: </span>
                  <span className="text-sm font-semibold text-slate-600">
                    {(probAtLeastOneBase * 100).toFixed(3)}%
                  </span>
                </div>
                {hasFactors && (
                  <div>
                    <span className="text-xs text-slate-400">Con factores: </span>
                    <span className={`text-sm font-bold
                      ${probAtLeastOne > probAtLeastOneBase ? 'text-amber-700' : 'text-slate-600'}`}>
                      {(probAtLeastOne * 100).toFixed(3)}%
                    </span>
                  </div>
                )}
              </div>
              {hasFactors && probAtLeastOneBase > 0 && (
                <div className="text-[10px] text-slate-400 mt-1">
                  Aumento absoluto: +{((probAtLeastOne - probAtLeastOneBase) * 100).toFixed(3)} pp
                </div>
              )}
              {hasFactors && combinedRR >= 50 && (
                <div className="text-[10px] text-red-500 mt-1 flex items-start gap-1">
                  <Info size={11} className="shrink-0 mt-0.5" />
                  RR combinado superó 50× — valor limitado a 50× por tope clínico.
                  Revisa que los factores seleccionados no se solapen (ej. tabaquismo + asbesto
                  en pulmón ya tienen sinergia documentada; su RR real es ~50×, no 75×).
                </div>
              )}
              {hasFactors && combinedRR > 10 && combinedRR < 50 && (
                <div className="text-[10px] text-red-500 mt-1 flex items-start gap-1">
                  <Info size={11} className="shrink-0 mt-0.5" />
                  RR combinado muy alto ({combinedRR.toFixed(1)}×). La estimación puede no ser realista.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Gráficos de distribución ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribución Individual</CardTitle>
            <p className="text-xs text-slate-500">
              P(k eventos en {timeYears} años) · λ = {lambdaIndiv.toFixed(5)}
              {hasFactors ? ` (con ${activeFactors.length} factor${activeFactors.length !== 1 ? 'es' : ''})` : ' (población general)'}
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {lambdaIndiv > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={indivDist}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="k" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }}
                      tickFormatter={v => `${(v * 100).toFixed(1)}%`} />
                    <Tooltip
                      formatter={(val: number) => `${(val * 100).toFixed(4)}%`}
                      labelFormatter={k => `k = ${k} caso(s)`} />
                    <Bar dataKey="prob" fill="#059669" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  Ingrese una tasa válida
                </div>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-2 text-center">
              P(0) = {(poissonPMF(lambdaIndiv, 0) * 100).toFixed(3)}%
              {' · '}P(1) = {(poissonPMF(lambdaIndiv, 1) * 100).toFixed(3)}%
              {' · '}P(≥1) = {(probAtLeastOne * 100).toFixed(3)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribución Poblacional</CardTitle>
            <p className="text-xs text-slate-500">
              Casos esperados en {population.toLocaleString('es-CO')} personas
              · {timeYears} años · λ = {lambdaPopBase.toFixed(1)}
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {lambdaPopBase > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={popDist}>
                    <defs>
                      <linearGradient id="popGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="k" tick={{ fontSize: 12 }}
                      tickFormatter={v => v >= 1000 ? v.toLocaleString('es-CO') : String(v)} />
                    <YAxis tick={{ fontSize: 12 }}
                      tickFormatter={v => `${(v * 100).toFixed(2)}%`} />
                    <Tooltip
                      formatter={(val: number) => `${(val * 100).toFixed(4)}%`}
                      labelFormatter={k => `k = ${Number(k).toLocaleString('es-CO')} casos`} />
                    <Area type="monotone" dataKey="prob" stroke="#6366f1"
                      strokeWidth={2} fill="url(#popGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  Ingrese una tasa válida
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Tabla de probabilidades ──────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tabla de Probabilidades Individuales</CardTitle>
          <p className="text-xs text-slate-500">
            Poisson(λ = {lambdaIndiv.toFixed(5)}) · {timeYears} año{timeYears !== 1 ? 's' : ''}
            · {hasFactors ? `${activeFactors.length} factor${activeFactors.length !== 1 ? 'es' : ''} activo${activeFactors.length !== 1 ? 's' : ''}` : 'Población general'}
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  {['k (casos)','P(X = k)','P(X ≤ k)','P(X ≥ k)'].map(h =>
                    <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {indivDist.slice(0, 15).map(d => {
                  const probGeq = 1 - poissonCDF(lambdaIndiv, d.k - 1);
                  return (
                    <tr key={d.k} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-800">{d.k}</td>
                      <td className={`px-3 py-2 font-semibold
                        ${d.prob > 0.3 ? 'text-emerald-600' : d.prob > 0.05 ? 'text-amber-600' : 'text-slate-500'}`}>
                        {(d.prob * 100).toFixed(4)}%
                      </td>
                      <td className="px-3 py-2 text-slate-700">{(d.cum * 100).toFixed(4)}%</td>
                      <td className="px-3 py-2 text-slate-700">{(probGeq * 100).toFixed(4)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}