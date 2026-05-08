import { LayoutDashboard, TrendingUp, Filter, CalendarDays, Table, AlertTriangle } from 'lucide-react';
import type { ViewKey } from '@/pages/Home';

const items: { key: ViewKey; label: string; icon: React.ReactNode }[] = [
  { key: 'executive', label: 'Ejecutivo', icon: <LayoutDashboard size={18} /> },
  { key: 'trends', label: 'Tendencias', icon: <TrendingUp size={18} /> },
  { key: 'funnel', label: 'Funnel Operativo', icon: <Filter size={18} /> },
  { key: 'monthly', label: 'Avance Mensual', icon: <CalendarDays size={18} /> },
  { key: 'detail', label: 'Detalle EPS', icon: <Table size={18} /> },
];

export function Sidebar({ active, onChange, alertCount }: { active: ViewKey; onChange: (v: ViewKey) => void; alertCount: number }) {
  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col">
      <div className="p-5 border-b border-slate-700">
        <div className="font-bold text-lg tracking-tight">Sogamoso Salud</div>
        <div className="text-xs text-slate-400 mt-1">Cáncer · Tamización · 2026</div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
              active === item.key
                ? 'bg-emerald-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {item.icon}
            <span className="flex-1 text-left">{item.label}</span>
            {item.key === 'executive' && alertCount > 0 && (
              <span className="ml-auto bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <AlertTriangle size={10} />
                {alertCount}
              </span>
            )}
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-700 text-xs text-slate-400">
        Actualizado: mayo 2026
      </div>
    </aside>
  );
}
