import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Lock } from 'lucide-react-native';

interface StampItemProps {
  name: string;
  image: string;
  date: string;
  unlocked: boolean;
  color: string;
}

export function StampItem({ name, image, date, unlocked, color }: StampItemProps) {
  return (
    <View style={styles.container}>
      <View style={[styles.stampOuter, { borderColor: unlocked ? color : Colors.borderLight }]}>
        <View style={[styles.stampInner, { borderColor: unlocked ? color + '66' : Colors.borderLight }]}>
          {unlocked ? (
            <Image source={{ uri: image }} style={styles.stampImage} resizeMode="cover" />
          ) : (
            <View style={styles.lockedContainer}>
              <Lock size={20} color={Colors.textLight} />
            </View>
          )}
          {unlocked && (
            <View style={[styles.sealOverlay, { backgroundColor: color + '22' }]}>
              <View style={[styles.sealCenter, { backgroundColor: color }]} />
            </View>
          )}
        </View>
      </View>
      <Text style={[styles.name, { color: unlocked ? Colors.text : Colors.textLight }]}
        numberOfLines={2}>{name}</Text>
      {unlocked && <Text style={styles.date}>{date}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 88,
    gap: 6,
  },
  stampOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stampInner: {
    width: '100%',
    height: '100%',
    borderRadius: 34,
    borderWidth: 1.5,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stampImage: {
    width: '100%',
    height: '100%',
  },
  lockedContainer: {
    flex: 1,
    backgroundColor: Colors.backgroundAlt,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sealOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sealCenter: {
    width: 10,
    height: 10,
    borderRadius: 5,
    opacity: 0.7,
  },
  name: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 15,
  },
  date: {
    fontSize: 10,
    color: Colors.textMuted,
  },
});
