import { useMemo, useState } from 'react';
import type { DashboardData } from '@/hooks/useData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CheckCircle2, Info, ArrowUpRight, ArrowDownRight, Users, Target, Activity } from 'lucide-react';

function kpiColor(val: number | null) {
  if (val === null || val === undefined) return 'text-slate-400';
  if (val >= 0.5) return 'text-emerald-600';
  if (val >= 0.25) return 'text-amber-600';
  return 'text-red-600';
}

function kpiBg(val: number | null) {
  if (val === null || val === undefined) return 'bg-slate-100';
  if (val >= 0.5) return 'bg-emerald-50';
  if (val >= 0.25) return 'bg-amber-50';
  return 'bg-red-50';
}

function normalizeEpsName(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatEpsLabel(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function ExecutivePanel({ data }: { data: DashboardData }) {
  const { kpis, alertas, funnel, consolidado } = data;
  const [selectedEps, setSelectedEps] = useState<string>('Municipio');

  const epsList = useMemo(() => {
    const fromFunnel = funnel.map(f => f.eps).filter(Boolean);
    const fromConsolidado = consolidado.map(c => c.EPS).filter(Boolean);
    const labelByKey = new Map<string, string>();
    for (const eps of [...fromFunnel, ...fromConsolidado]) {
      const key = normalizeEpsName(eps);
      if (!labelByKey.has(key)) {
        labelByKey.set(key, formatEpsLabel(eps));
      }
    }
    return Array.from(labelByKey.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }, [funnel, consolidado]);

  const filteredAlertas = useMemo(() => {
    if (selectedEps === 'Municipio') return alertas;
    return alertas.filter(a => normalizeEpsName(a.eps) === selectedEps);
  }, [alertas, selectedEps]);

  const coberturas = kpis.filter(k => k.indicador.includes('COBERTURA'));
  const totalAlertasCriticas = filteredAlertas.filter(a => a.nivel === 'crítico').length;
  const totalAlertasAltas = filteredAlertas.filter(a => a.nivel === 'alto').length;
  const totalAlertasMedias = filteredAlertas.filter(a => a.nivel === 'medio').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-end justify-between">
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">EPS</label>
          <Select value={selectedEps} onValueChange={setSelectedEps}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Municipio">Municipio (totales generales)</SelectItem>
              {epsList.map(eps => (
                <SelectItem key={eps.value} value={eps.value}>{eps.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-slate-500">
          KPIs por programa se muestran a nivel municipal.
        </div>
      </div>
      {/* Resumen alertas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="text-red-600" size={24} />
            <div>
              <div className="text-sm text-red-700 font-medium">Alertas Críticas</div>
              <div className="text-2xl font-bold text-red-800">{totalAlertasCriticas}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="text-amber-600" size={24} />
            <div>
              <div className="text-sm text-amber-700 font-medium">Alertas Altas</div>
              <div className="text-2xl font-bold text-amber-800">{totalAlertasAltas}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="p-4 flex items-center gap-3">
            <Info className="text-slate-600" size={24} />
            <div>
              <div className="text-sm text-slate-700 font-medium">Alertas Medias</div>
              <div className="text-2xl font-bold text-slate-800">{totalAlertasMedias}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="text-emerald-600" size={24} />
            <div>
              <div className="text-sm text-emerald-700 font-medium">Programas Activos</div>
              <div className="text-2xl font-bold text-emerald-800">4</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPIs por programa */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {coberturas.map((k) => (
          <Card key={k.indicador} className={`${kpiBg(k.pct_avance_meta)} border-0`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">{k.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-slate-900">{k.acumulado_2026.toLocaleString('es-CO')}</span>
                <span className="text-xs text-slate-500">acum.</span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm">
                <Target size={14} className="text-slate-400" />
                <span className="text-slate-500">Meta: {k.meta_2026.toLocaleString('es-CO')}</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                {k.pct_avance_meta !== null && k.pct_avance_meta >= 0.25 ? (
                  <ArrowUpRight size={16} className={kpiColor(k.pct_avance_meta)} />
                ) : (
                  <ArrowDownRight size={16} className={kpiColor(k.pct_avance_meta)} />
                )}
                <span className={`text-lg font-semibold ${kpiColor(k.pct_avance_meta)}`}>
                  {k.pct_avance_meta !== null ? `${(k.pct_avance_meta * 100).toFixed(1)}%` : 'N/D'}
                </span>
                <span className="text-xs text-slate-400">del avance</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                <Users size={12} />
                <span>Población: {k.poblacion?.toLocaleString('es-CO') ?? 'N/D'}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                <Activity size={12} />
                <span>Tasa cobertura: {k.tasa_cobertura !== null ? `${(k.tasa_cobertura * 100).toFixed(2)}%` : 'N/D'}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alertas detalladas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registro de Alertas y Gestión Clínica</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Nivel</th>
                  <th className="text-left px-3 py-2 font-medium">Programa</th>
                  <th className="text-left px-3 py-2 font-medium">EPS</th>
                  <th className="text-left px-3 py-2 font-medium">Tipo</th>
                  <th className="text-left px-3 py-2 font-medium">Descripción</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlertas.map((a, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide ${
                        a.nivel === 'crítico' ? 'bg-red-100 text-red-700' :
                        a.nivel === 'alto' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {a.nivel === 'crítico' && <AlertTriangle size={10} />}
                        {a.nivel}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{a.programa}</td>
                    <td className="px-3 py-2 text-slate-700">{a.eps}</td>
                    <td className="px-3 py-2 text-slate-600">{a.tipo}</td>
                    <td className="px-3 py-2 text-slate-800">{a.mensaje}</td>
                  </tr>
                ))}
                {filteredAlertas.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">No hay alertas registradas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
