import {
  pickInteger,
  pickNumber,
  pickStringList,
  pickText,
  normalizeLevel,
  withMetadata,
  type CatalogMetadata,
  type RawCatalogRow,
} from './xlsx-reader';

export type ScenicCatalogRow = {
  id?: string;
  name: string;
  level: string | null;
  province: string | null;
  address_code: string | null;
  lng: number | null;
  lat: number | null;
  recommend: string | null;
  sort: number | null;
  images: string[] | null;
  source_batch: string;
  data_version: number;
  imported_at: string;
};

export function transformScenicRows(
  rows: RawCatalogRow[],
  metadata: CatalogMetadata,
): ScenicCatalogRow[] {
  return rows
    .map((row) => {
      const name = pickText(row, ['name', '名称', '景区名称', 'A级景区名称']);
      if (!name) return null;

      return withMetadata(
        {
          name,
          level: normalizeLevel(pickText(row, ['level', '等级', '景区等级', 'A级等级'])),
          province: pickText(row, ['province', '省份', '省', '省级']),
          address_code: pickText(row, ['address_code', '行政区划代码', '地址编码', '编码']),
          lng: pickNumber(row, ['lng', 'longitude', 'lng_wgs84', '经度', 'wgs84经度']),
          lat: pickNumber(row, ['lat', 'latitude', 'lat_wgs84', '纬度', 'wgs84纬度']),
          recommend: pickText(row, ['recommend', '推荐', '推荐语']),
          sort: pickInteger(row, ['sort', '排序', '排序权重']),
          images: pickStringList(row, ['images', '图片', '配图', '图片列表']),
        },
        metadata,
      );
    })
    .filter((row): row is ScenicCatalogRow => row !== null);
}
