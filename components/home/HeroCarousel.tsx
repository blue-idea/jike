import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { HERO_SLIDES } from '@/constants/MockData';
import { Badge } from '@/components/ui/Badge';
import { MapPin, Sparkles } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDE_WIDTH = SCREEN_WIDTH;

interface HeroCarouselProps {
  onSlidePress?: (id: string) => void;
}

export function HeroCarousel({ onSlidePress }: HeroCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const nextIndex = (activeIndex + 1) % HERO_SLIDES.length;
      scrollRef.current?.scrollTo({ x: nextIndex * SLIDE_WIDTH, animated: true });
      setActiveIndex(nextIndex);
    }, 4500);
    return () => clearInterval(interval);
  }, [activeIndex]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SLIDE_WIDTH);
    setActiveIndex(index);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
      >
        {HERO_SLIDES.map((slide) => (
          <TouchableOpacity
            key={slide.id}
            activeOpacity={0.95}
            style={styles.slide}
            onPress={() => onSlidePress?.(slide.id)}
          >
            <ImageBackground
              source={{ uri: slide.image }}
              style={styles.image}
              resizeMode="cover"
            >
              <LinearGradient
                colors={['transparent', 'rgba(20,14,4,0.55)', 'rgba(20,14,4,0.88)']}
                style={styles.gradient}
              >
                <View style={styles.content}>
                  <View style={styles.topRow}>
                    <Badge label={slide.tag} color={slide.tagColor} />
                    <View style={styles.aiPill}>
                      <Sparkles size={11} color={Colors.gold} />
                      <Text style={styles.aiText}>AI导览</Text>
                    </View>
                  </View>
                  <View style={styles.bottomContent}>
                    <Text style={styles.title}>{slide.title}</Text>
                    <View style={styles.locationRow}>
                      <MapPin size={13} color={Colors.accentLight} />
                      <Text style={styles.subtitle}>{slide.subtitle}</Text>
                    </View>
                    <Text style={styles.description}>{slide.description}</Text>
                    <View style={styles.tags}>
                      <View style={styles.tag}>
                        <Text style={styles.tagText}>{slide.dynasty}</Text>
                      </View>
                      <View style={styles.tag}>
                        <Text style={styles.tagText}>{slide.type}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </LinearGradient>
            </ImageBackground>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {HERO_SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === activeIndex ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 340,
    marginBottom: 8,
  },
  slide: {
    width: SLIDE_WIDTH,
    height: 340,
  },
  image: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 16,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  aiText: {
    fontSize: 11,
    color: Colors.goldLight,
    fontWeight: '600',
  },
  bottomContent: {
    gap: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 1,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.accentLight,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 20,
    marginTop: 2,
  },
  tags: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
  },
  dots: {
    position: 'absolute',
    bottom: 16,
    right: 20,
    flexDirection: 'row',
    gap: 5,
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
  dotActive: {
    width: 20,
    backgroundColor: Colors.white,
  },
  dotInactive: {
    width: 6,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
});
