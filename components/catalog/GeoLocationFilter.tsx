import React, { useMemo, useState } from 'react';
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
  relocatedLocation?: LocationValue;
  showLevelFilter?: boolean;
};

const DEFAULT_LOCATION: LocationValue = {
  province: '陕西省',
  city: '西安市',
  district: '碑林区',
  level: '全部等级',
};

const DEFAULT_RELOCATED_LOCATION: LocationValue = {
  province: '北京市',
  city: '北京市',
  district: '东城区',
  level: '全部等级',
};

const SCENIC_LEVELS = ['全部等级', '5A', '4A', '3A', '2A', '1A'];

export function GeoLocationFilter({
  primaryColor,
  defaultLocation = DEFAULT_LOCATION,
  relocatedLocation = DEFAULT_RELOCATED_LOCATION,
  showLevelFilter = true,
}: GeoLocationFilterProps) {
  const [isLocating, setIsLocating] = useState(false);
  const [useAutoLocation, setUseAutoLocation] = useState(true);
  const [location, setLocation] = useState<LocationValue>(defaultLocation);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerType, setPickerType] = useState<PickerType>('province');

  const handleRelocate = () => {
    setIsLocating(true);
    setUseAutoLocation(true);
    setTimeout(() => {
      setIsLocating(false);
      setLocation(relocatedLocation);
    }, 1200);
  };

  const openPicker = (type: PickerType) => {
    setPickerType(type);
    setPickerVisible(true);
    setUseAutoLocation(false);
  };

  const selectValue = (value: string) => {
    if (pickerType === 'province') {
      setLocation({
        province: value,
        city: '请选择',
        district: '请选择',
        level: location.level,
      });
    } else if (pickerType === 'city') {
      setLocation((prev) => ({ ...prev, city: value, district: '请选择' }));
    } else if (pickerType === 'district') {
      setLocation((prev) => ({ ...prev, district: value }));
    } else if (pickerType === 'level') {
      setLocation((prev) => ({ ...prev, level: value }));
    }
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
      return city ? city.districts : [];
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
            disabled={location.province === '请选择'}
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
            disabled={location.city === '请选择'}
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

// Museum Filter Panel Component
type MuseumFilterPanelProps = {
  primaryColor: string;
  defaultLocation?: LocationValue;
  relocatedLocation?: LocationValue;
};

export function MuseumFilterPanel({
  primaryColor,
  defaultLocation = DEFAULT_LOCATION,
  relocatedLocation = DEFAULT_RELOCATED_LOCATION,
}: MuseumFilterPanelProps) {
  const [isLocating, setIsLocating] = useState(false);
  const [useAutoLocation, setUseAutoLocation] = useState(true);
  const [location, setLocation] = useState<LocationValue>(defaultLocation);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerType, setPickerType] = useState<PickerType>('province');

  // Museum specific filters
  const [selectedQuality, setSelectedQuality] = useState('一级');
  const [selectedNature, setSelectedNature] = useState('综合');
  const [freeOnly, setFreeOnly] = useState(false);
  const [sortBy, setSortBy] = useState('离我最近');

  const handleRelocate = () => {
    setIsLocating(true);
    setUseAutoLocation(true);
    setTimeout(() => {
      setIsLocating(false);
      setLocation(relocatedLocation);
    }, 1200);
  };

  const openPicker = (type: PickerType) => {
    setPickerType(type);
    setPickerVisible(true);
    setUseAutoLocation(false);
  };

  const selectValue = (value: string) => {
    if (pickerType === 'province') {
      setLocation({
        province: value,
        city: '请选择',
        district: '请选择',
        level: location.level,
      });
    } else if (pickerType === 'city') {
      setLocation((prev) => ({ ...prev, city: value, district: '请选择' }));
    } else if (pickerType === 'district') {
      setLocation((prev) => ({ ...prev, district: value }));
    }
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
      return city ? city.districts : [];
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
            disabled={location.province === '请选择'}
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
            disabled={location.city === '请选择'}
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

        {/* Quality Level Filter */}
        <View style={museumStyles.filterSection}>
          <Text style={museumStyles.filterSectionLabel}>质量等级</Text>
          <View style={museumStyles.tagRow}>
            {['一级', '二级', '三级', '无级别'].map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[
                  museumStyles.tag,
                  selectedQuality === tag && [
                    museumStyles.tagActive,
                    { backgroundColor: primaryColor },
                  ],
                ]}
                onPress={() => setSelectedQuality(tag)}
              >
                <Text
                  style={[
                    museumStyles.tagText,
                    selectedQuality === tag && museumStyles.tagTextActive,
                  ]}
                >
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Museum Nature Filter */}
        <View style={museumStyles.filterSection}>
          <Text style={museumStyles.filterSectionLabel}>博物馆性质</Text>
          <View style={museumStyles.tagRow}>
            {['综合', '历史', '艺术', '科技'].map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[
                  museumStyles.tag,
                  selectedNature === tag && [
                    museumStyles.tagActive,
                    { backgroundColor: primaryColor },
                  ],
                ]}
                onPress={() => setSelectedNature(tag)}
              >
                <Text
                  style={[
                    museumStyles.tagText,
                    selectedNature === tag && museumStyles.tagTextActive,
                  ]}
                >
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Free Entry Switch */}
        <TouchableOpacity
          style={museumStyles.switchRow}
          onPress={() => setFreeOnly(!freeOnly)}
          activeOpacity={0.7}
        >
          <View>
            <Text style={museumStyles.switchLabel}>开放政策</Text>
            <Text style={museumStyles.switchSubtext}>仅显示免费开放</Text>
          </View>
          <View
            style={[
              museumStyles.switchTrack,
              freeOnly && { backgroundColor: primaryColor },
            ]}
          >
            <View
              style={[
                museumStyles.switchThumb,
                freeOnly && museumStyles.switchThumbActive,
              ]}
            />
          </View>
        </TouchableOpacity>

        {/* Sort By */}
        <View style={museumStyles.sortRow}>
          <Text style={museumStyles.sortLabel}>排序方式</Text>
          <TouchableOpacity style={museumStyles.sortValue} activeOpacity={0.7}>
            <Text style={[museumStyles.sortValueText, { color: primaryColor }]}>
              {sortBy}
            </Text>
            <ChevronDown size={14} color={primaryColor} />
          </TouchableOpacity>
        </View>
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
