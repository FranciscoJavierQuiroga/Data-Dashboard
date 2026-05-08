import { useMemo } from 'react';
import type { DashboardData } from '@/hooks/useData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar } from 'recharts';

const PROGRAM_COLORS: Record<string, string> = {
  'Dt Cervix': '#059669',
  'Dt Mama': '#d97706',
  'Dt Prostata': '#2563eb',
  'Dt Colon Y Recto': '#7c3aed',
};

export function TrendsPanel({ data }: { data: DashboardData }) {
  const { historico, consolidado } = data;

  // Agrupar histórico por indicador y año (promediando EPS excepto Total Municipio)
  const histByIndicator = useMemo(() => {
    const map: Record<string, Record<number, { total: number; count: number; total_mun: number | null }>> = {};
    for (const row of historico) {
      const ind = row.INDICADOR_CLEAN;
      const year = row.AÑO;
      if (!map[ind]) map[ind] = {};
      if (!map[ind][year]) map[ind][year] = { total: 0, count: 0, total_mun: null };
      if (row.EPS_CLEAN === 'Total Municipio') {
        map[ind][year].total_mun = row.VALOR;
      } else {
        map[ind][year].total += row.VALOR;
        map[ind][year].count += 1;
      }
    }

    const indicators = Object.keys(map).sort();
    const years = [2021, 2022, 2023, 2024, 2025];
    const rows = years.map(y => {
      const obj: Record<string, any> = { year: y };
      for (const ind of indicators) {
        const entry = map[ind][y];
        // Preferir total municipio si existe, sino promedio EPS
        if (entry) {
          obj[ind] = entry.total_mun !== null ? entry.total_mun : (entry.count > 0 ? entry.total / entry.count : null);
        } else {
          obj[ind] = null;
        }
      }
      return obj;
    });
    return { rows, indicators };
  }, [historico]);

  // Radar data por EPS (último año 2025)
  const radarData = useMemo(() => {
    const epsList = [...new Set(historico.map(h => h.EPS_CLEAN))].filter(e => e !== 'Total Municipio');
    const indicators = [...new Set(historico.map(h => h.INDICADOR_CLEAN))];
    // Para cada indicador, obtener valor de cada EPS en 2025
    const rows = indicators.map(ind => {
      const obj: Record<string, any> = { indicator: ind };
      for (const eps of epsList) {
        const val = historico.find(h => h.INDICADOR_CLEAN === ind && h.EPS_CLEAN === eps && h.AÑO === 2025)?.VALOR ?? 0;
        obj[eps] = val;
      }
      return obj;
    });
    return { rows, epsList };
  }, [historico]);

  // Comparativo EPS para coberturas principales (consolidado)
  const epsComparison = useMemo(() => {
    const coberturas = consolidado.filter(c =>
      c.TIPO_INDICADOR.includes('COBERTURA') &&
      !c.TIPO_INDICADOR.includes('POSITIVIDAD') &&
      !c.TIPO_INDICADOR.includes('BIOPSIA')
    );
    const epsList = [...new Set(coberturas.map(c => c.EPS))].sort();
    const programs = [...new Set(coberturas.map(c => c.PROGRAMA))];
    const rows = epsList.map(eps => {
      const obj: Record<string, any> = { eps };
      for (const prog of programs) {
        const vals = coberturas.filter(c => c.EPS === eps && c.PROGRAMA === prog);
        // Si hay múltiples coberturas por programa, promediar
        const avg = vals.length > 0 ? vals.reduce((s, v) => s + (v.EJECUCION || 0), 0) / vals.length : 0;
        obj[prog] = avg;
      }
      return obj;
    });
    return { rows, programs };
  }, [consolidado]);

  return (
    <div className="space-y-6">
      {/* Evolución histórica anual */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolución Histórica Anual por Programa (2021-2025)</CardTitle>
          <p className="text-xs text-slate-500">Valores promedio municipal. Escala 0-1 donde 1 = 100% de cobertura.</p>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={histByIndicator.rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 1]} tick={{ fontSize: 12 }} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} />
                <Tooltip formatter={(val: number, name: string) => [val !== null ? `${(val * 100).toFixed(1)}%` : 'N/D', name]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {histByIndicator.indicators.map((ind, i) => (
                  <Line
                    key={ind}
                    type="monotone"
                    dataKey={ind}
                    stroke={['#059669', '#d97706', '#2563eb', '#7c3aed', '#dc2626', '#0891b2'][i % 6]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar por EPS */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Perfil de Desempeño por EPS (2025)</CardTitle>
            <p className="text-xs text-slate-500">Comparación radar de coberturas por aseguradora.</p>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData.rows}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="indicator" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis domain={[0, 1]} tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} />
                  {radarData.epsList.map((eps, i) => (
                    <Radar
                      key={eps}
                      name={eps}
                      dataKey={eps}
                      stroke={['#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0891b2'][i % 6]}
                      fill={['#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0891b2'][i % 6]}
                      fillOpacity={0.15}
                    />
                  ))}
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Tooltip formatter={(val: number, name: string) => [`${(val * 100).toFixed(1)}%`, name]} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Barras comparativo EPS 2026 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comparativo Ejecución Acumulada por EPS (2026)</CardTitle>
            <p className="text-xs text-slate-500">Promedio de coberturas principales por programa y EPS.</p>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={epsComparison.rows} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" domain={[0, 1]} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 12 }} />
                  <YAxis dataKey="eps" type="category" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip formatter={(val: number, name: string) => [`${(val * 100).toFixed(1)}%`, name]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {epsComparison.programs.map((prog) => (
                    <Bar key={prog} dataKey={prog} fill={PROGRAM_COLORS[prog] || '#64748b'} radius={[0, 4, 4, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
