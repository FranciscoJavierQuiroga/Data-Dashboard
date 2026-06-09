import { useState, useMemo } from 'react';
import { useData } from '@/hooks/useData';
import { Sidebar } from '@/components/Sidebar';
import { ExecutivePanel } from '@/components/ExecutivePanel';
import { TrendsPanel } from '@/components/TrendsPanel';
import { FunnelPanel } from '@/components/FunnelPanel';
import { MonthlyPanel } from '@/components/MonthlyPanel';
import { DetailPanel } from '@/components/DetailPanel';
import { PoissonPanel } from '@/components/PoissonPanel';

const MONTHS_ORDER = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
const MONTH_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

export type ViewKey = 'executive' | 'trends' | 'funnel' | 'monthly' | 'detail' | 'poisson';

export default function Home() {
  const [view, setView] = useState<ViewKey>('executive');
  const data = useData();

  const epsLatestMonth = useMemo(() => {
    if (!data) return {};
    const map: Record<string, number> = {};
    for (const m of data.mensual) {
      if (m.VALOR_MES && m.VALOR_MES > 0) {
        const order = MONTHS_ORDER.indexOf(m.MES);
        if (order > (map[m.EPS] ?? -1)) map[m.EPS] = order;
      }
    }
    return map;
  }, [data]);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500 text-lg font-medium animate-pulse">Cargando datos...</div>
      </div>
    );
  }

  const overallLastMonth = Math.max(-1, ...Object.values(epsLatestMonth));
  const monthRange = overallLastMonth >= 0
    ? `Ene-${MONTH_LABELS[overallLastMonth]} 2026`
    : '2026';

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-800">
      <Sidebar active={view} onChange={setView} alertCount={data.alertas.length} />
      <main className="flex-1 p-6 overflow-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Dashboard Analítico — Detección Temprana de Cáncer</h1>
          <p className="text-sm text-slate-500 mt-1">Municipio de Sogamoso · Datos acumulados {monthRange} · Fuente: Secretaría de Salud / EPS</p>
        </header>

        {view === 'executive' && <ExecutivePanel data={data} />}
        {view === 'trends' && <TrendsPanel data={data} />}
        {view === 'funnel' && <FunnelPanel data={data} />}
        {view === 'monthly' && <MonthlyPanel data={data} />}
        {view === 'detail' && <DetailPanel data={data} />}
        {view === 'poisson' && <PoissonPanel data={data} />}
      </main>
    </div>
  );
}
