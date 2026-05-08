import { useMemo, useState } from 'react';
import type { DashboardData } from '@/hooks/useData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FunnelChart, Funnel, Tooltip, ResponsiveContainer, LabelList, Cell } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const STAGE_COLORS = ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0'];

export function FunnelPanel({ data }: { data: DashboardData }) {
  const { funnel } = data;
  const [selectedProgram, setSelectedProgram] = useState<string>('Dt Cervix');
  const [selectedEps, setSelectedEps] = useState<string>('Todas');

  const programs = useMemo(() => [...new Set(funnel.map(f => f.programa))].sort(), [funnel]);
  const epsList = useMemo(() => [...new Set(funnel.map(f => f.eps))].sort(), [funnel]);

  const filtered = useMemo(() => {
    let rows = funnel.filter(f => f.programa === selectedProgram);
    if (selectedEps !== 'Todas') {
      rows = rows.filter(f => f.eps === selectedEps);
    } else {
      // Agregar todos sumando acumulados por stage
      const byStage: Record<string, any> = {};
      for (const r of rows) {
        if (!byStage[r.stage]) {
          byStage[r.stage] = { ...r, acumulado: 0, poblacion_elegible: 0, meta: 0 };
        }
        byStage[r.stage].acumulado += r.acumulado || 0;
        byStage[r.stage].poblacion_elegible = r.poblacion_elegible || byStage[r.stage].poblacion_elegible;
        byStage[r.stage].meta += r.meta || 0;
      }
      rows = Object.values(byStage);
    }
    return rows.sort((a, b) => {
      const order: Record<string, Record<string, number>> = {
        'Dt Cervix': { 'CCU Realizadas': 0, 'CCU Anormales': 1, 'ADN VPH Realizados': 2, 'ADN VPH Positivos': 3, 'Colposcopia + Biopsia': 4 },
        'Dt Mama': { 'Examen Clínico Mama': 0, 'Mamografías': 1, 'Mamografías BI-RADS 4+': 2, 'Biopsias de Mama': 3 },
        'Dt Prostata': { 'Tacto Rectal': 0, 'PSA': 1, 'Tamizaje Combinado': 2, 'Resultados Anormales': 3, 'Biopsias de Próstata': 4 },
        'Dt Colon Y Recto': { 'SOMF Realizadas': 0, 'SOMF Positivas': 1, 'Colonoscopias': 2 },
      };
      const orderMap = order[selectedProgram] || {};
      return (orderMap[a.stage] ?? 99) - (orderMap[b.stage] ?? 99);
    });
  }, [funnel, selectedProgram, selectedEps]);

  const funnelChartData = useMemo(() => {
    return filtered.map(f => ({
      name: f.stage,
      value: f.acumulado || 0,
      fill: STAGE_COLORS[filtered.indexOf(f) % STAGE_COLORS.length]
    }));
  }, [filtered]);

  const conversionRates = useMemo(() => {
    const rates: { from: string; to: string; rate: string }[] = [];
    for (let i = 0; i < filtered.length - 1; i++) {
      const a = filtered[i].acumulado || 0;
      const b = filtered[i + 1].acumulado || 0;
      const rate = a > 0 ? (b / a) * 100 : 0;
      rates.push({
        from: filtered[i].stage,
        to: filtered[i + 1].stage,
        rate: `${rate.toFixed(1)}%`
      });
    }
    return rates;
  }, [filtered]);

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
              <SelectItem value="Todas">Todas (suma municipal)</SelectItem>
              {epsList.map(e => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Funnel de Tamización y Diagnóstico</CardTitle>
            <p className="text-xs text-slate-500">Número acumulado de actividades por etapa del circuito.</p>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <FunnelChart>
                  <Tooltip formatter={(val: number, name: string) => [val.toLocaleString('es-CO'), name]} />
                  <Funnel
                    dataKey="value"
                    data={funnelChartData}
                    isAnimationActive
                  >
                    <LabelList position="inside" fill="#1e293b" stroke="none" dataKey="name" className="text-[11px] font-medium" />
                    {funnelChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} stroke="#fff" strokeWidth={2} />
                    ))}
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tasa de Conversión entre Etapas</CardTitle>
            <p className="text-xs text-slate-500">Porcentaje de casos que avanzan de una etapa a la siguiente.</p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Transición</TableHead>
                  <TableHead className="text-xs text-right">Conversión</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversionRates.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm text-slate-700">{r.from} → {r.to}</TableCell>
                    <TableCell className="text-sm font-semibold text-slate-900 text-right">{r.rate}</TableCell>
                  </TableRow>
                ))}
                {conversionRates.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-slate-400">Datos insuficientes</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <div className="mt-6">
              <h4 className="text-sm font-semibold text-slate-800 mb-2">Detalle por Etapa</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Etapa</TableHead>
                    <TableHead className="text-xs text-right">Acumulado</TableHead>
                    <TableHead className="text-xs text-right">Meta</TableHead>
                    <TableHead className="text-xs text-right">% Meta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((f, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm text-slate-700">{f.stage}</TableCell>
                      <TableCell className="text-sm text-right font-medium">{f.acumulado.toLocaleString('es-CO')}</TableCell>
                      <TableCell className="text-sm text-right text-slate-500">{f.meta ? f.meta.toLocaleString('es-CO') : 'N/D'}</TableCell>
                      <TableCell className="text-sm text-right">
                        <span className={`font-semibold ${f.pct_ejecucion > 0.5 ? 'text-emerald-600' : f.pct_ejecucion > 0.2 ? 'text-amber-600' : 'text-red-600'}`}>
                          {f.pct_ejecucion !== null && f.pct_ejecucion !== undefined ? `${(f.pct_ejecucion * 100).toFixed(1)}%` : 'N/D'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
