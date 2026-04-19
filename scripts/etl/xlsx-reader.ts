import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from '@e965/xlsx';

export type CatalogKind = 'scenic' | 'heritage' | 'museums';

export type RawCatalogRow = Record<string, unknown>;

export type CatalogMetadata = {
  source_batch: string;
  data_version: number;
  imported_at: string;
};

const KIND_FILE_HINTS: Record<CatalogKind, string[]> = {
  scenic: ['scenic', '景区', 'a级', 'A级'],
  heritage: ['heritage', '国保', '文物', '保护单位'],
  museums: ['museum', 'museums', '博物馆'],
};

export function cleanText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\u00a0/g, ' ').trim();
  return text.length > 0 ? text : null;
}

export function pickText(row: RawCatalogRow, keys: string[]): string | null {
  for (const key of keys) {
    const value = cleanText(row[key]);
    if (value) return value;
  }
  return null;
}

export function pickNumber(row: RawCatalogRow, keys: string[]): number | null {
  const raw = pickText(row, keys);
  if (!raw) return null;
  const normalized = raw.replace(/,/g, '');
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function pickInteger(row: RawCatalogRow, keys: string[]): number | null {
  const value = pickNumber(row, keys);
  return value === null ? null : Math.trunc(value);
}

export function pickBoolean(row: RawCatalogRow, keys: string[]): boolean | null {
  const raw = pickText(row, keys);
  if (!raw) return null;
  const normalized = raw.toLowerCase();
  if (['true', 'yes', 'y', '1', '是', '免费', '免费开放'].includes(normalized)) {
    return true;
  }
  if (['false', 'no', 'n', '0', '否', '不免费', '收费'].includes(normalized)) {
    return false;
  }
  return null;
}

export function pickStringList(row: RawCatalogRow, keys: string[]): string[] | null {
  const raw = pickText(row, keys);
  if (!raw) return null;
  const values = raw
    .split(/[,，;；|、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length > 0 ? [...new Set(values)] : null;
}

export function normalizeLevel(value: string | null): string | null {
  if (!value) return null;
  const normalized = value
    .toUpperCase()
    .replace(/级/g, '')
    .replace(/Ａ/g, 'A')
    .trim();
  const match = normalized.match(/[1-5]A/);
  return match ? match[0] : normalized;
}

export function withMetadata<T extends object>(
  row: T,
  metadata: CatalogMetadata,
): T & CatalogMetadata {
  return { ...row, ...metadata };
}

export function createMetadata(sourceBatch: string, now = new Date()): CatalogMetadata {
  return {
    source_batch: sourceBatch,
    data_version: 1,
    imported_at: now.toISOString(),
  };
}

function normalizeHeader(header: unknown, index: number): string {
  const text = cleanText(header);
  return text ?? `__column_${index + 1}`;
}

export function readXlsxRows(filePath: string): RawCatalogRow[] {
  const workbook = XLSX.readFile(filePath);
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];

  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
  });

  const [headerRow, ...bodyRows] = rows;
  if (!headerRow) return [];

  const headers = headerRow.map(normalizeHeader);
  return bodyRows.map((row) =>
    headers.reduce<RawCatalogRow>((acc, header, index) => {
      acc[header] = row[index] ?? null;
      return acc;
    }, {}),
  );
}

export function findCatalogFile(sourceDir: string, kind: CatalogKind): string | null {
  if (!fs.existsSync(sourceDir)) return null;

  const files = fs
    .readdirSync(sourceDir)
    .filter((file) => /\.(xlsx|xls)$/i.test(file));
  const hints = KIND_FILE_HINTS[kind];
  const match = files.find((file) =>
    hints.some((hint) => file.toLowerCase().includes(hint.toLowerCase())),
  );

  return match ? path.join(sourceDir, match) : null;
}
