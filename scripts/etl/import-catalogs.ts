import path from 'node:path';

import {
  createSupabaseWriteClient,
  upsertCatalogRows,
  type CatalogTableName,
} from './supabase-client';
import { transformHeritageRows, type HeritageCatalogRow } from './transform-heritage';
import { transformMuseumRows, type MuseumCatalogRow } from './transform-museums';
import { transformScenicRows, type ScenicCatalogRow } from './transform-scenic';
import {
  createMetadata,
  findCatalogFile,
  pickText,
  readXlsxRows,
  type CatalogKind,
  type RawCatalogRow,
} from './xlsx-reader';
import {
  validateHeritageRows,
  validateMuseumRows,
  validateScenicRows,
  type ValidationIssue,
  type ValidationResult,
} from './validate';

type CliOptions = {
  kinds: CatalogKind[];
  sourceDir: string;
  dryRun: boolean;
  sourceBatch: string;
};

type ImportReport = {
  kind: CatalogKind;
  tableName: CatalogTableName;
  filePath: string | null;
  imported: number;
  skipped: number;
  warnings: ValidationIssue[];
  errors: ValidationIssue[];
  samples: unknown[];
};

type ImportConfig<T> = {
  kind: CatalogKind;
  tableName: CatalogTableName;
  identityColumns: string[];
  nameKeys: string[];
  transform: (rows: RawCatalogRow[], metadata: ReturnType<typeof createMetadata>) => T[];
  validate: (rows: T[]) => ValidationResult<T>;
};

const IMPORT_CONFIGS: {
  scenic: ImportConfig<ScenicCatalogRow>;
  heritage: ImportConfig<HeritageCatalogRow>;
  museums: ImportConfig<MuseumCatalogRow>;
} = {
  scenic: {
    kind: 'scenic',
    tableName: 'catalog_scenic_spots',
    identityColumns: ['name', 'province', 'level'],
    nameKeys: ['name', '名称', '景区名称', 'A级景区名称'],
    transform: transformScenicRows,
    validate: validateScenicRows,
  },
  heritage: {
    kind: 'heritage',
    tableName: 'catalog_heritage_sites',
    identityColumns: ['name', 'province', 'city', 'district', 'batch'],
    nameKeys: ['name', '名称', '文物名称', '保护单位名称'],
    transform: transformHeritageRows,
    validate: validateHeritageRows,
  },
  museums: {
    kind: 'museums',
    tableName: 'catalog_museums',
    identityColumns: ['name', 'province'],
    nameKeys: ['name', '名称', '博物馆名称'],
    transform: transformMuseumRows,
    validate: validateMuseumRows,
  },
};

function currentQuarterBatch(now = new Date()): string {
  const quarter = Math.floor(now.getUTCMonth() / 3) + 1;
  return `${now.getUTCFullYear()}-Q${quarter}`;
}

function parseCliArgs(argv: string[]): CliOptions {
  const hasAll = argv.includes('--all');
  const kinds: CatalogKind[] = [];
  if (hasAll || argv.includes('--scenic')) kinds.push('scenic');
  if (hasAll || argv.includes('--heritage')) kinds.push('heritage');
  if (hasAll || argv.includes('--museums')) kinds.push('museums');

  if (kinds.length === 0) {
    throw new Error('请指定 --all、--scenic、--heritage 或 --museums');
  }

  const sourceIndex = argv.indexOf('--source');
  const batchIndex = argv.indexOf('--source-batch');
  return {
    kinds,
    sourceDir:
      sourceIndex >= 0 && argv[sourceIndex + 1]
        ? path.resolve(argv[sourceIndex + 1])
        : path.resolve('docs/data'),
    dryRun: argv.includes('--dry-run'),
    sourceBatch:
      batchIndex >= 0 && argv[batchIndex + 1]
        ? argv[batchIndex + 1]
        : currentQuarterBatch(),
  };
}

function countSkippedRows(rows: RawCatalogRow[], nameKeys: string[]): number {
  return rows.filter((row) => !pickText(row, nameKeys)).length;
}

function withDefaultSort<T extends { sort: number | null }>(rows: T[]): T[] {
  return rows.map((row, index) => ({
    ...row,
    sort: row.sort ?? index + 1,
  }));
}

async function importCatalog<T extends ScenicCatalogRow | HeritageCatalogRow | MuseumCatalogRow>(
  config: ImportConfig<T>,
  options: CliOptions,
): Promise<ImportReport> {
  const filePath = findCatalogFile(options.sourceDir, config.kind);
  if (!filePath) {
    return {
      kind: config.kind,
      tableName: config.tableName,
      filePath: null,
      imported: 0,
      skipped: 0,
      warnings: [],
      errors: [
        {
          severity: 'error',
          rowIndex: -1,
          field: 'file',
          message: `未在 ${options.sourceDir} 找到 ${config.kind} xlsx 文件`,
        },
      ],
      samples: [],
    };
  }

  const rawRows = readXlsxRows(filePath);
  const skipped = countSkippedRows(rawRows, config.nameKeys);
  const transformedRows = withDefaultSort(
    config.transform(rawRows, createMetadata(options.sourceBatch)),
  );
  const validation = config.validate(transformedRows);

  let imported = validation.rows.length;
  if (!options.dryRun) {
    const supabase = createSupabaseWriteClient();
    const result = await upsertCatalogRows(
      supabase,
      config.tableName,
      validation.rows,
      config.identityColumns,
    );
    imported = result.imported;
  }

  return {
    kind: config.kind,
    tableName: config.tableName,
    filePath,
    imported,
    skipped,
    warnings: validation.warnings,
    errors: validation.errors,
    samples: validation.rows.slice(0, 5),
  };
}

function printReport(options: CliOptions, reports: ImportReport[]) {
  console.log(`ETL source: ${options.sourceDir}`);
  console.log(`source_batch: ${options.sourceBatch}`);
  console.log(`mode: ${options.dryRun ? 'dry-run' : 'write'}`);

  for (const report of reports) {
    console.log(`\n[${report.kind}] ${report.tableName}`);
    console.log(`file: ${report.filePath ?? '未找到'}`);
    console.log(`成功导入条数: ${report.imported}`);
    console.log(`跳过条数: ${report.skipped}`);
    console.log(`警告条数: ${report.warnings.length}`);
    console.log(`错误条数: ${report.errors.length}`);

    for (const issue of [...report.errors, ...report.warnings].slice(0, 10)) {
      console.log(
        `- ${issue.severity.toUpperCase()} row=${issue.rowIndex + 1} field=${issue.field}: ${issue.message}`,
      );
    }

    console.log('样本预览（前 5 条）:');
    console.log(JSON.stringify(report.samples, null, 2));
  }
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  const reports: ImportReport[] = [];

  for (const kind of options.kinds) {
    const report = await importSelectedCatalog(kind, options);
    reports.push(report);
  }

  printReport(options, reports);

  const totalErrors = reports.reduce((sum, report) => sum + report.errors.length, 0);
  if (totalErrors > 0) {
    process.exitCode = 1;
  }
}

function importSelectedCatalog(
  kind: CatalogKind,
  options: CliOptions,
): Promise<ImportReport> {
  if (kind === 'scenic') return importCatalog(IMPORT_CONFIGS.scenic, options);
  if (kind === 'heritage') return importCatalog(IMPORT_CONFIGS.heritage, options);
  return importCatalog(IMPORT_CONFIGS.museums, options);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`ETL 失败: ${message}`);
  process.exitCode = 1;
});
