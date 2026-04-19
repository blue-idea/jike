import {
  pickInteger,
  pickNumber,
  pickStringList,
  pickText,
  withMetadata,
  type CatalogMetadata,
  type RawCatalogRow,
} from './xlsx-reader';

export type HeritageCatalogRow = {
  id?: string;
  name: string;
  category_code: string | null;
  address: string | null;
  heritage_type: string | null;
  era: string | null;
  batch: string | null;
  remark: string | null;
  province: string | null;
  city: string | null;
  district: string | null;
  lng: number | null;
  lat: number | null;
  search_name: string;
  dynasty_tag: string[];
  category_tag: string[];
  recommend: string | null;
  sort: number | null;
  images: string[] | null;
  source_batch: string;
  data_version: number;
  imported_at: string;
};

const DYNASTY_KEYWORDS = [
  '夏',
  '商',
  '周',
  '秦',
  '汉',
  '魏',
  '晋',
  '南北朝',
  '隋',
  '唐',
  '五代',
  '宋',
  '辽',
  '金',
  '元',
  '明',
  '清',
  '民国',
];

const CATEGORY_KEYWORDS = [
  '古遗址',
  '古墓葬',
  '古建筑',
  '石窟寺',
  '石刻',
  '近现代重要史迹',
  '代表性建筑',
  '陵墓',
  '寺庙',
  '碑刻',
  '古战场',
];

function inferTags(source: string | null, keywords: string[]): string[] {
  if (!source) return [];
  return keywords.filter((keyword) => source.includes(keyword));
}

function mergeTags(...tagGroups: (string[] | null)[]): string[] {
  return [...new Set(tagGroups.flatMap((tags) => tags ?? []))];
}

function buildSearchName(parts: (string | null)[]): string {
  return parts.filter(Boolean).join('');
}

export function transformHeritageRows(
  rows: RawCatalogRow[],
  metadata: CatalogMetadata,
): HeritageCatalogRow[] {
  return rows
    .map((row) => {
      const name = pickText(row, ['name', '名称', '文物名称', '保护单位名称']);
      if (!name) return null;

      const province = pickText(row, ['province', '省份', '省']);
      const city = pickText(row, ['city', '城市', '市']);
      const district = pickText(row, ['district', '区县', '区', '县']);
      const era = pickText(row, ['era', '时代', '年代']);
      const heritageType = pickText(row, ['heritage_type', '类型', '文物类型', '类别']);
      const categoryCode = pickText(row, ['category_code', '分类号', '类别编号']);
      const dynastyTags = mergeTags(
        pickStringList(row, ['dynasty_tag', '朝代标签']),
        inferTags(era, DYNASTY_KEYWORDS),
      );
      const categoryTags = mergeTags(
        pickStringList(row, ['category_tag', '类型标签', '类别标签']),
        inferTags([heritageType, categoryCode].filter(Boolean).join(' '), CATEGORY_KEYWORDS),
      );

      return withMetadata(
        {
          name,
          category_code: categoryCode,
          address: pickText(row, ['address', '地址', '所在地']),
          heritage_type: heritageType,
          era,
          batch: pickText(row, ['batch', '批次', '公布批次']),
          remark: pickText(row, ['remark', '备注']),
          province,
          city,
          district,
          lng: pickNumber(row, ['lng', 'longitude', 'lng_wgs84', '经度', 'wgs84经度']),
          lat: pickNumber(row, ['lat', 'latitude', 'lat_wgs84', '纬度', 'wgs84纬度']),
          search_name: buildSearchName([province, city, district, name]),
          dynasty_tag: dynastyTags,
          category_tag: categoryTags,
          recommend: pickText(row, ['recommend', '推荐', '推荐语']),
          sort: pickInteger(row, ['sort', '排序', '排序权重']),
          images: pickStringList(row, ['images', '图片', '配图', '图片列表']),
        },
        metadata,
      );
    })
    .filter((row): row is HeritageCatalogRow => row !== null);
}
