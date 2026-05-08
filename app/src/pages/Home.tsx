import { useState } from 'react';
import { useData } from '@/hooks/useData';
import { Sidebar } from '@/components/Sidebar';
import { ExecutivePanel } from '@/components/ExecutivePanel';
import { TrendsPanel } from '@/components/TrendsPanel';
import { FunnelPanel } from '@/components/FunnelPanel';
import { MonthlyPanel } from '@/components/MonthlyPanel';
import { DetailPanel } from '@/components/DetailPanel';

export type ViewKey = 'executive' | 'trends' | 'funnel' | 'monthly' | 'detail';

export default function Home() {
  const [view, setView] = useState<ViewKey>('executive');
  const data = useData();

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500 text-lg font-medium animate-pulse">Cargando datos...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-800">
      <Sidebar active={view} onChange={setView} alertCount={data.alertas.length} />
      <main className="flex-1 p-6 overflow-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Dashboard Analítico — Detección Temprana de Cáncer</h1>
          <p className="text-sm text-slate-500 mt-1">Municipio de Sogamoso · Datos acumulados a marzo 2026 · Fuente: Secretaría de Salud / EPS</p>
        </header>

        {view === 'executive' && <ExecutivePanel data={data} />}
        {view === 'trends' && <TrendsPanel data={data} />}
        {view === 'funnel' && <FunnelPanel data={data} />}
        {view === 'monthly' && <MonthlyPanel data={data} />}
        {view === 'detail' && <DetailPanel data={data} />}
      </main>
    </div>
  );
}
