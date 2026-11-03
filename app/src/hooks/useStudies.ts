import { useCallback, useState } from 'react';
import * as XLSX from 'xlsx';

const STORAGE_KEY = 'sogamoso-salud-estudios';
const MAX_PREVIEW_ROWS = 100;

export interface StudySheet {
  name: string;
  columns: string[];
  rows: Record<string, string>[];
  analysisRows?: Record<string, string>[];
  totalRows: number;
}

export interface Study {
  id: string;
  name: string;
  uploadedAt: string;
  sheets: StudySheet[];
}

function readStudies(): Study[] {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return [];

  try {
    const studies: unknown = JSON.parse(saved);
    if (!Array.isArray(studies)) throw new Error('El almacenamiento de estudios no tiene un formato válido.');
    return studies as Study[];
  } catch (error) {
    throw new Error(
      `No fue posible leer los estudios guardados: ${error instanceof Error ? error.message : 'formato desconocido'}`,
    );
  }
}

function saveStudies(studies: Study[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(studies));
  } catch (error) {
    throw new Error(
      `No fue posible guardar el estudio. El navegador puede no tener espacio disponible: ${
        error instanceof Error ? error.message : 'error desconocido'
      }`,
    );
  }
}

function valueToString(value: unknown): string {
  if (value instanceof Date) return value.toLocaleDateString('es-CO');
  if (value === null || value === undefined) return '';
  return String(value);
}

export async function parseStudy(file: File): Promise<Study> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw new Error('El archivo debe tener extensión .xlsx.');
  }

  const workbook = XLSX.read(await file.arrayBuffer(), { cellDates: true });
  if (workbook.SheetNames.length === 0) {
    throw new Error('El archivo no contiene hojas de cálculo.');
  }

  const sheets = workbook.SheetNames.map((name) => {
    const worksheet = workbook.Sheets[name];
    if (!worksheet) throw new Error(`No fue posible leer la hoja "${name}".`);

    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: '',
      raw: false,
    });
    const analysisRows = rawRows.map((row) =>
      Object.fromEntries(Object.entries(row).map(([key, value]) => [key, valueToString(value)])),
    );
    const rows = analysisRows.slice(0, MAX_PREVIEW_ROWS);
    const columns = [...new Set(rawRows.flatMap((row) => Object.keys(row)))];

    return { name, columns, rows, analysisRows, totalRows: rawRows.length };
  });

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: file.name,
    uploadedAt: new Date().toISOString(),
    sheets,
  };
}

export function useStudies() {
  const [studies, setStudies] = useState<Study[]>(() => readStudies());

  const addStudy = useCallback((study: Study) => {
    setStudies((current) => {
      const next = [study, ...current];
      saveStudies(next);
      return next;
    });
  }, []);

  const removeStudy = useCallback((id: string) => {
    setStudies((current) => {
      const next = current.filter((study) => study.id !== id);
      saveStudies(next);
      return next;
    });
  }, []);

  return { studies, addStudy, removeStudy };
}
