import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { HeritageCatalogRow } from './transform-heritage';
import type { MuseumCatalogRow } from './transform-museums';
import type { ScenicCatalogRow } from './transform-scenic';

export type CatalogTableName =
  | 'catalog_scenic_spots'
  | 'catalog_heritage_sites'
  | 'catalog_museums';

type CatalogRow = ScenicCatalogRow | HeritageCatalogRow | MuseumCatalogRow;

type ExistingRow = {
  id: string;
  data_version: number | null;
} & Record<string, unknown>;

export type UpsertResult = {
  tableName: CatalogTableName;
  imported: number;
};

const CHUNK_SIZE = 500;

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function requireEnv(name: string): string {
  if (name === 'SUPABASE_URL') {
    if (!SUPABASE_URL) throw new Error(`缺少环境变量 ${name}`);
    return SUPABASE_URL;
  }
  if (name === 'SUPABASE_SERVICE_ROLE_KEY') {
    if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error(`缺少环境变量 ${name}`);
    return SUPABASE_SERVICE_ROLE_KEY;
  }
  throw new Error(`未知环境变量 ${name}`);
}

export function createSupabaseWriteClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

function makeIdentityKey(row: Record<string, unknown>, columns: string[]): string {
  return columns.map((column) => String(row[column] ?? '')).join('\u001f');
}

function isExistingRow(row: unknown): row is ExistingRow {
  if (!row || typeof row !== 'object') return false;
  const record = row as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    (record.data_version === null || typeof record.data_version === 'number')
  );
}

async function fetchExistingRows(
  supabase: SupabaseClient,
  tableName: CatalogTableName,
  rows: CatalogRow[],
  identityColumns: string[],
): Promise<Map<string, ExistingRow>> {
  const names = [...new Set(rows.map((row) => row.name))];
  const found = new Map<string, ExistingRow>();

  for (const namesChunk of chunkRows(names, CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from(tableName)
      .select(['id', 'data_version', ...identityColumns].join(','))
      .in('name', namesChunk);

    if (error) throw error;

    for (const row of data ?? []) {
      if (!isExistingRow(row)) {
        throw new Error(`Unexpected existing row shape from ${tableName}`);
      }
      found.set(makeIdentityKey(row, identityColumns), row);
    }
  }

  return found;
}

function withIncrementedVersion<T extends CatalogRow>(
  rows: T[],
  existingRows: Map<string, ExistingRow>,
  identityColumns: string[],
): T[] {
  return rows.map((row) => {
    const existing = existingRows.get(makeIdentityKey(row, identityColumns));
    if (!existing) return row;
    return {
      ...row,
      id: existing.id,
      data_version: (existing.data_version ?? 0) + 1,
    };
  });
}

export async function upsertCatalogRows<T extends CatalogRow>(
  supabase: SupabaseClient,
  tableName: CatalogTableName,
  rows: T[],
  identityColumns: string[],
): Promise<UpsertResult> {
  if (rows.length === 0) {
    return { tableName, imported: 0 };
  }

  const existingRows = await fetchExistingRows(
    supabase,
    tableName,
    rows,
    identityColumns,
  );
  const versionedRows = withIncrementedVersion(rows, existingRows, identityColumns);

  let imported = 0;
  for (const rowsChunk of chunkRows(versionedRows, CHUNK_SIZE)) {
    const { error } = await supabase
      .from(tableName)
      .upsert(rowsChunk, { onConflict: 'id' });
    if (error) throw error;
    imported += rowsChunk.length;
  }

  return { tableName, imported };
}
