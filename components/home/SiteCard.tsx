import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { MapPin, Navigation, CircleCheck as CheckCircle } from 'lucide-react-native';

interface SiteCardProps {
  name: string;
  province: string;
  city: string;
  dynasty: string;
  type: string;
  image: string;
  tags: string[];
  rating: number;
  distance?: string;
  isStamped?: boolean;
  level?: string;
  onPress?: () => void;
  onNavigate?: () => void;
}

export function SiteCard({
  name,
  province,
  city,
  dynasty,
  type,
  image,
  tags,
  rating,
  distance,
  isStamped,
  level,
  onPress,
  onNavigate,
}: SiteCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: image }}
          style={styles.image}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(26,22,3,0.7)']}
          style={styles.imageGradient}
        />
        {isStamped && (
          <View style={styles.stampedBadge}>
            <CheckCircle size={13} color={Colors.jade} fill={Colors.jade} />
            <Text style={styles.stampedText}>已打卡</Text>
          </View>
        )}
        {level && (
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>{level}</Text>
          </View>
        )}
        <View style={styles.dynastyBadge}>
          <Text style={styles.dynastyText}>{dynasty}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.locationRow}>
          <MapPin size={11} color={Colors.textMuted} />
          <Text style={styles.location}>
            {province} · {city}
          </Text>
        </View>
        <View style={styles.bottomRow}>
          <View style={styles.tagRow}>
            {tags.slice(0, 2).map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
          {onNavigate ? (
            <TouchableOpacity style={styles.navBtn} onPress={onNavigate} activeOpacity={0.85}>
              <Navigation size={12} color={Colors.primary} />
            </TouchableOpacity>
          ) : null}
        </View>
        {distance && <Text style={styles.distance}>{distance}</Text>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 200,
    backgroundColor: Colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  imageContainer: {
    height: 140,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
  },
  stampedBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stampedText: {
    fontSize: 10,
    color: Colors.jade,
    fontWeight: '700',
  },
  levelBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: Colors.accent,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  levelText: {
    fontSize: 10,
    color: Colors.white,
    fontWeight: '700',
  },
  dynastyBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  dynastyText: {
    fontSize: 10,
    color: Colors.white,
    fontWeight: '500',
  },
  content: {
    padding: 12,
    gap: 5,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: 0.3,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  location: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
    marginRight: 6,
  },
  tag: {
    backgroundColor: Colors.backgroundAlt,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  distance: {
    fontSize: 11,
    color: Colors.accent,
    fontWeight: '500',
  },
  navBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
