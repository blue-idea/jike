import { type PropsWithChildren } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ImageBackground, Image } from 'react-native';
import { Colors } from '@/constants/Colors';
import { BlurView } from 'expo-blur';
import { BrandingOptions, CURRENT_BRANDING } from '@/constants/Branding';

type Props = PropsWithChildren<{
  title: string;
  subtitle?: string;
}>;

export function AuthScreenShell({ title, subtitle, children }: Props) {
  const branding = BrandingOptions[CURRENT_BRANDING];

  return (
    <ImageBackground
      source={require('@/assets/images/auth/background.png')}
      style={styles.root}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <View style={styles.centerWrap}>
          <BlurView intensity={30} tint="light" style={styles.cardContainer}>
            <View style={styles.card}>
              <View style={styles.header}>
                <View style={styles.branding}>
                  <Image source={branding.image} style={styles.logo} resizeMode="contain" />
                </View>
                <Text style={styles.title}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              </View>
              <View style={styles.content}>{children}</View>
            </View>
          </BlurView>
        </View>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 46, 38, 0.3)',
  },
  container: {
    flex: 1,
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  cardContainer: {
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
  },
  card: {
    padding: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  branding: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  logo: {
    width: 80,
    height: 80,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 1,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 12,
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
    opacity: 0.8,
  },
  content: {
    width: '100%',
  },
});
