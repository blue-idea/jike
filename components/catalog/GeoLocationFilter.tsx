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
import { ChevronDown, LocateFixed, MapPinned, RefreshCw } from 'lucide-react-native';
import { CHINA_REGIONS } from '@/constants/CatalogData';
import { Colors } from '@/constants/Colors';

type PickerType = 'province' | 'city' | 'district';

type LocationValue = {
  province: string;
  city: string;
  district: string;
};

type GeoLocationFilterProps = {
  primaryColor: string;
  defaultLocation?: LocationValue;
  relocatedLocation?: LocationValue;
};

const DEFAULT_LOCATION: LocationValue = {
  province: '陕西省',
  city: '西安市',
  district: '碑林区',
};

const DEFAULT_RELOCATED_LOCATION: LocationValue = {
  province: '北京市',
  city: '北京市',
  district: '东城区',
};

export function GeoLocationFilter({
  primaryColor,
  defaultLocation = DEFAULT_LOCATION,
  relocatedLocation = DEFAULT_RELOCATED_LOCATION,
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
      setLocation({ province: value, city: '请选择', district: '请选择' });
    } else if (pickerType === 'city') {
      setLocation((prev) => ({ ...prev, city: value, district: '请选择' }));
    } else {
      setLocation((prev) => ({ ...prev, district: value }));
    }
    setPickerVisible(false);
  };

  const pickerData = useMemo(() => {
    if (pickerType === 'province') return CHINA_REGIONS.map((p) => p.name);
    if (pickerType === 'city') {
      const province = CHINA_REGIONS.find((v) => v.name === location.province);
      return province ? province.cities.map((c) => c.name) : [];
    }
    const province = CHINA_REGIONS.find((v) => v.name === location.province);
    const city = province?.cities.find((v) => v.name === location.city);
    return city ? city.districts : [];
  }, [location.city, location.province, pickerType]);

  const pickerTitle = {
    province: '选择省份',
    city: '选择城市',
    district: '选择区县',
  }[pickerType];

  return (
    <>
      <View style={styles.locationFilterPanel}>
        <View style={styles.locationHeaderRow}>
          <View style={styles.locationTitleGroup}>
            <MapPinned size={18} color={primaryColor} />
            <Text style={[styles.locationMainTitle, { color: primaryColor }]}>地理位置筛选</Text>
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
            <TouchableOpacity onPress={handleRelocate} style={styles.refreshIconWrap}>
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
              <Text style={[styles.modalTitle, { color: primaryColor }]}>{pickerTitle}</Text>
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
                        item === location.district) && { color: primaryColor, fontWeight: '800' },
                    ]}
                  >
                    {item}
                  </Text>
                  {(item === location.province ||
                    item === location.city ||
                    item === location.district) && (
                    <View style={[styles.activeDot, { backgroundColor: primaryColor }]} />
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
    borderColor: 'rgba(129,53,32,0.1)',
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
