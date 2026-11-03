import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  History,
  LogOut,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ApiError,
  clearSession,
  commitImport,
  createEps,
  createIndicator,
  createProgram,
  createUser,
  deactivateUser,
  deleteEps,
  deleteIndicator,
  deleteProgram,
  getCurrentUser,
  getSession,
  listAudit,
  listEps,
  listImports,
  listIndicators,
  listPrograms,
  listUsers,
  login,
  rollbackImport,
  saveSession,
  updateEps,
  updateProgram,
  uploadImport,
  type AuditLog,
  type Eps,
  type ImportBatch,
  type Indicator,
  type Program,
  type Role,
  type Session,
  type User,
} from '@/lib/api';

type TabKey = 'imports' | 'catalogs' | 'users' | 'audit';

const TABS: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
  { key: 'imports', label: 'Importaciones', icon: <FileSpreadsheet size={16} /> },
  { key: 'catalogs', label: 'Catálogos', icon: <Database size={16} /> },
  { key: 'users', label: 'Usuarios', icon: <Users size={16} /> },
  { key: 'audit', label: 'Auditoría', icon: <History size={16} /> },
];

const DATASET_TYPES = ['auto', 'consolidado', 'historico', 'comportamiento', 'poblacion', 'factores'];

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
}

function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Ocurrió un error inesperado';
}

function Notice({ kind, children }: { kind: 'ok' | 'error'; children: React.ReactNode }) {
  const palette =
    kind === 'ok'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : 'border-red-200 bg-red-50 text-red-800';
  return (
    <div className={`flex items-start gap-2 rounded-md border p-3 text-sm ${palette}`}>
      {kind === 'ok' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
      <span>{children}</span>
    </div>
  );
}

function LoginCard({ onLoggedIn }: { onLoggedIn: (session: Session) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await login(email, password);
      saveSession(session);
      onLoggedIn(session);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield size={20} /> Administración
          </CardTitle>
          <CardDescription>
            Inicie sesión para importar archivos, administrar catálogos y revisar la auditoría.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="admin-email">Correo</Label>
              <Input
                id="admin-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={event => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Contraseña</Label>
              <Input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                required
              />
            </div>
            {error && <Notice kind="error">{error}</Notice>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Ingresando…' : 'Ingresar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function ImportsTab() {
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [datasetType, setDatasetType] = useState('auto');
  const [commitNow, setCommitNow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [result, setResult] = useState<ImportBatch | null>(null);

  const refresh = useCallback(async () => {
    try {
      const page = await listImports();
      setBatches(page.items);
    } catch (cause) {
      setMessage({ kind: 'error', text: errorText(cause) });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setMessage({ kind: 'error', text: 'Seleccione un archivo Excel.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    setResult(null);
    try {
      const batch = await uploadImport(file, datasetType, commitNow);
      setResult(batch);
      setMessage({
        kind: 'ok',
        text: commitNow
          ? 'Archivo importado y confirmado.'
          : 'Vista previa generada. Revise el resultado y confirme la importación.',
      });
      await refresh();
      if (commitNow) window.dispatchEvent(new Event('dashboard:refresh'));
    } catch (cause) {
      setMessage({ kind: 'error', text: errorText(cause) });
    } finally {
      setBusy(false);
    }
  }

  async function handleCommit(batch: ImportBatch) {
    setBusy(true);
    setMessage(null);
    try {
      const committed = await commitImport(batch.id);
      setMessage({
        kind: 'ok',
        text: `Importación confirmada: ${committed.inserted} insertados, ${committed.updated} actualizados.`,
      });
      await refresh();
      window.dispatchEvent(new Event('dashboard:refresh'));
    } catch (cause) {
      setMessage({ kind: 'error', text: errorText(cause) });
    } finally {
      setBusy(false);
    }
  }

  async function handleRollback(batch: ImportBatch) {
    if (!window.confirm(`¿Revertir la importación "${batch.original_name}"?`)) return;
    setBusy(true);
    setMessage(null);
    try {
      await rollbackImport(batch.id);
      setMessage({ kind: 'ok', text: 'Importación revertida.' });
      await refresh();
      window.dispatchEvent(new Event('dashboard:refresh'));
    } catch (cause) {
      setMessage({ kind: 'error', text: errorText(cause) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload size={18} /> Importar Excel
          </CardTitle>
          <CardDescription>
            Cargue los archivos originales. Primero se genera una vista previa; confirme para escribir en la base de datos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleUpload}>
            <div className="grid gap-4 md:grid-cols-[1fr_220px]">
              <div className="space-y-2">
                <Label htmlFor="import-file">Archivo (.xlsx / .xlsm)</Label>
                <Input
                  id="import-file"
                  type="file"
                  accept=".xlsx,.xlsm"
                  onChange={event => setFile(event.target.files?.[0] ?? null)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="import-type">Tipo de dataset</Label>
                <select
                  id="import-type"
                  value={datasetType}
                  onChange={event => setDatasetType(event.target.value)}
                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                >
                  {DATASET_TYPES.map(type => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={commitNow}
                onChange={event => setCommitNow(event.target.checked)}
              />
              Confirmar la importación inmediatamente
            </label>
            {message && <Notice kind={message.kind}>{message.text}</Notice>}
            <Button type="submit" disabled={busy || !file}>
              <Upload size={16} /> {busy ? 'Procesando…' : 'Cargar archivo'}
            </Button>
          </form>

          {result && (
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="flex flex-wrap items-center gap-3">
                <strong>{result.original_name}</strong>
                <span className="rounded bg-slate-200 px-2 py-0.5 text-xs">{result.status}</span>
                <span>{result.dataset_type}</span>
                <span>{result.row_count} filas</span>
                {result.error_count > 0 && <span className="text-red-700">{result.error_count} errores</span>}
                {result.warning_count > 0 && <span className="text-amber-700">{result.warning_count} advertencias</span>}
              </div>
              {result.errors.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-red-700">
                  {result.errors.slice(0, 8).map((error, index) => (
                    <li key={index}>{String(error.message ?? JSON.stringify(error))}</li>
                  ))}
                </ul>
              )}
              {result.warnings.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-amber-700">
                  {result.warnings.slice(0, 8).map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History size={18} /> Historial de importaciones
          </CardTitle>
          <CardDescription>Las importaciones confirmadas se pueden revertir.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={busy}>
            <RefreshCw size={14} /> Actualizar
          </Button>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Archivo</th>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">Filas</th>
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {batches.map(batch => (
                  <tr key={batch.id} className="border-b border-slate-100">
                    <td className="max-w-[240px] truncate py-2 pr-3" title={batch.original_name}>
                      {batch.original_name}
                    </td>
                    <td className="py-2 pr-3">{batch.dataset_type}</td>
                    <td className="py-2 pr-3">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{batch.status}</span>
                    </td>
                    <td className="py-2 pr-3">{batch.row_count}</td>
                    <td className="py-2 pr-3">{formatDate(batch.created_at)}</td>
                    <td className="py-2">
                      <div className="flex gap-2">
                        {batch.status === 'previewed' && (
                          <Button size="sm" onClick={() => void handleCommit(batch)} disabled={busy}>
                            Confirmar
                          </Button>
                        )}
                        {batch.status === 'committed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleRollback(batch)}
                            disabled={busy}
                          >
                            Revertir
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {batches.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500">
                      Aún no hay importaciones registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CatalogsTab() {
  const [eps, setEps] = useState<Eps[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [newEps, setNewEps] = useState('');
  const [newProgram, setNewProgram] = useState('');
  const [newIndicator, setNewIndicator] = useState('');
  const [newIndicatorProgram, setNewIndicatorProgram] = useState('');
  const [newIndicatorKind, setNewIndicatorKind] = useState<Indicator['kind']>('cobertura');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [epsRows, programRows, indicatorRows] = await Promise.all([
        listEps(),
        listPrograms(),
        listIndicators(),
      ]);
      setEps(epsRows);
      setPrograms(programRows);
      setIndicators(indicatorRows);
      setNewIndicatorProgram(current => current || String(programRows[0]?.id ?? ''));
    } catch (cause) {
      setMessage({ kind: 'error', text: errorText(cause) });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ kind: 'ok', text: success });
      await refresh();
    } catch (cause) {
      setMessage({ kind: 'error', text: errorText(cause) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {message && <Notice kind={message.kind}>{message.text}</Notice>}

      <Card>
        <CardHeader>
          <CardTitle>EPS</CardTitle>
          <CardDescription>Entidades responsables del reporte mensual.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex gap-2"
            onSubmit={event => {
              event.preventDefault();
              if (!newEps.trim()) return;
              void run(async () => {
                await createEps(newEps.trim());
                setNewEps('');
              }, 'EPS creada.');
            }}
          >
            <Input
              value={newEps}
              onChange={event => setNewEps(event.target.value)}
              placeholder="Nombre de la EPS"
            />
            <Button type="submit" disabled={busy || !newEps.trim()}>
              <Plus size={16} /> Agregar
            </Button>
          </form>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {eps.map(row => (
              <div key={row.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{row.name}</span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void run(() => updateEps(row.id, { active: !row.active }), 'EPS actualizada.')}
                >
                  {row.active ? 'Activa' : 'Inactiva'}
                </Button>
                <button
                  aria-label={`Eliminar EPS ${row.name}`}
                  className="p-1 text-slate-400 hover:text-red-600"
                  onClick={() => {
                    if (!window.confirm(`¿Eliminar la EPS "${row.name}"?`)) return;
                    void run(() => deleteEps(row.id), 'EPS eliminada.');
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Programas</CardTitle>
          <CardDescription>Programas de detección temprana de cáncer.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex gap-2"
            onSubmit={event => {
              event.preventDefault();
              if (!newProgram.trim()) return;
              void run(async () => {
                await createProgram(newProgram.trim());
                setNewProgram('');
              }, 'Programa creado.');
            }}
          >
            <Input
              value={newProgram}
              onChange={event => setNewProgram(event.target.value)}
              placeholder="Nombre del programa"
            />
            <Button type="submit" disabled={busy || !newProgram.trim()}>
              <Plus size={16} /> Agregar
            </Button>
          </form>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {programs.map(row => (
              <div key={row.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{row.name}</span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void run(() => updateProgram(row.id, { active: !row.active }), 'Programa actualizado.')
                  }
                >
                  {row.active ? 'Activo' : 'Inactivo'}
                </Button>
                <button
                  aria-label={`Eliminar programa ${row.name}`}
                  className="p-1 text-slate-400 hover:text-red-600"
                  onClick={() => {
                    if (!window.confirm(`¿Eliminar el programa "${row.name}"?`)) return;
                    void run(() => deleteProgram(row.id), 'Programa eliminado.');
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Indicadores</CardTitle>
          <CardDescription>Cada indicador pertenece a un programa.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="grid gap-2 md:grid-cols-[180px_1fr_160px_auto]"
            onSubmit={event => {
              event.preventDefault();
              if (!newIndicator.trim() || !newIndicatorProgram) return;
              void run(async () => {
                await createIndicator({
                  program_id: Number(newIndicatorProgram),
                  name: newIndicator.trim(),
                  kind: newIndicatorKind,
                });
                setNewIndicator('');
              }, 'Indicador creado.');
            }}
          >
            <select
              value={newIndicatorProgram}
              onChange={event => setNewIndicatorProgram(event.target.value)}
              className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
              aria-label="Programa del indicador"
            >
              {programs.map(program => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
            <Input
              value={newIndicator}
              onChange={event => setNewIndicator(event.target.value)}
              placeholder="Nombre del indicador"
            />
            <select
              value={newIndicatorKind}
              onChange={event => setNewIndicatorKind(event.target.value as Indicator['kind'])}
              className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
              aria-label="Tipo de indicador"
            >
              <option value="cobertura">Cobertura</option>
              <option value="positividad">Positividad</option>
              <option value="otro">Otro</option>
            </select>
            <Button type="submit" disabled={busy || !newIndicator.trim() || !newIndicatorProgram}>
              <Plus size={16} /> Agregar
            </Button>
          </form>
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {indicators.map(row => (
              <div key={row.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <span className="w-40 shrink-0 truncate text-xs text-slate-500">
                  {row.program_name ?? programs.find(program => program.id === row.program_id)?.name ?? '—'}
                </span>
                <span className="min-w-0 flex-1 truncate">{row.name}</span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{row.kind}</span>
                <button
                  aria-label={`Eliminar indicador ${row.name}`}
                  className="p-1 text-slate-400 hover:text-red-600"
                  onClick={() => {
                    if (!window.confirm(`¿Eliminar el indicador "${row.name}"?`)) return;
                    void run(() => deleteIndicator(row.id), 'Indicador eliminado.');
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('viewer');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      setUsers(await listUsers());
    } catch (cause) {
      setMessage({ kind: 'error', text: errorText(cause) });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ kind: 'ok', text: success });
      await refresh();
    } catch (cause) {
      setMessage({ kind: 'error', text: errorText(cause) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users size={18} /> Nuevo usuario
          </CardTitle>
          <CardDescription>Roles: admin administra todo, editor importa y edita, viewer solo consulta.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={event => {
              event.preventDefault();
              void run(async () => {
                await createUser({ email, password, full_name: fullName, role });
                setEmail('');
                setFullName('');
                setPassword('');
                setRole('viewer');
              }, 'Usuario creado.');
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="user-email">Correo</Label>
              <Input
                id="user-email"
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-name">Nombre completo</Label>
              <Input
                id="user-name"
                value={fullName}
                onChange={event => setFullName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-password">Contraseña</Label>
              <Input
                id="user-password"
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                minLength={8}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-role">Rol</Label>
              <select
                id="user-role"
                value={role}
                onChange={event => setRole(event.target.value as Role)}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={busy || !email || !password}>
                <Plus size={16} /> Crear usuario
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usuarios existentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="border-b text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Correo</th>
                  <th className="py-2 pr-3">Nombre</th>
                  <th className="py-2 pr-3">Rol</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3">{user.email}</td>
                    <td className="py-2 pr-3">{user.full_name || '—'}</td>
                    <td className="py-2 pr-3">{user.role}</td>
                    <td className="py-2 pr-3">{user.active ? 'Activo' : 'Inactivo'}</td>
                    <td className="py-2">
                      {user.active && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => {
                            if (!window.confirm(`¿Desactivar el usuario "${user.email}"?`)) return;
                            void run(() => deactivateUser(user.id), 'Usuario desactivado.');
                          }}
                        >
                          Desactivar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AuditTab() {
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const page = await listAudit();
      setRows(page.items);
      setMessage(null);
    } catch (cause) {
      setMessage(errorText(cause));
    }
  }, []);

  useEffect(() => {
    let active = true;
    listAudit()
      .then(page => {
        if (active) {
          setRows(page.items);
          setMessage(null);
        }
      })
      .catch(cause => {
        if (active) setMessage(errorText(cause));
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History size={18} /> Auditoría
        </CardTitle>
        <CardDescription>Últimos cambios realizados por usuarios autenticados.</CardDescription>
      </CardHeader>
      <CardContent>
        {message && <Notice kind="error">{message}</Notice>}
        <Button variant="outline" size="sm" onClick={() => void refresh()}>
          <RefreshCw size={14} /> Actualizar
        </Button>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-3">Fecha</th>
                <th className="py-2 pr-3">Usuario</th>
                <th className="py-2 pr-3">Acción</th>
                <th className="py-2 pr-3">Entidad</th>
                <th className="py-2">ID</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3">{formatDate(row.created_at)}</td>
                  <td className="py-2 pr-3">{row.user_id ?? '—'}</td>
                  <td className="py-2 pr-3">{row.action}</td>
                  <td className="py-2 pr-3">{row.entity}</td>
                  <td className="py-2">{row.entity_id ?? '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">
                    Sin registros de auditoría.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminWorkspace({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [tab, setTab] = useState<TabKey>('imports');
  const availableTabs =
    session.role === 'admin'
      ? TABS
      : TABS.filter(item => item.key === 'imports' || item.key === 'catalogs');

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <Shield size={20} className="text-emerald-600" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{session.email}</div>
            <div className="text-xs uppercase tracking-wide text-slate-500">{session.role}</div>
          </div>
          <Button variant="outline" size="sm" onClick={onLogout}>
            <LogOut size={14} /> Cerrar sesión
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {availableTabs.map(item => (
          <Button
            key={item.key}
            variant={tab === item.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab(item.key)}
          >
            {item.icon} {item.label}
          </Button>
        ))}
      </div>

      {tab === 'imports' && <ImportsTab />}
      {tab === 'catalogs' && <CatalogsTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'audit' && <AuditTab />}
    </div>
  );
}

export function AdminPanel() {
  const [session, setSession] = useState<Session | null>(() => getSession());
  const [checking, setChecking] = useState(() => Boolean(getSession()));

  useEffect(() => {
    if (!session) return;
    let active = true;
    getCurrentUser()
      .then(() => {
        if (active) setChecking(false);
      })
      .catch(() => {
        clearSession();
        if (active) {
          setSession(null);
          setChecking(false);
        }
      });
    return () => {
      active = false;
    };
  }, [session]);

  function handleLogout() {
    clearSession();
    setSession(null);
  }

  if (checking) {
    return <div className="py-16 text-center text-slate-500">Validando sesión…</div>;
  }

  if (!session) {
    return <LoginCard onLoggedIn={setSession} />;
  }

  return <AdminWorkspace session={session} onLogout={handleLogout} />;
}
