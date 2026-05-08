import { useMemo, useState } from 'react';
import type { DashboardData } from '@/hooks/useData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';

export function DetailPanel({ data }: { data: DashboardData }) {
  const { consolidado, funnel } = data;
  const [selectedProgram, setSelectedProgram] = useState<string>('Todos');

  const programs = useMemo(() => [...new Set(consolidado.map(c => c.PROGRAMA))].sort(), [consolidado]);

  // Tabla resumen por programa y EPS
  const summaryTable = useMemo(() => {
    const epsList = [...new Set(consolidado.map(c => c.EPS))].sort();
    const progs = selectedProgram === 'Todos' ? programs : [selectedProgram];
    const rows = [];
    for (const prog of progs) {
      for (const ind of [...new Set(consolidado.filter(c => c.PROGRAMA === prog).map(c => c.TIPO_INDICADOR))]) {
        const obj: Record<string, any> = { programa: prog, indicador: ind };
        for (const eps of epsList) {
          const val = consolidado.find(c => c.PROGRAMA === prog && c.TIPO_INDICADOR === ind && c.EPS === eps)?.EJECUCION ?? null;
          obj[eps] = val;
        }
        rows.push(obj);
      }
    }
    return { rows, epsList };
  }, [consolidado, selectedProgram, programs]);

  // Tabla funnel por EPS
  const funnelTable = useMemo<{ rows: Record<string, any>[]; epsList: string[] }>(() => {
    if (selectedProgram === 'Todos') return { rows: [], epsList: [] };
    const rows = funnel.filter(f => f.programa === selectedProgram);
    const epsList = [...new Set(rows.map(r => r.eps))].sort();
    const stages = [...new Set(rows.map(r => r.stage))];
    const table = stages.map(stage => {
      const obj: Record<string, any> = { stage };
      for (const eps of epsList) {
        const entry = rows.find(r => r.stage === stage && r.eps === eps);
        obj[eps] = entry ? { acumulado: entry.acumulado, pct: entry.pct_ejecucion } : null;
      }
      return obj;
    });
    return { rows: table, epsList };
  }, [funnel, selectedProgram]);

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
              <SelectItem value="Todos">Todos</SelectItem>
              {programs.map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ejecución Acumulada por Indicador y EPS</CardTitle>
          <p className="text-xs text-slate-500">Valores de cumplimiento desagregados por aseguradora (proporciones del 0 al 1).</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Programa</TableHead>
                  <TableHead className="text-xs">Indicador</TableHead>
                  {summaryTable.epsList.map(eps => (
                    <TableHead key={eps} className="text-xs text-right">{eps}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryTable.rows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm text-slate-700 whitespace-nowrap">{row.programa}</TableCell>
                    <TableCell className="text-sm text-slate-600">{row.indicador}</TableCell>
                    {summaryTable.epsList.map(eps => {
                      const val = row[eps];
                      const isPct = val !== null && val !== undefined;
                      return (
                        <TableCell key={eps} className="text-sm text-right">
                          {isPct ? (
                            <div className="flex flex-col items-end gap-1">
                              <span className={`font-semibold ${val > 0.5 ? 'text-emerald-600' : val > 0.2 ? 'text-amber-600' : 'text-red-600'}`}>
                                {(val * 100).toFixed(1)}%
                              </span>
                              <Progress value={val * 100} className="w-20 h-1.5" />
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selectedProgram !== 'Todos' && funnelTable.epsList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Circuito Diagnóstico por EPS — {selectedProgram}</CardTitle>
            <p className="text-xs text-slate-500">Número de actividades y porcentaje de ejecución por etapa.</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Etapa</TableHead>
                    {funnelTable.epsList.map(eps => (
                      <TableHead key={eps} className="text-xs text-right">{eps}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {funnelTable.rows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm text-slate-700 font-medium">{row.stage}</TableCell>
                      {funnelTable.epsList.map(eps => {
                        const entry = row[eps];
                        return (
                          <TableCell key={eps} className="text-sm text-right">
                            {entry ? (
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="font-semibold text-slate-800">{entry.acumulado.toLocaleString('es-CO')}</span>
                                <span className={`text-[11px] ${entry.pct > 0.5 ? 'text-emerald-600' : entry.pct > 0.2 ? 'text-amber-600' : 'text-red-600'}`}>
                                  {(entry.pct * 100).toFixed(1)}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
