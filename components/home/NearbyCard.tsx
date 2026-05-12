import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Heart, MapPin, Navigation, Sparkles, CircleCheck as CheckCircle } from 'lucide-react-native';

interface NearbyCardProps {
  name: string;
  type: string;
  dynasty: string;
  distance: string;
  isOpen: boolean;
  image: string;
  isFree: boolean;
  onPress?: () => void;
  onNavigate?: () => void;
  onAiGuide?: () => void;
  onCheckIn?: () => void;
  checkInBusy?: boolean;
  isCheckedIn?: boolean;
  isFavorite?: boolean;
  onFavorite?: () => void;
}

export function NearbyCard({
  name, type, dynasty, distance, isOpen, image, isFree, onPress, onNavigate, onAiGuide, onCheckIn,
  checkInBusy = false,
  isCheckedIn = false,
  isFavorite = false,
  onFavorite,
}: NearbyCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88}>
      <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {isCheckedIn ? (
            <View style={styles.headerCheckedIn}>
              <CheckCircle size={10} color={Colors.jade} />
              <Text style={styles.headerCheckInText}>已打卡</Text>
            </View>
          ) : onCheckIn ? (
            <TouchableOpacity
              style={[styles.headerCheckInBtn, checkInBusy && styles.checkInBtnDisabled]}
              onPress={onCheckIn}
              disabled={checkInBusy}
            >
              <Text style={styles.headerCheckInText}>{checkInBusy ? '打卡中' : '打卡'}</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.statusDot, { backgroundColor: isOpen ? Colors.jade : Colors.textMuted }]} />
          )}
        </View>
        <Text style={styles.type}>{type} · {dynasty}</Text>
        <View style={styles.footer}>
          <View style={styles.distanceRow}>
            <MapPin size={12} color={Colors.accent} />
            <Text style={styles.distance}>{distance}</Text>
          </View>
          <View style={styles.rightRow}>
            {isFree && (
              <View style={styles.freeBadge}>
                <Text style={styles.freeText}>免费</Text>
              </View>
            )}
            {onAiGuide ? (
              <TouchableOpacity style={styles.aiBtn} onPress={onAiGuide}>
                <Sparkles size={12} color={Colors.primary} />
              </TouchableOpacity>
            ) : null}
            {onFavorite ? (
              <TouchableOpacity style={styles.aiBtn} onPress={onFavorite}>
                <Heart
                  size={12}
                  color={isFavorite ? Colors.seal : Colors.primary}
                  fill={isFavorite ? Colors.seal : 'transparent'}
                />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.navBtn} onPress={onNavigate}>
              <Navigation size={13} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  image: {
    width: 90,
    height: 90,
  },
  content: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
    letterSpacing: 0.3,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginLeft: 6,
  },
  type: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  distance: {
    fontSize: 12,
    color: Colors.accent,
    fontWeight: '600',
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerCheckInBtn: {
    backgroundColor: Colors.primary + '18',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    marginLeft: 6,
  },
  checkInBtnDisabled: {
    opacity: 0.65,
  },
  headerCheckedIn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.jade + '18',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 6,
  },
  headerCheckInText: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: '700',
  },
  checkedInText: {
    fontSize: 10,
    color: Colors.jade,
    fontWeight: '700',
  },
  freeBadge: {
    backgroundColor: Colors.jade + '22',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  freeText: {
    fontSize: 10,
    color: Colors.jade,
    fontWeight: '700',
  },
  aiBtn: {
    width: 30,
    height: 30,
    backgroundColor: Colors.primary + '16',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: Colors.primary + '2f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtn: {
    width: 30,
    height: 30,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
