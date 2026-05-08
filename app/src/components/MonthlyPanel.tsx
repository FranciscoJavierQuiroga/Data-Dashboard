import { useMemo, useState } from 'react';
import type { DashboardData } from '@/hooks/useData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

const MONTHS_ORDER = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
const MONTH_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const PROGRAM_COLORS: Record<string, string> = {
  'Dt Cervix': '#059669',
  'Dt Mama': '#d97706',
  'Dt Prostata': '#2563eb',
  'Dt Colon Y Recto': '#7c3aed',
};

export function MonthlyPanel({ data }: { data: DashboardData }) {
  const { burnup, mensual, kpis } = data;
  const [selectedProgram, setSelectedProgram] = useState<string>('Todos');

  const programs = useMemo(() => [...new Set(burnup.map(b => b.PROGRAMA))].sort(), [burnup]);

  // Burn-up data con metas proyectadas
  const burnData = useMemo(() => {
    const activePrograms = selectedProgram === 'Todos' ? programs : [selectedProgram];
    const rows = MONTHS_ORDER.map((m, idx) => {
      const obj: Record<string, any> = { month: MONTH_LABELS[idx], mes_key: m };
      for (const prog of activePrograms) {
        const row = burnup.find(b => b.PROGRAMA === prog && b.MES === m);
        obj[`${prog}_acum`] = row ? row.ACUMULADO_CALCULADO : null;
        obj[`${prog}_mensual`] = row ? row.VALOR_MES : null;
      }
      return obj;
    });
    return { rows, activePrograms };
  }, [burnup, selectedProgram, programs]);

  // Desagregación por EPS para el programa seleccionado
  const epsMonthly = useMemo<{ rows: Record<string, any>[]; epsList: string[] }>(() => {
    if (selectedProgram === 'Todos') return { rows: [], epsList: [] };
    const rows = mensual.filter(m => m.PROGRAMA === selectedProgram);
    const epsList = [...new Set(rows.map(r => r.EPS))].sort();
    const byMonth = MONTHS_ORDER.map((m, idx) => {
      const obj: Record<string, any> = { month: MONTH_LABELS[idx] };
      for (const eps of epsList) {
        const val = rows.find(r => r.EPS === eps && r.MES === m)?.VALOR_MES ?? 0;
        obj[eps] = val;
      }
      return obj;
    });
    return { rows: byMonth, epsList };
  }, [mensual, selectedProgram]);

  // Ritmo requerido para alcanzar meta
  const ritmo = useMemo(() => {
    const activePrograms = selectedProgram === 'Todos' ? programs : [selectedProgram];
    const results = [];
    for (const prog of activePrograms) {
      const kpi = kpis.find(k => k.programa === prog && k.indicador.includes('COBERTURA'));
      const acum = burnup.filter(b => b.PROGRAMA === prog).reduce((s, b) => s + (b.VALOR_MES || 0), 0);
      const meta = kpi?.meta_2026 || 0;
      const mesesRestantes = 9; // Abr-Dic
      const ritmo = meta > 0 && mesesRestantes > 0 ? (meta - acum) / mesesRestantes : 0;
      results.push({ programa: prog, acum, meta, faltan: meta - acum, ritmo_mensual: ritmo });
    }
    return results;
  }, [kpis, burnup, programs, selectedProgram]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
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
          <p className="text-xs text-slate-500">Actividades acumuladas por programa. Ene-Mar 2026.</p>
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
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {selectedProgram !== 'Todos' && epsMonthly.epsList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contribución Mensual por EPS</CardTitle>
            <p className="text-xs text-slate-500">Desagregación de actividades mensuales por aseguradora para {selectedProgram}.</p>
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
