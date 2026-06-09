import { useMemo, useState } from 'react';
import type { DashboardData } from '@/hooks/useData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Info, ArrowUpRight, ArrowDownRight, Users, Target, Activity } from 'lucide-react';

const MONTHS_ORDER = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
const MONTH_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

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

export function ExecutivePanel({ data }: { data: DashboardData }) {
  const { kpis, alertas, funnel, mensual } = data;
  const [selectedEps, setSelectedEps] = useState<string>('Todas');

  const epsList = useMemo(() => {
    const list = [...new Set(funnel.map(f => f.eps))].sort();
    return ['Todas', ...list];
  }, [funnel]);

  // Filtrar alertas por EPS
  const filteredAlertas = useMemo(() => {
    if (selectedEps === 'Todas') return alertas;
    return alertas.filter(a => a.eps === selectedEps);
  }, [alertas, selectedEps]);

  const epsLatestMonth = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of mensual) {
      if (m.VALOR_MES && m.VALOR_MES > 0) {
        const order = MONTHS_ORDER.indexOf(m.MES);
        if (order > (map[m.EPS] ?? -1)) map[m.EPS] = order;
      }
    }
    return map;
  }, [mensual]);

  // Calcular KPIs por EPS usando datos del funnel
  const kpisPorEps = useMemo(() => {
    if (selectedEps === 'Todas') {
      // Usar KPIs municipales pre-calculados
      return kpis.filter(k => k.indicador.includes('COBERTURA'));
    }

    // Para una EPS específica, calcular desde funnel
    const epsFunnel = funnel.filter(f => f.eps === selectedEps);

    const indicadoresClave = [
      { programa: 'Dt Cervix', tipo_indicador: 'COBERTURA CCU', label: 'Cobertura CCU' },
      { programa: 'Dt Cervix', tipo_indicador: 'COBERTURA ADN VPH', label: 'Cobertura ADN VPH' },
      { programa: 'Dt Mama', tipo_indicador: 'COBERTURA EXAMEN CLINICO DE LA MAMA', label: 'Examen Clínico Mama' },
      { programa: 'Dt Mama', tipo_indicador: 'COBERTURA MAMOGRAFIA', label: 'Cobertura Mamografía' },
      { programa: 'Dt Prostata', tipo_indicador: 'COBERTURA TACTO RECTAL', label: 'Tacto Rectal' },
      { programa: 'Dt Prostata', tipo_indicador: 'COBERTURA PSA', label: 'Cobertura PSA' },
      { programa: 'Dt Colon Y Recto', tipo_indicador: 'COBERTURA TAMIZACION SANGRE OCULTA EN HECES', label: 'Cobertura SOMF' },
    ];

    return indicadoresClave.map(ind => {
      const row = epsFunnel.find(f =>
        f.programa === ind.programa && f.tipo_indicador === ind.tipo_indicador
      );
      const acum = row?.acumulado ?? 0;
      const meta = row?.meta ?? 0;
      const poblacion = row?.poblacion_elegible ?? 0;
      const tasa = poblacion > 0 ? acum / poblacion : null;
      const pctAvance = meta > 0 ? acum / meta : null;
      return {
        programa: ind.programa,
        indicador: ind.tipo_indicador,
        label: ind.label,
        acumulado_2026: acum,
        meta_2026: meta,
        poblacion: poblacion,
        tasa_cobertura: tasa !== null ? Math.round(tasa * 10000) / 10000 : null,
        pct_avance_meta: pctAvance !== null ? Math.round(pctAvance * 10000) / 10000 : null,
      };
    });
  }, [kpis, funnel, selectedEps]);

  const totalAlertasCriticas = filteredAlertas.filter(a => a.nivel === 'crítico').length;
  const totalAlertasAltas = filteredAlertas.filter(a => a.nivel === 'alto').length;
  const totalAlertasMedias = filteredAlertas.filter(a => a.nivel === 'medio').length;

  return (
    <div className="space-y-6">
      {/* Filtro EPS */}
      <div className="flex items-center gap-4">
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Filtrar por EPS</label>
          <Select value={selectedEps} onValueChange={setSelectedEps}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {epsList.map(e => (
                <SelectItem key={e} value={e}>
                  <span className="flex items-center gap-2">
                    {e}
                    {epsLatestMonth[e] !== undefined && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                        {MONTH_LABELS[epsLatestMonth[e]]}
                      </Badge>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedEps !== 'Todas' && (
          <div className="text-sm text-slate-500 bg-slate-100 px-3 py-1.5 rounded-md">
            Mostrando datos solo para <strong className="text-slate-700">{selectedEps}</strong>
          </div>
        )}
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
        {kpisPorEps.map((k) => (
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
          <CardTitle className="text-base">
            Registro de Alertas y Gestión Clínica
            {selectedEps !== 'Todas' && <span className="text-slate-400 font-normal"> — {selectedEps}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Nivel</th>
                  <th className="text-left px-3 py-2 font-medium">Programa</th>
                  {selectedEps === 'Todas' && <th className="text-left px-3 py-2 font-medium">EPS</th>}
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
                    {selectedEps === 'Todas' && <td className="px-3 py-2 text-slate-700">{a.eps}</td>}
                    <td className="px-3 py-2 text-slate-600">{a.tipo}</td>
                    <td className="px-3 py-2 text-slate-800">{a.mensaje}</td>
                  </tr>
                ))}
                {filteredAlertas.length === 0 && (
                  <tr><td colSpan={selectedEps === 'Todas' ? 5 : 4} className="px-3 py-6 text-center text-slate-400">No hay alertas registradas{selectedEps !== 'Todas' ? ` para ${selectedEps}` : ''}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
