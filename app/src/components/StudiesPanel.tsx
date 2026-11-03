import { useMemo, useRef, useState } from 'react';
import { BarChart3, FileSpreadsheet, Trash2, Upload } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { parseStudy, type Study } from '@/hooks/useStudies';

interface StudiesPanelProps {
  studies: Study[];
  onAdd: (study: Study) => void;
  onRemove: (id: string) => void;
}

export function StudiesPanel({ studies, onAdd, onRemove }: StudiesPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedStudyId, setSelectedStudyId] = useState<string | null>(studies[0]?.id ?? null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [selectedMetric, setSelectedMetric] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const selectedStudy = studies.find((study) => study.id === selectedStudyId) ?? studies[0];
  const sheet = selectedStudy?.sheets.find((item) => item.name === selectedSheet) ?? selectedStudy?.sheets[0];
  const numericColumns = useMemo(() => {
    if (!sheet) return [];
    return sheet.columns.filter((column) => {
      const values = (sheet.analysisRows ?? sheet.rows).map((row) => row[column]).filter(Boolean);
      return values.length > 0 && values.some((value) => Number.isFinite(Number(value)));
    });
  }, [sheet]);
  const metric = selectedMetric && numericColumns.includes(selectedMetric) ? selectedMetric : numericColumns[0];
  const categoryColumn = sheet?.columns.find((column) => column !== metric && !numericColumns.includes(column)) ?? sheet?.columns[0];
  const chartData = useMemo(() => {
    if (!sheet || !metric || !categoryColumn) return [];
    return (sheet.analysisRows ?? sheet.rows)
      .map((row, index) => ({
        category: row[categoryColumn] || `Fila ${index + 1}`,
        value: Number(row[metric]),
      }))
      .filter((row) => Number.isFinite(row.value))
      .slice(0, 100);
  }, [categoryColumn, metric, sheet]);
  const metricValues = chartData.map((row) => row.value);
  const metricTotal = metricValues.reduce((total, value) => total + value, 0);
  const metricAverage = metricValues.length > 0 ? metricTotal / metricValues.length : 0;
  const comparisonData = useMemo(() => {
    if (!sheet || !metric || !categoryColumn) return [];
    const groups = new Map<string, number>();
    for (const row of sheet.analysisRows ?? sheet.rows) {
      const category = row[categoryColumn] || 'Sin categoría';
      const value = Number(row[metric]);
      if (Number.isFinite(value)) groups.set(category, (groups.get(category) ?? 0) + value);
    }
    return [...groups.entries()]
      .map(([category, value]) => ({ category, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15);
  }, [categoryColumn, metric, sheet]);
  const trendColumns = numericColumns.slice(0, 3);
  const trendData = useMemo(() => {
    if (!sheet || !categoryColumn || trendColumns.length === 0) return [];
    return (sheet.analysisRows ?? sheet.rows).slice(0, 50).map((row, index) => {
      const point: Record<string, string | number> = {
        category: row[categoryColumn] || `Fila ${index + 1}`,
      };
      for (const column of trendColumns) point[column] = Number(row[column]) || 0;
      return point;
    });
  }, [categoryColumn, sheet, trendColumns]);
  const distributionData = comparisonData.slice(0, 8);
  const chartColors = ['#059669', '#2563eb', '#d97706', '#7c3aed', '#dc2626', '#0891b2', '#65a30d', '#db2777'];

  function selectStudy(study: Study) {
    setSelectedStudyId(study.id);
    setSelectedSheet(study.sheets[0]?.name ?? '');
    setSelectedMetric('');
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    setError(null);
    try {
      for (const selectedFile of files) {
        const study = await parseStudy(selectedFile);
        onAdd(study);
        selectStudy(study);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible cargar el archivo.');
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileSpreadsheet size={20} /> Nuevos estudios</CardTitle>
          <CardDescription>
            Agrega documentos Excel para consultar sus hojas y una vista previa de los datos. Los estudios se guardan en este navegador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <input ref={inputRef} type="file" accept=".xlsx" multiple className="hidden" onChange={handleFileChange} />
          <Button onClick={() => inputRef.current?.click()}><Upload size={16} /> Cargar documentos XLSX</Button>
          {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      {studies.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-slate-500">Aún no hay documentos adicionales.</CardContent></Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <Card>
            <CardHeader><CardTitle className="text-base">Documentos cargados</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {studies.map((study) => (
                <div key={study.id} className={`flex items-center gap-2 rounded-md p-2 ${selectedStudy?.id === study.id ? 'bg-emerald-50' : ''}`}>
                  <button className="min-w-0 flex-1 text-left text-sm" onClick={() => selectStudy(study)}>
                    <span className="block truncate font-medium">{study.name}</span>
                    <span className="text-xs text-slate-500">{study.sheets.length} hoja(s)</span>
                  </button>
                  <button aria-label={`Eliminar ${study.name}`} className="p-1 text-slate-400 hover:text-red-600" onClick={() => onRemove(study.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>

          {selectedStudy && sheet && (
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle className="truncate">{selectedStudy.name}</CardTitle>
                <CardDescription>{sheet.totalRows} fila(s) · se muestran máximo 100 filas de vista previa</CardDescription>
                <div className="flex flex-wrap gap-2 pt-2">
                  {selectedStudy.sheets.map((item) => (
                    <Button key={item.name} size="sm" variant={item.name === sheet.name ? 'default' : 'outline'} onClick={() => setSelectedSheet(item.name)}>
                      {item.name}
                    </Button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                {numericColumns.length > 0 && (
                  <div className="mb-6 space-y-4">
                    <div className="flex flex-wrap items-end gap-4">
                      <div>
                        <label htmlFor="study-metric" className="mb-1 block text-xs font-medium text-slate-600">Métrica numérica</label>
                        <select id="study-metric" value={metric} onChange={(event) => setSelectedMetric(event.target.value)} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm">
                          {numericColumns.map((column) => <option key={column} value={column}>{column}</option>)}
                        </select>
                      </div>
                      <p className="text-xs text-slate-500">Agrupada por: <strong>{categoryColumn}</strong></p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg bg-slate-100 p-3"><p className="text-xs text-slate-500">Registros analizados</p><p className="text-xl font-bold">{metricValues.length}</p></div>
                      <div className="rounded-lg bg-slate-100 p-3"><p className="text-xs text-slate-500">Total</p><p className="text-xl font-bold">{metricTotal.toLocaleString('es-CO', { maximumFractionDigits: 2 })}</p></div>
                      <div className="rounded-lg bg-slate-100 p-3"><p className="text-xs text-slate-500">Promedio</p><p className="text-xl font-bold">{metricAverage.toLocaleString('es-CO', { maximumFractionDigits: 2 })}</p></div>
                    </div>
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="category" angle={-25} textAnchor="end" height={70} tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="value" name={metric} fill="#059669" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid gap-6 xl:grid-cols-2">
                      <div className="rounded-lg border p-3">
                        <h3 className="mb-2 text-sm font-semibold">Comparativo acumulado por categoría</h3>
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={comparisonData} layout="vertical" margin={{ left: 20, right: 12 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis type="number" tick={{ fontSize: 11 }} />
                              <YAxis dataKey="category" type="category" width={100} tick={{ fontSize: 10 }} />
                              <Tooltip />
                              <Bar dataKey="value" name="Total" fill="#2563eb" radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <div className="rounded-lg border p-3">
                        <h3 className="mb-2 text-sm font-semibold">Distribución del total</h3>
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={distributionData} dataKey="value" nameKey="category" cx="50%" cy="48%" outerRadius={90} label={({ category, percent }) => `${category}: ${(percent * 100).toFixed(0)}%`}>
                                {distributionData.map((entry, index) => <Cell key={entry.category} fill={chartColors[index % chartColors.length]} />)}
                              </Pie>
                              <Tooltip />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                    {trendColumns.length > 1 && (
                      <div className="rounded-lg border p-3">
                        <h3 className="mb-2 text-sm font-semibold">Tendencia comparativa de métricas</h3>
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trendData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis dataKey="category" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 11 }} />
                              <Tooltip />
                              <Legend />
                              {trendColumns.map((column, index) => (
                                <Line key={column} type="monotone" dataKey={column} stroke={chartColors[index]} strokeWidth={2} dot={{ r: 2 }} />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {numericColumns.length === 0 && (
                  <div className="mb-4 flex items-center gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                    <BarChart3 size={16} /> Esta hoja no tiene columnas numéricas para generar gráficos.
                  </div>
                )}
                <div className="overflow-auto rounded-md border">
                  <table className="w-full min-w-max text-left text-sm">
                    <thead className="bg-slate-100">
                      <tr>{sheet.columns.map((column) => <th key={column} className="px-3 py-2 font-semibold">{column}</th>)}</tr>
                    </thead>
                    <tbody>
                      {sheet.rows.map((row, index) => (
                        <tr key={index} className="border-t">
                          {sheet.columns.map((column) => <td key={column} className="px-3 py-2">{row[column] ?? ''}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
