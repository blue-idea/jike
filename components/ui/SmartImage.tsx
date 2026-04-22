import React, { useMemo, useState } from 'react';
import {
  Image,
  ImageBackground,
  type ImageSourcePropType,
  type ImageStyle,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { Colors } from '@/constants/Colors';

type SmartImageSource = {
  uri?: string | null;
};

interface SmartImageProps {
  source: SmartImageSource;
  style?: ImageStyle;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
  fallbackText?: string;
  fallbackSource?: ImageSourcePropType;
}

interface SmartImageBackgroundProps {
  source: SmartImageSource;
  style?: ViewStyle;
  imageStyle?: ImageStyle;
  fallbackText?: string;
  fallbackSource?: ImageSourcePropType;
  children?: React.ReactNode;
}

function normalizeUri(uri?: string | null): string | null {
  const trimmed = (uri ?? '').trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

function ImageFallback({
  style,
  text = '图片加载失败',
  children,
}: {
  style?: ViewStyle | ImageStyle;
  text?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={[styles.fallback, style]}>
      <Text style={styles.fallbackText}>{text}</Text>
      {children}
    </View>
  );
}

export function SmartImage({
  source,
  style,
  resizeMode = 'cover',
  fallbackText,
  fallbackSource,
}: SmartImageProps) {
  const [hasError, setHasError] = useState(false);
  const uri = useMemo(() => normalizeUri(source.uri), [source.uri]);
  const canRenderImage = Boolean(uri) && !hasError;

  if (!canRenderImage) {
    if (fallbackSource) {
      return (
        <Image
          source={fallbackSource}
          style={style}
          resizeMode={resizeMode}
        />
      );
    }
    return <ImageFallback style={style} text={fallbackText} />;
  }

  return (
    <Image
      source={{ uri: uri! }}
      style={style}
      resizeMode={resizeMode}
      onError={() => setHasError(true)}
    />
  );
}

export function SmartImageBackground({
  source,
  style,
  imageStyle,
  fallbackText,
  fallbackSource,
  children,
}: SmartImageBackgroundProps) {
  const [hasError, setHasError] = useState(false);
  const uri = useMemo(() => normalizeUri(source.uri), [source.uri]);
  const canRenderImage = Boolean(uri) && !hasError;

  if (!canRenderImage) {
    if (fallbackSource) {
      return (
        <ImageBackground
          source={fallbackSource}
          imageStyle={imageStyle}
          style={style}
        >
          {children}
        </ImageBackground>
      );
    }
    return (
      <ImageFallback style={style} text={fallbackText}>
        {children}
      </ImageFallback>
    );
  }

  return (
    <ImageBackground
      source={{ uri: uri! }}
      imageStyle={imageStyle}
      style={style}
      onError={() => setHasError(true)}
    >
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
});
