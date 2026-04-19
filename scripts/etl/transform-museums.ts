import {
  pickBoolean,
  pickInteger,
  pickNumber,
  pickStringList,
  pickText,
  withMetadata,
  type CatalogMetadata,
  type RawCatalogRow,
} from './xlsx-reader';

export type MuseumCatalogRow = {
  id?: string;
  province: string | null;
  name: string;
  quality_level: string | null;
  museum_nature: string | null;
  free_admission: boolean | null;
  lng: number | null;
  lat: number | null;
  recommend: string | null;
  sort: number | null;
  images: string[] | null;
  source_batch: string;
  data_version: number;
  imported_at: string;
};

export function transformMuseumRows(
  rows: RawCatalogRow[],
  metadata: CatalogMetadata,
): MuseumCatalogRow[] {
  return rows
    .map((row) => {
      const name = pickText(row, ['name', '名称', '博物馆名称']);
      if (!name) return null;

      return withMetadata(
        {
          province: pickText(row, ['province', '省份', '省']),
          name,
          quality_level: pickText(row, ['quality_level', '质量等级', '等级']),
          museum_nature: pickText(row, ['museum_nature', '性质', '博物馆性质', '类型']),
          free_admission: pickBoolean(row, ['free_admission', '免费开放', '是否免费', '免费']),
          lng: pickNumber(row, ['lng', 'longitude', 'lng_wgs84', '经度', 'wgs84经度']),
          lat: pickNumber(row, ['lat', 'latitude', 'lat_wgs84', '纬度', 'wgs84纬度']),
          recommend: pickText(row, ['recommend', '推荐', '推荐语']),
          sort: pickInteger(row, ['sort', '排序', '排序权重']),
          images: pickStringList(row, ['images', '图片', '配图', '图片列表']),
        },
        metadata,
      );
    })
    .filter((row): row is MuseumCatalogRow => row !== null);
}
