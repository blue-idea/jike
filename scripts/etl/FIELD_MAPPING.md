# 三类名录 ETL 字段映射

## 输入文件发现

默认从 `docs/data` 查找 `.xlsx` / `.xls`：

| 类型 | 文件名关键字 |
| --- | --- |
| 景区 | `scenic`、`景区`、`A级`、`a级` |
| 国保 | `heritage`、`国保`、`文物`、`保护单位` |
| 博物馆 | `museum`、`museums`、`博物馆` |

可用 `--source ./docs/data` 指定目录。

## 通用规则

| 目标字段 | 规则 |
| --- | --- |
| `lng` / `lat` | 优先读取 `lng` / `lat`，兼容 `longitude` / `latitude`、`lng_wgs84` / `lat_wgs84`、`经度` / `纬度`，统一视为 WGS84。超范围写入前置为 `NULL` 并输出 warning。 |
| `images` | 读取 `images`、`图片`、`配图`、`图片列表`，用 `,`、`，`、`;`、`；`、`|`、`、`、换行拆分为数组。 |
| `source_batch` | CLI `--source-batch` 指定；未指定时按 UTC 年份季度生成，如 `2026-Q2`。 |
| `data_version` | 新行默认为 `1`；写入前按业务识别键查询旧行，命中则复用 `id` 并递增旧 `data_version`。 |
| `imported_at` | `new Date().toISOString()`，UTC。 |
| `sort` | 源表有排序字段则沿用；为空时按导入顺序从 `1` 补齐，作为默认排序权重。 |

## `catalog_scenic_spots`

| 目标列 | 源表头候选 |
| --- | --- |
| `name` | `name`、`名称`、`景区名称`、`A级景区名称` |
| `level` | `level`、`等级`、`景区等级`、`A级等级`，规范化为 `1A`-`5A` |
| `province` | `province`、`省份`、`省`、`省级` |
| `address_code` | `address_code`、`行政区划代码`、`地址编码`、`编码` |
| `recommend` | `recommend`、`推荐`、`推荐语` |
| `sort` | `sort`、`排序`、`排序权重` |

写入识别键：`name + province + level`。

## `catalog_heritage_sites`

| 目标列 | 源表头候选 / 生成规则 |
| --- | --- |
| `name` | `name`、`名称`、`文物名称`、`保护单位名称` |
| `category_code` | `category_code`、`分类号`、`类别编号` |
| `address` | `address`、`地址`、`所在地` |
| `heritage_type` | `heritage_type`、`类型`、`文物类型`、`类别` |
| `era` | `era`、`时代`、`年代` |
| `batch` | `batch`、`批次`、`公布批次` |
| `remark` | `remark`、`备注` |
| `province` / `city` / `district` | `province` / `city` / `district`，兼容 `省份`、`城市`、`区县` 等中文表头 |
| `search_name` | `province + city + district + name` |
| `dynasty_tag` | 优先读取 `dynasty_tag`、`朝代标签`；同时从 `era` 识别常见朝代关键词。 |
| `category_tag` | 优先读取 `category_tag`、`类型标签`、`类别标签`；同时从 `heritage_type`、`category_code` 识别常见类型关键词。 |
| `recommend` | `recommend`、`推荐`、`推荐语` |
| `sort` | `sort`、`排序`、`排序权重` |

写入识别键：`name + province + city + district + batch`。

## `catalog_museums`

| 目标列 | 源表头候选 |
| --- | --- |
| `province` | `province`、`省份`、`省` |
| `name` | `name`、`名称`、`博物馆名称` |
| `quality_level` | `quality_level`、`质量等级`、`等级` |
| `museum_nature` | `museum_nature`、`性质`、`博物馆性质`、`类型` |
| `free_admission` | `free_admission`、`免费开放`、`是否免费`、`免费`，解析 `是/否`、`免费/收费`、`true/false`、`1/0`。 |
| `recommend` | `recommend`、`推荐`、`推荐语` |
| `sort` | `sort`、`排序`、`排序权重` |

写入识别键：`name + province`。博物馆坐标可为空；源数据无坐标时写入 `NULL`。
