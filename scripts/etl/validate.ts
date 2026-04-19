import type { HeritageCatalogRow } from './transform-heritage';
import type { MuseumCatalogRow } from './transform-museums';
import type { ScenicCatalogRow } from './transform-scenic';

export type ValidationSeverity = 'warning' | 'error';

export type ValidationIssue = {
  severity: ValidationSeverity;
  rowIndex: number;
  field: string;
  message: string;
};

export type ValidationResult<T> = {
  rows: T[];
  warnings: ValidationIssue[];
  errors: ValidationIssue[];
};

const SCENIC_LEVELS = new Set(['1A', '2A', '3A', '4A', '5A']);

function isValidLng(value: number | null): boolean {
  return value === null || (value >= -180 && value <= 180);
}

function isValidLat(value: number | null): boolean {
  return value === null || (value >= -90 && value <= 90);
}

function coordinateWarnings(
  rowIndex: number,
  row: { lng: number | null; lat: number | null },
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isValidLng(row.lng)) {
    issues.push({
      severity: 'warning',
      rowIndex,
      field: 'lng',
      message: '经度超出 [-180, 180]，写入前将置为 NULL',
    });
  }
  if (!isValidLat(row.lat)) {
    issues.push({
      severity: 'warning',
      rowIndex,
      field: 'lat',
      message: '纬度超出 [-90, 90]，写入前将置为 NULL',
    });
  }
  return issues;
}

function sanitizeCoordinates<T extends { lng: number | null; lat: number | null }>(
  row: T,
): T {
  return {
    ...row,
    lng: isValidLng(row.lng) ? row.lng : null,
    lat: isValidLat(row.lat) ? row.lat : null,
  };
}

function splitIssues(issues: ValidationIssue[]) {
  return {
    warnings: issues.filter((issue) => issue.severity === 'warning'),
    errors: issues.filter((issue) => issue.severity === 'error'),
  };
}

export function validateScenicRows(
  rows: ScenicCatalogRow[],
): ValidationResult<ScenicCatalogRow> {
  const issues = rows.flatMap((row, rowIndex) => {
    const rowIssues = coordinateWarnings(rowIndex, row);
    if (row.level && !SCENIC_LEVELS.has(row.level)) {
      rowIssues.push({
        severity: 'warning',
        rowIndex,
        field: 'level',
        message: `景区等级 "${row.level}" 不在 1A-5A 枚举内`,
      });
    }
    return rowIssues;
  });

  return {
    rows: rows.map(sanitizeCoordinates),
    ...splitIssues(issues),
  };
}

export function validateHeritageRows(
  rows: HeritageCatalogRow[],
): ValidationResult<HeritageCatalogRow> {
  const issues = rows.flatMap((row, rowIndex) => {
    const rowIssues = coordinateWarnings(rowIndex, row);
    if (!Array.isArray(row.dynasty_tag)) {
      rowIssues.push({
        severity: 'error',
        rowIndex,
        field: 'dynasty_tag',
        message: '朝代标签必须为数组',
      });
    }
    if (!Array.isArray(row.category_tag)) {
      rowIssues.push({
        severity: 'error',
        rowIndex,
        field: 'category_tag',
        message: '类型标签必须为数组',
      });
    }
    return rowIssues;
  });
  const { warnings, errors } = splitIssues(issues);
  const errorRows = new Set(errors.map((issue) => issue.rowIndex));

  return {
    rows: rows
      .filter((_, rowIndex) => !errorRows.has(rowIndex))
      .map(sanitizeCoordinates),
    warnings,
    errors,
  };
}

export function validateMuseumRows(
  rows: MuseumCatalogRow[],
): ValidationResult<MuseumCatalogRow> {
  const issues = rows.flatMap((row, rowIndex) => {
    const rowIssues = coordinateWarnings(rowIndex, row);
    if (!row.province) {
      rowIssues.push({
        severity: 'warning',
        rowIndex,
        field: 'province',
        message: '博物馆省份为空',
      });
    }
    if (row.free_admission !== null && typeof row.free_admission !== 'boolean') {
      rowIssues.push({
        severity: 'error',
        rowIndex,
        field: 'free_admission',
        message: '免费开放字段必须为 boolean',
      });
    }
    return rowIssues;
  });
  const { warnings, errors } = splitIssues(issues);
  const errorRows = new Set(errors.map((issue) => issue.rowIndex));

  return {
    rows: rows
      .filter((_, rowIndex) => !errorRows.has(rowIndex))
      .map(sanitizeCoordinates),
    warnings,
    errors,
  };
}
