import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { CHINA_REGIONS } from '@/constants/CatalogData';
import { ALL_DISTRICTS } from '@/lib/catalog/catalogQueryFilters';
import type { LocationAddress } from '@/lib/location/locationService';

export type CatalogLocation = {
  province: string;
  city: string;
  district: string;
};

type CatalogLocationContextValue = {
  homeCatalogLocation: CatalogLocation | null;
  setHomeCatalogLocation: (next: CatalogLocation | null) => void;
};

const CatalogLocationContext = createContext<CatalogLocationContextValue | null>(null);

const PLACEHOLDER = '\u8bf7\u9009\u62e9';
const MUNICIPALITIES = new Set(['\u5317\u4eac\u5e02', '\u4e0a\u6d77\u5e02', '\u5929\u6d25\u5e02', '\u91cd\u5e86\u5e02']);

function normalizeRegionName(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, '')
    .replace(/(壮族自治区|回族自治区|维吾尔自治区|特别行政区|自治区|自治州|地区|盟|省|市)$/g, '');
}

function matchRegionName(raw: string | null | undefined, options: string[]): string | null {
  if (!raw) return null;
  const normalizedRaw = normalizeRegionName(raw);
  return options.find((item) => normalizeRegionName(item) === normalizedRaw) ?? null;
}

export function normalizeCatalogLocation(address: LocationAddress): CatalogLocation | null {
  const province = matchRegionName(
    address.province,
    CHINA_REGIONS.map((item) => item.name),
  );
  if (!province) return null;

  const provinceData = CHINA_REGIONS.find((item) => item.name === province);
  if (!provinceData) return null;

  const rawCity = address.city || (MUNICIPALITIES.has(province) ? province : null);
  const city = matchRegionName(
    rawCity,
    provinceData.cities.map((item) => item.name),
  );

  if (!city) {
    return {
      province,
      city: PLACEHOLDER,
      district: PLACEHOLDER,
    };
  }

  const cityData = provinceData.cities.find((item) => item.name === city);
  const district = matchRegionName(address.district, cityData?.districts ?? []);

  return {
    province,
    city,
    district: district ?? ALL_DISTRICTS,
  };
}

export function CatalogLocationProvider({ children }: PropsWithChildren) {
  const [homeCatalogLocation, setHomeCatalogLocation] = useState<CatalogLocation | null>(null);

  const value = useMemo(
    () => ({
      homeCatalogLocation,
      setHomeCatalogLocation,
    }),
    [homeCatalogLocation],
  );

  return <CatalogLocationContext.Provider value={value}>{children}</CatalogLocationContext.Provider>;
}

export function useCatalogLocation(): CatalogLocationContextValue {
  const ctx = useContext(CatalogLocationContext);
  if (!ctx) {
    throw new Error('useCatalogLocation must be used within CatalogLocationProvider');
  }
  return ctx;
}

