import React from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { MapPin, Star, Heart, Navigation2 } from 'lucide-react-native';

interface SiteListCardProps {
  name: string;
  category: string;
  level: string;
  province: string;
  city: string;
  dynasty: string;
  type: string;
  image: string;
  tags: string[];
  distance?: string;
  rating?: number;
  isFavorite?: boolean;
  onPress?: () => void;
  onFavorite?: () => void;
}

export function SiteListCard({
  name, category, level, province, city, dynasty, type,
  image, tags, distance, rating, isFavorite, onPress, onFavorite,
}: SiteListCardProps) {
  const categoryColor = category === 'heritage' ? Colors.seal
    : category === 'museum' ? Colors.primary : Colors.accent;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.imageWrapper}>
        <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />
        <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.titleArea}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            {level && (
              <View style={[styles.levelBadge, { backgroundColor: categoryColor + '18' }]}>
                <Text style={[styles.levelText, { color: categoryColor }]}>{level}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={onFavorite} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Heart
              size={18}
              color={isFavorite ? Colors.seal : Colors.textLight}
              fill={isFavorite ? Colors.seal : 'transparent'}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.metaRow}>
          <MapPin size={11} color={Colors.textMuted} />
          <Text style={styles.meta}>{province} · {city}</Text>
          <View style={styles.dot} />
          <Text style={styles.meta}>{dynasty}</Text>
          <View style={styles.dot} />
          <Text style={styles.meta}>{type}</Text>
        </View>

        <View style={styles.tagsRow}>
          {tags.slice(0, 3).map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          {distance && (
            <View style={styles.distanceRow}>
              <Navigation2 size={11} color={Colors.accent} />
              <Text style={styles.distance}>{distance}</Text>
            </View>
          )}
          {rating && (
            <View style={styles.ratingRow}>
              <Star size={12} color={Colors.gold} fill={Colors.gold} />
              <Text style={styles.rating}>{rating.toFixed(1)}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  imageWrapper: {
    width: 100,
    height: 110,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  categoryDot: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.white,
  },
  content: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  titleArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 8,
    flexWrap: 'wrap',
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: 0.3,
  },
  levelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  levelText: {
    fontSize: 10,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  meta: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  dot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: Colors.textLight,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
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
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  rating: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '600',
  },
});
