import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Award, Star, CircleCheck as CheckCircle, Building2 } from 'lucide-react-native';

const ICONS: Record<string, React.ElementType> = {
  award: Award,
  star: Star,
  check: CheckCircle,
  building: Building2,
};

interface AchievementCardProps {
  title: string;
  description: string;
  progress: number;
  total: number;
  icon: string;
  color: string;
  unlocked: boolean;
}

export function AchievementCard({
  title, description, progress, total, icon, color, unlocked,
}: AchievementCardProps) {
  const Icon = ICONS[icon] || Award;
  const pct = Math.min((progress / total) * 100, 100);

  return (
    <View style={[styles.card, unlocked && styles.cardUnlocked]}>
      <View style={[styles.iconContainer, { backgroundColor: color + '18' }]}>
        <Icon size={22} color={unlocked ? color : Colors.textLight} />
      </View>
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, !unlocked && styles.titleLocked]}>{title}</Text>
          {unlocked && (
            <View style={[styles.unlockedBadge, { backgroundColor: color }]}>
              <Text style={styles.unlockedText}>已获得</Text>
            </View>
          )}
        </View>
        <Text style={styles.description}>{description}</Text>
        <View style={styles.progressRow}>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: color }]} />
          </View>
          <Text style={styles.progressText}>{progress}/{total}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 10,
    gap: 12,
    alignItems: 'center',
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  cardUnlocked: {
    borderColor: Colors.gold + '55',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  titleLocked: {
    color: Colors.textSecondary,
  },
  unlockedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  unlockedText: {
    fontSize: 10,
    color: Colors.white,
    fontWeight: '700',
  },
  description: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  progressBg: {
    flex: 1,
    height: 5,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
    minWidth: 30,
    textAlign: 'right',
  },
});
