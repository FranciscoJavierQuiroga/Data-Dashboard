import { useMemo, useState } from 'react';
import type { DashboardData } from '@/hooks/useData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

const MONTHS_ORDER = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
const MONTH_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const PROGRAM_COLORS: Record<string, string> = {
  'Dt Cervix': '#059669',
  'Dt Mama': '#d97706',
  'Dt Prostata': '#2563eb',
  'Dt Colon Y Recto': '#7c3aed',
};

const COVERAGE_INDICATORS = [
  'COBERTURA CCU',
  'COBERTURA MAMOGRAFIA',
  'COBERTURA PSA',
  'COBERTURA TAMIZACION SANGRE OCULTA EN HECES',
];

const RITMO_INDICATORS: Record<string, string> = {
  'Dt Cervix': 'COBERTURA CCU',
  'Dt Mama': 'COBERTURA MAMOGRAFIA',
  'Dt Prostata': 'COBERTURA PSA',
  'Dt Colon Y Recto': 'COBERTURA TAMIZACION SANGRE OCULTA EN HECES',
};

export function MonthlyPanel({ data }: { data: DashboardData }) {
  const { burnup, mensual, kpis } = data;
  const [selectedProgram, setSelectedProgram] = useState<string>('Todos');
  const [selectedEps, setSelectedEps] = useState<string>('Todas');

  const programs = useMemo(() => [...new Set(burnup.map(b => b.PROGRAMA))].sort(), [burnup]);
  const epsList = useMemo(() => [...new Set(mensual.map(m => m.EPS))].sort(), [mensual]);

  // Burn-up data: usa burnup.json para total municipal, o calcula desde mensual cuando se filtra por EPS
  const burnData = useMemo(() => {
    const activePrograms = selectedProgram === 'Todos' ? programs : [selectedProgram];
    const rows: Record<string, any>[] = [];
    if (selectedEps !== 'Todas') {
      const filtered = mensual.filter(m =>
        COVERAGE_INDICATORS.includes(m.TIPO_INDICADOR) &&
        activePrograms.includes(m.PROGRAMA) &&
        m.EPS === selectedEps
      );
      const grouped: Record<string, Record<string, number>> = {};
      for (const row of filtered) {
        if (!grouped[row.PROGRAMA]) grouped[row.PROGRAMA] = {};
        if (!grouped[row.PROGRAMA][row.MES]) grouped[row.PROGRAMA][row.MES] = 0;
        grouped[row.PROGRAMA][row.MES] += row.VALOR_MES || 0;
      }
      for (const m of MONTHS_ORDER) {
        const obj: Record<string, any> = { month: MONTH_LABELS[MONTHS_ORDER.indexOf(m)], mes_key: m };
        for (const prog of activePrograms) {
          obj[`${prog}_mensual`] = grouped[prog]?.[m] ?? null;
        }
        rows.push(obj);
      }
      for (const prog of activePrograms) {
        let acum = 0;
        for (const row of rows) {
          if (row[`${prog}_mensual`] !== null) {
            acum += row[`${prog}_mensual`];
          }
          row[`${prog}_acum`] = acum;
        }
      }
    } else {
      for (const m of MONTHS_ORDER) {
        const obj: Record<string, any> = { month: MONTH_LABELS[MONTHS_ORDER.indexOf(m)], mes_key: m };
        for (const prog of activePrograms) {
          const row = burnup.find(b => b.PROGRAMA === prog && b.MES === m);
          obj[`${prog}_acum`] = row ? row.ACUMULADO_CALCULADO : null;
          obj[`${prog}_mensual`] = row ? row.VALOR_MES : null;
        }
        rows.push(obj);
      }
    }

    if (selectedProgram !== 'Todos') {
      for (const prog of activePrograms) {
        const targetIndicator = RITMO_INDICATORS[prog];
        const kpi = targetIndicator ? kpis.find(k => k.programa === prog && k.indicador === targetIndicator) : null;
        const meta = kpi?.meta_2026 || 0;
        if (meta > 0) {
          const step = meta / 12;
          for (let i = 0; i < rows.length; i++) {
            rows[i][`${prog}_meta`] = Math.round(step * (i + 1));
          }
        }
      }
    }
    return { rows, activePrograms };
  }, [burnup, mensual, selectedProgram, selectedEps, programs]);

  // Desagregación por EPS (solo indicadores de cobertura)
  const epsMonthly = useMemo<{ rows: Record<string, any>[]; epsList: string[] }>(() => {
    if (selectedProgram === 'Todos') return { rows: [], epsList: [] };
    let rows = mensual.filter(m =>
      m.PROGRAMA === selectedProgram &&
      COVERAGE_INDICATORS.includes(m.TIPO_INDICADOR)
    );
    if (selectedEps !== 'Todas') {
      rows = rows.filter(m => m.EPS === selectedEps);
    }
    const epsPresent = [...new Set(rows.map(r => r.EPS))].sort();
    const byMonth = MONTHS_ORDER.map((m, idx) => {
      const obj: Record<string, any> = { month: MONTH_LABELS[idx] };
      for (const eps of epsPresent) {
        const val = rows.find(r => r.EPS === eps && r.MES === m)?.VALOR_MES ?? 0;
        obj[eps] = val;
      }
      return obj;
    });
    return { rows: byMonth, epsList: epsPresent };
  }, [mensual, selectedProgram, selectedEps]);

  // Ritmo requerido para alcanzar meta
  const ritmo = useMemo(() => {
    const activePrograms = selectedProgram === 'Todos' ? programs : [selectedProgram];
    const results = [];
    for (const prog of activePrograms) {
      const lastRow = [...burnData.rows].reverse().find(r => r[`${prog}_acum`] != null);
      const acum = lastRow ? lastRow[`${prog}_acum`] : 0;
      const targetIndicator = RITMO_INDICATORS[prog];
      const kpi = targetIndicator ? kpis.find(k => k.programa === prog && k.indicador === targetIndicator) : null;
      const meta = kpi?.meta_2026 || 0;
      const mesesRestantes = 9;
      const ritmo = meta > 0 && mesesRestantes > 0 ? (meta - acum) / mesesRestantes : 0;
      results.push({ programa: prog, acum, meta, faltan: meta - acum, ritmo_mensual: ritmo });
    }
    return results;
  }, [kpis, burnData, programs, selectedProgram]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-center">
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Programa</label>
          <Select value={selectedProgram} onValueChange={setSelectedProgram}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos los programas</SelectItem>
              {programs.map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">EPS</label>
          <Select value={selectedEps} onValueChange={setSelectedEps}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todas">Todas las EPS</SelectItem>
              {epsList.map(e => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedEps !== 'Todas' && (
          <div className="text-sm text-slate-500 bg-slate-100 px-3 py-1.5 rounded-md mt-5">
            Mostrando solo datos de <strong>{selectedEps}</strong>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {ritmo.map((r, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">{r.programa}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Acumulado (Ene-Mar)</span>
                <span className="font-semibold text-slate-800">{r.acum.toLocaleString('es-CO')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Meta anual 2026</span>
                <span className="font-semibold text-slate-800">{r.meta.toLocaleString('es-CO')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Faltan (Abr-Dic)</span>
                <span className="font-semibold text-red-600">{r.faltan.toLocaleString('es-CO')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Ritmo mensual requerido</span>
                <span className="font-semibold text-amber-600">{Math.ceil(r.ritmo_mensual).toLocaleString('es-CO')}/mes</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                A ritmo actual: {(r.acum / 3).toFixed(0)} por mes · Para meta: {Math.ceil(r.ritmo_mensual).toFixed(0)} por mes
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
              <CardTitle className="text-base">Burn-up Chart — Avance Acumulado Mensual</CardTitle>
            <p className="text-xs text-slate-500">
              {selectedProgram !== 'Todos' && selectedEps !== 'Todas'
                ? `Solo indicadores de cobertura real — ${selectedEps}. Línea punteada = meta proporcional mensual. Ene-Mar 2026.`
                : selectedProgram !== 'Todos'
                  ? 'Solo indicadores de cobertura real. Línea punteada = meta proporcional mensual. Ene-Mar 2026.'
                  : selectedEps !== 'Todas'
                    ? `Solo indicadores de cobertura real — ${selectedEps}. Ene-Mar 2026.`
                    : 'Solo indicadores de cobertura real (CCU, mamografía, PSA, sangre oculta). Ene-Mar 2026.'}
            </p>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={burnData.rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(val: number, name: string) => [val !== null ? val.toLocaleString('es-CO') : 'N/D', name]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {burnData.activePrograms.map((prog) => (
                  <Area
                    key={prog}
                    type="monotone"
                    dataKey={`${prog}_acum`}
                    name={prog}
                    stroke={PROGRAM_COLORS[prog] || '#64748b'}
                    fill={PROGRAM_COLORS[prog] || '#64748b'}
                    fillOpacity={0.15}
                    strokeWidth={2}
                    connectNulls
                  />
                ))}
                {selectedProgram !== 'Todos' && burnData.activePrograms.map((prog) => (
                  <Line key={`${prog}_meta`} dataKey={`${prog}_meta`} name={`Meta ${prog}`} stroke="#dc2626" strokeDasharray="6 4" strokeWidth={2} dot={false} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {selectedProgram !== 'Todos' && epsMonthly.epsList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contribución Mensual por EPS</CardTitle>
            <p className="text-xs text-slate-500">
              {selectedEps !== 'Todas'
                ? `Actividades de cobertura mensuales — ${selectedEps}.`
                : `Desagregación de actividades de cobertura por aseguradora para ${selectedProgram}.`}
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={epsMonthly.rows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(val: number, name: string) => [val.toLocaleString('es-CO'), name]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {epsMonthly.epsList.map((eps, i) => (
                    <Bar key={eps} dataKey={eps} stackId="a" fill={['#2563eb','#059669','#d97706','#7c3aed','#dc2626','#0891b2'][i % 6]} radius={[4,4,0,0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
