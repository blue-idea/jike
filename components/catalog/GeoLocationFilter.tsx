import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ChevronDown,
  LocateFixed,
  MapPinned,
  RefreshCw,
} from 'lucide-react-native';
import { CHINA_REGIONS } from '@/constants/CatalogData';
import { Colors } from '@/constants/Colors';
import {
  ALL_DISTRICTS,
  type HeritageQueryFormState,
  type MuseumQueryFormState,
  type ScenicLocationFormState,
} from '@/lib/catalog/catalogQueryFilters';
import {
  getCurrentLocationWithPermission,
  reverseGeocodeLocation,
  type LocationAddress,
  type LocationStatus,
} from '@/lib/location/locationService';

type PickerType = 'province' | 'city' | 'district' | 'level';

type LocationValue = {
  province: string;
  city: string;
  district: string;
  level: string;
};

type GeoLocationFilterProps = {
  primaryColor: string;
  defaultLocation?: LocationValue;
  showLevelFilter?: boolean;
  showDistrictFilter?: boolean;
  /** 根据当前筛选表单执行查询（发现页 A 级景区等） */
  onApplyQuery?: (filters: ScenicLocationFormState) => void;
  queryButtonLabel?: string;
};

const DEFAULT_LOCATION: LocationValue = {
  province: '陕西省',
  city: '西安市',
  district: ALL_DISTRICTS,
  level: '全部等级',
};

const SCENIC_LEVELS = ['全部等级', '5A', '4A', '3A', '2A', '1A'];
const PLACEHOLDER = '请选择';
const MUNICIPALITIES = new Set(['北京市', '上海市', '天津市', '重庆市']);

type AutoLocateResult =
  | { ok: true; location: LocationValue }
  | { ok: false; message: string; fallbackLocation: LocationValue };

function normalizeRegionName(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, '')
    .replace(/(壮族自治区|回族自治区|维吾尔自治区|特别行政区|自治区|自治州|地区|盟|省|市)$/g, '');
}

function matchRegionName(
  raw: string | null | undefined,
  options: string[],
): string | null {
  if (!raw) return null;
  const normalizedRaw = normalizeRegionName(raw);
  return options.find((item) => normalizeRegionName(item) === normalizedRaw) ?? null;
}

function fallbackLocation(level: string): LocationValue {
  return {
    province: PLACEHOLDER,
    city: PLACEHOLDER,
    district: ALL_DISTRICTS,
    level,
  };
}

function mapPermissionError(status: LocationStatus): string {
  if (status === 'denied') return '定位权限被拒绝，请在系统设置中允许定位后重试。';
  if (status === 'blocked') return '定位权限不可用，请检查系统权限设置。';
  if (status === 'unavailable') return '当前环境不支持定位，请手动筛选省市区。';
  return '定位失败，请稍后重试。';
}

function normalizeAddressToLocation(
  address: LocationAddress,
  level: string,
): LocationValue | null {
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
      district: ALL_DISTRICTS,
      level,
    };
  }

  const cityData = provinceData.cities.find((item) => item.name === city);
  const district = matchRegionName(address.district, cityData?.districts ?? []);
  return {
    province,
    city,
    district: district ?? ALL_DISTRICTS,
    level,
  };
}

async function resolveAutoLocation(level: string): Promise<AutoLocateResult> {
  const location = await getCurrentLocationWithPermission();
  if (!location.coords) {
    return {
      ok: false,
      message:
        location.status === 'denied' || location.status === 'blocked'
          ? mapPermissionError(location.status)
          : location.error || '无法获取当前位置',
      fallbackLocation: fallbackLocation(level),
    };
  }

  const address = await reverseGeocodeLocation(location.coords);
  if (!address) {
    return {
      ok: false,
      message: '已获取坐标，但无法解析省市区，请手动筛选。',
      fallbackLocation: fallbackLocation(level),
    };
  }

  const normalized = normalizeAddressToLocation(address, level);
  if (!normalized) {
    return {
      ok: false,
      message: '定位成功，但地址与行政区数据未匹配，请手动筛选。',
      fallbackLocation: fallbackLocation(level),
    };
  }

  return {
    ok: true,
    location: normalized,
  };
}

export function GeoLocationFilter({
  primaryColor,
  defaultLocation = DEFAULT_LOCATION,
  showLevelFilter = true,
  showDistrictFilter = true,
  onApplyQuery,
  queryButtonLabel = '查询',
}: GeoLocationFilterProps) {
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [useAutoLocation, setUseAutoLocation] = useState(false);
  const [location, setLocation] = useState<LocationValue>(defaultLocation);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerType, setPickerType] = useState<PickerType>('province');

  const handleRelocate = useCallback(async () => {
    setIsLocating(true);
    setUseAutoLocation(true);
    setLocationError(null);
    try {
      const result = await resolveAutoLocation(location.level);
      if (result.ok) {
        setLocation(result.location);
        return;
      }
      setUseAutoLocation(false);
      setLocation(result.fallbackLocation);
      setLocationError(result.message);
    } finally {
      setIsLocating(false);
    }
  }, [location.level]);

  const openPicker = (type: PickerType) => {
    setPickerType(type);
    setPickerVisible(true);
    setUseAutoLocation(false);
    setLocationError(null);
  };

  const selectValue = (value: string) => {
    if (pickerType === 'province') {
      setLocation({
        province: value,
        city: PLACEHOLDER,
        district: ALL_DISTRICTS,
        level: location.level,
      });
    } else if (pickerType === 'city') {
      setLocation((prev) => ({ ...prev, city: value, district: ALL_DISTRICTS }));
    } else if (pickerType === 'district') {
      setLocation((prev) => ({ ...prev, district: value }));
    } else if (pickerType === 'level') {
      setLocation((prev) => ({ ...prev, level: value }));
    }
    setLocationError(null);
    setPickerVisible(false);
  };

  const pickerData = useMemo(() => {
    if (pickerType === 'province') return CHINA_REGIONS.map((p) => p.name);
    if (pickerType === 'city') {
      const province = CHINA_REGIONS.find((v) => v.name === location.province);
      return province ? province.cities.map((c) => c.name) : [];
    }
    if (pickerType === 'district') {
      const province = CHINA_REGIONS.find((v) => v.name === location.province);
      const city = province?.cities.find((v) => v.name === location.city);
      const list = city?.districts ?? [];
      return [ALL_DISTRICTS, ...list];
    }
    return SCENIC_LEVELS;
  }, [location.city, location.province, pickerType]);

  const pickerTitle = {
    province: '选择省份',
    city: '选择城市',
    district: '选择区县',
    level: '选择A级等级',
  }[pickerType];

  return (
    <>
      <View style={styles.locationFilterPanel}>
        <View style={styles.locationHeaderRow}>
          <View style={styles.locationTitleGroup}>
            <MapPinned size={18} color={primaryColor} />
            <Text style={[styles.locationMainTitle, { color: primaryColor }]}>
              地理位置筛选
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.autoLocateBtn,
              useAutoLocation && { backgroundColor: primaryColor },
            ]}
            onPress={handleRelocate}
            disabled={isLocating}
          >
            {isLocating ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <LocateFixed
                size={14}
                color={useAutoLocation ? Colors.white : primaryColor}
              />
            )}
            <Text
              style={[
                styles.autoLocateText,
                { color: primaryColor },
                useAutoLocation && styles.autoLocateTextActive,
              ]}
            >
              {isLocating ? '定位中...' : '当前定位'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.locationCurrentDisplay}>
          <Text style={styles.locationDisplayText}>
            {useAutoLocation ? '📍 当前位置' : '🔍 手动筛选'}:{' '}
            <Text style={[styles.locationEmphasis, { color: primaryColor }]}>
              {location.province} · {location.city} · {location.district}
            </Text>
          </Text>
          {useAutoLocation && (
            <TouchableOpacity
              onPress={handleRelocate}
              style={styles.refreshIconWrap}
            >
              <RefreshCw size={12} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        {locationError ? (
          <Text style={styles.locationErrorText}>{locationError}</Text>
        ) : null}

        <View style={styles.manualFilterGrid}>
          <TouchableOpacity
            style={styles.pickerTrigger}
            onPress={() => openPicker('province')}
          >
            <Text style={styles.pickerLabel}>省份</Text>
            <View style={styles.pickerValueRow}>
              <Text style={styles.pickerValue} numberOfLines={1}>
                {location.province}
              </Text>
              <ChevronDown size={14} color={Colors.textMuted} />
            </View>
          </TouchableOpacity>


          <TouchableOpacity
            style={styles.pickerTrigger}
            onPress={() => openPicker('city')}
            disabled={location.province === PLACEHOLDER}
          >
            <Text style={styles.pickerLabel}>城市</Text>
            <View style={styles.pickerValueRow}>
              <Text style={styles.pickerValue} numberOfLines={1}>
                {location.city}
              </Text>
              <ChevronDown size={14} color={Colors.textMuted} />
            </View>
          </TouchableOpacity>

          {showDistrictFilter ? (
            <TouchableOpacity
              style={styles.pickerTrigger}
              onPress={() => openPicker('district')}
              disabled={location.city === PLACEHOLDER}
            >
              <Text style={styles.pickerLabel}>区县</Text>
              <View style={styles.pickerValueRow}>
                <Text style={styles.pickerValue} numberOfLines={1}>
                  {location.district}
                </Text>
                <ChevronDown size={14} color={Colors.textMuted} />
              </View>
            </TouchableOpacity>
          ) : null}
        </View>


        {showLevelFilter && (
          <View style={styles.levelFilterRow}>
            <Text style={styles.levelFilterLabel}>A级等级</Text>
            <TouchableOpacity
              style={styles.levelFilterTrigger}
              onPress={() => openPicker('level')}
            >
              <Text style={[styles.levelFilterValue, { color: primaryColor }]}>
                {location.level}
              </Text>
              <ChevronDown size={14} color={primaryColor} />
            </TouchableOpacity>
          </View>
        )}

        {onApplyQuery ? (
          <TouchableOpacity
            style={[filterActionStyles.queryBtn, { backgroundColor: primaryColor }]}
            activeOpacity={0.92}
            onPress={() =>
              onApplyQuery({
                province: location.province,
                city: location.city,
                district: location.district,
                level: location.level,
                useAutoLocation,
              })
            }
          >
            <Text style={filterActionStyles.queryBtnText}>{queryButtonLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Modal
        visible={pickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalDismiss}
            onPress={() => setPickerVisible(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: primaryColor }]}>
                {pickerTitle}
              </Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Text style={styles.modalCloseText}>取消</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={pickerData}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => selectValue(item)}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      (item === location.province ||
                        item === location.city ||
                        item === location.district ||
                        item === location.level) && {
                        color: primaryColor,
                        fontWeight: '800',
                      },
                    ]}
                  >
                    {item}
                  </Text>
                  {(item === location.province ||
                    item === location.city ||
                    item === location.district ||
                    item === location.level) && (
                    <View
                      style={[
                        styles.activeDot,
                        { backgroundColor: primaryColor },
                      ]}
                    />
                  )}
                </TouchableOpacity>
              )}
              style={styles.pickerList}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  locationFilterPanel: {
    backgroundColor: '#F7F3E9',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(14,71,83,0.1)',
    marginBottom: 20,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  locationTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationMainTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  autoLocateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E6E2D8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  autoLocateText: {
    fontSize: 12,
    fontWeight: '700',
  },
  autoLocateTextActive: {
    color: Colors.white,
  },
  locationCurrentDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    marginBottom: 16,
    justifyContent: 'space-between',
  },
  locationDisplayText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  locationEmphasis: {
    fontWeight: '800',
  },
  locationErrorText: {
    marginTop: -8,
    marginBottom: 12,
    fontSize: 12,
    color: '#B94A48',
    lineHeight: 18,
  },
  refreshIconWrap: {
    padding: 4,
  },
  manualFilterGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  pickerTrigger: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  pickerLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  pickerValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerValue: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
    flex: 1,
    marginRight: 4,
  },
  levelFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 12,
  },
  levelFilterLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  levelFilterTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  levelFilterValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalDismiss: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  modalCloseText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  pickerList: {
    flexGrow: 0,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  pickerItemText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

const filterActionStyles = StyleSheet.create({
  queryBtn: {
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queryBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
});

// Museum Filter Panel Component
type MuseumFilterPanelProps = {
  primaryColor: string;
  defaultLocation?: LocationValue;
  onApplyQuery?: (filters: MuseumQueryFormState) => void;
  queryButtonLabel?: string;
};

const MUSEUM_SORT_OPTIONS = ['离我最近', '名称排序'] as const;

export function MuseumFilterPanel({
  primaryColor,
  defaultLocation = DEFAULT_LOCATION,
  onApplyQuery,
  queryButtonLabel = '查询',
}: MuseumFilterPanelProps) {
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [useAutoLocation, setUseAutoLocation] = useState(false);
  const [location, setLocation] = useState<LocationValue>(defaultLocation);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerType, setPickerType] = useState<PickerType>('province');

  // Museum specific filters
  const [sortBy, setSortBy] = useState('离我最近');

  const handleRelocate = useCallback(async () => {
    setIsLocating(true);
    setUseAutoLocation(true);
    setLocationError(null);
    try {
      const result = await resolveAutoLocation(location.level);
      if (result.ok) {
        setLocation(result.location);
        return;
      }
      setUseAutoLocation(false);
      setLocation(result.fallbackLocation);
      setLocationError(result.message);
    } finally {
      setIsLocating(false);
    }
  }, [location.level]);

  const openPicker = (type: PickerType) => {
    setPickerType(type);
    setPickerVisible(true);
    setUseAutoLocation(false);
    setLocationError(null);
  };

  const selectValue = (value: string) => {
    if (pickerType === 'province') {
      setLocation({
        province: value,
        city: PLACEHOLDER,
        district: ALL_DISTRICTS,
        level: location.level,
      });
    } else if (pickerType === 'city') {
      setLocation((prev) => ({ ...prev, city: value, district: ALL_DISTRICTS }));
    } else if (pickerType === 'district') {
      setLocation((prev) => ({ ...prev, district: value }));
    }
    setLocationError(null);
    setPickerVisible(false);
  };

  const pickerData = React.useMemo(() => {
    if (pickerType === 'province') return CHINA_REGIONS.map((p) => p.name);
    if (pickerType === 'city') {
      const province = CHINA_REGIONS.find((v) => v.name === location.province);
      return province ? province.cities.map((c) => c.name) : [];
    }
    if (pickerType === 'district') {
      const province = CHINA_REGIONS.find((v) => v.name === location.province);
      const city = province?.cities.find((v) => v.name === location.city);
      const list = city?.districts ?? [];
      return [ALL_DISTRICTS, ...list];
    }
    return [];
  }, [location.city, location.province, pickerType]);

  const pickerTitle = {
    province: '选择省份',
    city: '选择城市',
    district: '选择区县',
    level: '选择等级',
  }[pickerType];

  return (
    <>
      <View style={museumStyles.filterPanel}>
        {/* Header */}
        <View style={styles.locationHeaderRow}>
          <View style={styles.locationTitleGroup}>
            <MapPinned size={18} color={primaryColor} />
            <Text style={[styles.locationMainTitle, { color: primaryColor }]}>
              博物馆筛选
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.autoLocateBtn,
              useAutoLocation && { backgroundColor: primaryColor },
            ]}
            onPress={handleRelocate}
            disabled={isLocating}
          >
            {isLocating ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <LocateFixed
                size={14}
                color={useAutoLocation ? Colors.white : primaryColor}
              />
            )}
            <Text
              style={[
                styles.autoLocateText,
                { color: primaryColor },
                useAutoLocation && styles.autoLocateTextActive,
              ]}
            >
              {isLocating ? '定位中...' : '当前定位'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Current Location Display */}
        <View style={styles.locationCurrentDisplay}>
          <Text style={styles.locationDisplayText}>
            {useAutoLocation ? '📍 当前位置' : '🔍 手动筛选'}:{' '}
            <Text style={[styles.locationEmphasis, { color: primaryColor }]}>
              {location.province} · {location.city} · {location.district}
            </Text>
          </Text>
          {useAutoLocation && (
            <TouchableOpacity
              onPress={handleRelocate}
              style={styles.refreshIconWrap}
            >
              <RefreshCw size={12} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        {locationError ? (
          <Text style={styles.locationErrorText}>{locationError}</Text>
        ) : null}

        {/* Province/City/District Selector */}
        <View style={styles.manualFilterGrid}>
          <TouchableOpacity
            style={styles.pickerTrigger}
            onPress={() => openPicker('province')}
          >
            <Text style={styles.pickerLabel}>省份</Text>
            <View style={styles.pickerValueRow}>
              <Text style={styles.pickerValue} numberOfLines={1}>
                {location.province}
              </Text>
              <ChevronDown size={14} color={Colors.textMuted} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.pickerTrigger}
            onPress={() => openPicker('city')}
            disabled={location.province === PLACEHOLDER}
          >
            <Text style={styles.pickerLabel}>城市</Text>
            <View style={styles.pickerValueRow}>
              <Text style={styles.pickerValue} numberOfLines={1}>
                {location.city}
              </Text>
              <ChevronDown size={14} color={Colors.textMuted} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.pickerTrigger}
            onPress={() => openPicker('district')}
            disabled={location.city === PLACEHOLDER}
          >
            <Text style={styles.pickerLabel}>区县</Text>
            <View style={styles.pickerValueRow}>
              <Text style={styles.pickerValue} numberOfLines={1}>
                {location.district}
              </Text>
              <ChevronDown size={14} color={Colors.textMuted} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Sort By */}
        <View style={museumStyles.sortRow}>
          <Text style={museumStyles.sortLabel}>排序方式</Text>
          <TouchableOpacity
            style={museumStyles.sortValue}
            activeOpacity={0.7}
            onPress={() => {
              const idx = MUSEUM_SORT_OPTIONS.indexOf(
                sortBy as (typeof MUSEUM_SORT_OPTIONS)[number],
              );
              const next =
                MUSEUM_SORT_OPTIONS[
                  (Math.max(0, idx) + 1) % MUSEUM_SORT_OPTIONS.length
                ];
              setSortBy(next);
            }}
          >
            <Text style={[museumStyles.sortValueText, { color: primaryColor }]}>
              {sortBy}
            </Text>
            <ChevronDown size={14} color={primaryColor} />
          </TouchableOpacity>
        </View>

        {onApplyQuery ? (
          <TouchableOpacity
            style={[filterActionStyles.queryBtn, { backgroundColor: primaryColor }]}
            activeOpacity={0.92}
            onPress={() =>
              onApplyQuery({
                province: location.province,
                city: location.city,
                district: location.district,
                sortBy,
                useAutoLocation,
              })
            }
          >
            <Text style={filterActionStyles.queryBtnText}>{queryButtonLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Location Picker Modal */}
      <Modal
        visible={pickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalDismiss}
            onPress={() => setPickerVisible(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: primaryColor }]}>
                {pickerTitle}
              </Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Text style={styles.modalCloseText}>取消</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={pickerData}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => selectValue(item)}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      (item === location.province ||
                        item === location.city ||
                        item === location.district) && {
                        color: primaryColor,
                        fontWeight: '800',
                      },
                    ]}
                  >
                    {item}
                  </Text>
                  {(item === location.province ||
                    item === location.city ||
                    item === location.district) && (
                    <View
                      style={[
                        styles.activeDot,
                        { backgroundColor: primaryColor },
                      ]}
                    />
                  )}
                </TouchableOpacity>
              )}
              style={styles.pickerList}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

type HeritageFilterOptions = {
  eras: string[];
  categories: string[];
  batches: string[];
};

type HeritagePickerType =
  | 'province'
  | 'city'
  | 'district'
  | 'era'
  | 'category'
  | 'batch';

type HeritageFilterPanelProps = {
  primaryColor: string;
  defaultLocation?: LocationValue;
  filterOptions: HeritageFilterOptions;
  onApplyQuery?: (filters: HeritageQueryFormState) => void;
  queryButtonLabel?: string;
};

export function HeritageFilterPanel({
  primaryColor,
  defaultLocation = DEFAULT_LOCATION,
  filterOptions,
  onApplyQuery,
  queryButtonLabel = '查询',
}: HeritageFilterPanelProps) {
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [useAutoLocation, setUseAutoLocation] = useState(false);
  const [location, setLocation] = useState<LocationValue>(defaultLocation);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerType, setPickerType] = useState<HeritagePickerType>('province');
  const [era, setEra] = useState('全部');
  const [category, setCategory] = useState('全部');
  const [batch, setBatch] = useState('全部');

  const handleRelocate = useCallback(async () => {
    setIsLocating(true);
    setUseAutoLocation(true);
    setLocationError(null);
    try {
      const result = await resolveAutoLocation(location.level);
      if (result.ok) {
        setLocation(result.location);
        return;
      }
      setUseAutoLocation(false);
      setLocation(result.fallbackLocation);
      setLocationError(result.message);
    } finally {
      setIsLocating(false);
    }
  }, [location.level]);

  const openPicker = (type: HeritagePickerType) => {
    setPickerType(type);
    setPickerVisible(true);
    setUseAutoLocation(false);
    setLocationError(null);
  };

  const selectValue = (value: string) => {
    if (pickerType === 'province') {
      setLocation({
        province: value,
        city: PLACEHOLDER,
        district: ALL_DISTRICTS,
        level: location.level,
      });
    } else if (pickerType === 'city') {
      setLocation((prev) => ({ ...prev, city: value, district: ALL_DISTRICTS }));
    } else if (pickerType === 'district') {
      setLocation((prev) => ({ ...prev, district: value }));
    } else if (pickerType === 'era') {
      setEra(value);
    } else if (pickerType === 'category') {
      setCategory(value);
    } else if (pickerType === 'batch') {
      setBatch(value);
    }
    setLocationError(null);
    setPickerVisible(false);
  };

  const pickerData = React.useMemo(() => {
    if (pickerType === 'province') return CHINA_REGIONS.map((p) => p.name);
    if (pickerType === 'city') {
      const province = CHINA_REGIONS.find((v) => v.name === location.province);
      return province ? province.cities.map((c) => c.name) : [];
    }
    if (pickerType === 'district') {
      const province = CHINA_REGIONS.find((v) => v.name === location.province);
      const city = province?.cities.find((v) => v.name === location.city);
      const list = city?.districts ?? [];
      return [ALL_DISTRICTS, ...list];
    }
    if (pickerType === 'era') {
      return ['全部', ...filterOptions.eras];
    }
    if (pickerType === 'category') {
      return ['全部', ...filterOptions.categories];
    }
    return ['全部', ...filterOptions.batches];
  }, [filterOptions.batches, filterOptions.categories, filterOptions.eras, location.city, location.province, pickerType]);

  const pickerTitleMap: Record<HeritagePickerType, string> = {
    province: '选择省份',
    city: '选择城市',
    district: '选择区县',
    era: '选择朝代年轮',
    category: '选择类别志趣',
    batch: '选择批次类型',
  };

  const activeValue = (() => {
    if (pickerType === 'province') return location.province;
    if (pickerType === 'city') return location.city;
    if (pickerType === 'district') return location.district;
    if (pickerType === 'era') return era;
    if (pickerType === 'category') return category;
    return batch;
  })();

  return (
    <>
      <View style={museumStyles.filterPanel}>
        <View style={styles.locationHeaderRow}>
          <View style={styles.locationTitleGroup}>
            <MapPinned size={18} color={primaryColor} />
            <Text style={[styles.locationMainTitle, { color: primaryColor }]}>
              重点文保筛选
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.autoLocateBtn,
              useAutoLocation && { backgroundColor: primaryColor },
            ]}
            onPress={handleRelocate}
            disabled={isLocating}
          >
            {isLocating ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <LocateFixed
                size={14}
                color={useAutoLocation ? Colors.white : primaryColor}
              />
            )}
            <Text
              style={[
                styles.autoLocateText,
                { color: primaryColor },
                useAutoLocation && styles.autoLocateTextActive,
              ]}
            >
              {isLocating ? '定位中...' : '当前位置'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.locationCurrentDisplay}>
          <Text style={styles.locationDisplayText}>
            {useAutoLocation ? '📍 当前位置' : '🗺️ 手动筛选'}：{' '}
            <Text style={[styles.locationEmphasis, { color: primaryColor }]}>
              {location.province} · {location.city} · {location.district}
            </Text>
          </Text>
          {useAutoLocation && (
            <TouchableOpacity
              onPress={handleRelocate}
              style={styles.refreshIconWrap}
            >
              <RefreshCw size={12} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        {locationError ? (
          <Text style={styles.locationErrorText}>{locationError}</Text>
        ) : null}

        <View style={styles.manualFilterGrid}>
          <TouchableOpacity
            style={styles.pickerTrigger}
            onPress={() => openPicker('province')}
          >
            <Text style={styles.pickerLabel}>省份</Text>
            <View style={styles.pickerValueRow}>
              <Text style={styles.pickerValue} numberOfLines={1}>
                {location.province}
              </Text>
              <ChevronDown size={14} color={Colors.textMuted} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.pickerTrigger}
            onPress={() => openPicker('city')}
            disabled={location.province === PLACEHOLDER}
          >
            <Text style={styles.pickerLabel}>城市</Text>
            <View style={styles.pickerValueRow}>
              <Text style={styles.pickerValue} numberOfLines={1}>
                {location.city}
              </Text>
              <ChevronDown size={14} color={Colors.textMuted} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.pickerTrigger}
            onPress={() => openPicker('district')}
            disabled={location.city === PLACEHOLDER}
          >
            <Text style={styles.pickerLabel}>区县</Text>
            <View style={styles.pickerValueRow}>
              <Text style={styles.pickerValue} numberOfLines={1}>
                {location.district}
              </Text>
              <ChevronDown size={14} color={Colors.textMuted} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={heritageStyles.row}>
          <Text style={heritageStyles.rowLabel}>朝代年轮</Text>
          <TouchableOpacity
            style={heritageStyles.rowValue}
            activeOpacity={0.8}
            onPress={() => openPicker('era')}
          >
            <Text style={[heritageStyles.rowValueText, { color: primaryColor }]}>
              {era}
            </Text>
            <ChevronDown size={14} color={primaryColor} />
          </TouchableOpacity>
        </View>

        <View style={heritageStyles.row}>
          <Text style={heritageStyles.rowLabel}>类别志趣</Text>
          <TouchableOpacity
            style={heritageStyles.rowValue}
            activeOpacity={0.8}
            onPress={() => openPicker('category')}
          >
            <Text style={[heritageStyles.rowValueText, { color: primaryColor }]}>
              {category}
            </Text>
            <ChevronDown size={14} color={primaryColor} />
          </TouchableOpacity>
        </View>

        <View style={heritageStyles.row}>
          <Text style={heritageStyles.rowLabel}>批次类型</Text>
          <TouchableOpacity
            style={heritageStyles.rowValue}
            activeOpacity={0.8}
            onPress={() => openPicker('batch')}
          >
            <Text style={[heritageStyles.rowValueText, { color: primaryColor }]}>
              {batch}
            </Text>
            <ChevronDown size={14} color={primaryColor} />
          </TouchableOpacity>
        </View>

        {onApplyQuery ? (
          <TouchableOpacity
            style={[filterActionStyles.queryBtn, { backgroundColor: primaryColor }]}
            activeOpacity={0.92}
            onPress={() =>
              onApplyQuery({
                province: location.province,
                city: location.city,
                district: location.district,
                era,
                category,
                batch,
                useAutoLocation,
              })
            }
          >
            <Text style={filterActionStyles.queryBtnText}>{queryButtonLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Modal
        visible={pickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalDismiss}
            onPress={() => setPickerVisible(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: primaryColor }]}>
                {pickerTitleMap[pickerType]}
              </Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Text style={styles.modalCloseText}>取消</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={pickerData}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => selectValue(item)}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      item === activeValue && {
                        color: primaryColor,
                        fontWeight: '800',
                      },
                    ]}
                  >
                    {item}
                  </Text>
                  {item === activeValue ? (
                    <View
                      style={[
                        styles.activeDot,
                        { backgroundColor: primaryColor },
                      ]}
                    />
                  ) : null}
                </TouchableOpacity>
              )}
              style={styles.pickerList}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const museumStyles = StyleSheet.create({
  filterPanel: {
    backgroundColor: '#F7F3E9',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(14,71,83,0.1)',
    marginBottom: 20,
  },
  filterSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  filterSectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  tagActive: {
    borderColor: 'transparent',
  },
  tagText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  tagTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 16,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  switchSubtext: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  switchTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DDD',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 12,
  },
  sortLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  sortValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sortValueText: {
    fontSize: 14,
    fontWeight: '800',
  },
});

const heritageStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 12,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  rowValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '62%',
  },
  rowValueText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
