import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCATION_DIAGNOSTICS_KEY = 'location_diagnostics_v1';
const MAX_LOCATION_DIAGNOSTICS = 200;

export type LocationDiagnosticLevel = 'info' | 'warn' | 'error';

export interface LocationDiagnosticEntry {
  id: string;
  timestamp: string;
  event: string;
  level: LocationDiagnosticLevel;
  detail: Record<string, unknown>;
}

function sanitizeLocationDetail(
  value: unknown,
  seen = new WeakSet<object>(),
): unknown {
  if (
    value == null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack ?? null,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLocationDetail(item, seen));
  }

  if (typeof value === 'object') {
    if (seen.has(value)) return '[circular]';
    seen.add(value);

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sanitizeLocationDetail(item, seen),
      ]),
    );
  }

  return String(value);
}

async function readLocationDiagnostics(): Promise<LocationDiagnosticEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCATION_DIAGNOSTICS_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as LocationDiagnosticEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function appendLocationDiagnostic(
  level: LocationDiagnosticLevel,
  event: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  try {
    const current = await readLocationDiagnostics();
    const next: LocationDiagnosticEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      event,
      level,
      detail: sanitizeLocationDetail(detail) as Record<string, unknown>,
    };

    current.push(next);
    const trimmed =
      current.length > MAX_LOCATION_DIAGNOSTICS
        ? current.slice(current.length - MAX_LOCATION_DIAGNOSTICS)
        : current;

    await AsyncStorage.setItem(
      LOCATION_DIAGNOSTICS_KEY,
      JSON.stringify(trimmed),
    );
  } catch {
    // 日志记录不能反过来影响定位主流程
  }
}

export async function getLocationDiagnostics(): Promise<LocationDiagnosticEntry[]> {
  return readLocationDiagnostics();
}

export async function clearLocationDiagnostics(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LOCATION_DIAGNOSTICS_KEY);
  } catch {
    // ignore
  }
}
