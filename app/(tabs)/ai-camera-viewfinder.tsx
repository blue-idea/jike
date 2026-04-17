import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, 
  Dimensions, Image, StatusBar, Animated
} from 'react-native';
import { BlurView } from 'expo-blur';
import { 
  X, Zap, ZapOff, Image as ImageIcon, 
  RotateCcw, Sparkles 
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { CommonTopBar } from '@/components/ui/CommonTopBar';

const { width, height } = Dimensions.get('window');

export default function AiCameraViewfinderScreen() {
  const router = useRouter();
  const [flash, setFlash] = useState(false);
  const scanLineAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    const startAnimation = () => {
      scanLineAnim.setValue(0);
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 3000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    startAnimation();
  }, [scanLineAnim]);

  const translateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, width * 0.7],
  });

  const handleCapture = () => {
    // Simulate capture and navigate to result
    router.replace('/ai-camera-result');
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Mock Camera Preview */}
      <Image 
        source={{ uri: 'https://images.pexels.com/photos/2034335/pexels-photo-2034335.jpeg?auto=compress&cs=tinysrgb&w=1200' }} 
        style={styles.cameraPreview}
      />

      <View style={styles.overlay}>
        <View style={styles.topSection}>
          <TouchableOpacity 
            style={styles.circleBtn} 
            onPress={() => router.back()}
          >
            <X size={24} color={Colors.white} />
          </TouchableOpacity>
          <View style={styles.topRight}>
             <TouchableOpacity 
              style={styles.circleBtn} 
              onPress={() => setFlash(!flash)}
            >
              {flash ? <Zap size={22} color={Colors.goldLight} /> : <ZapOff size={22} color={Colors.white} />}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.centerSection}>
          <View style={styles.scanContainer}>
            {/* Corners */}
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRightCorner]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />

            {/* Scan Line */}
            <Animated.View style={[styles.scanLine, { transform: [{ translateY }] }]}>
              <View style={styles.scanLineInner} />
            </Animated.View>

            <View style={styles.hintContainer}>
              <Sparkles size={16} color={Colors.goldLight} />
              <Text style={styles.hintText}>请将建筑对准方框内</Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomSection}>
          <BlurView intensity={30} tint="dark" style={styles.bottomBlur}>
            <View style={styles.controls}>
              <TouchableOpacity style={styles.sideBtn}>
                <ImageIcon size={24} color={Colors.white} />
                <Text style={styles.sideBtnText}>相册</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.captureBtnOuter}
                onPress={handleCapture}
                activeOpacity={0.8}
              >
                <View style={styles.captureBtnInner} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.sideBtn}>
                <RotateCcw size={24} color={Colors.white} />
                <Text style={styles.sideBtnText}>翻转</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraPreview: {
    width: '100%',
    height: '100%',
    opacity: 0.8,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topSection: {
    paddingTop: StatusBar.currentHeight ? StatusBar.currentHeight + 20 : 60,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topRight: {
    flexDirection: 'row',
    gap: 16,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  centerSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanContainer: {
    width: width * 0.7,
    height: width * 0.7,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: Colors.accentLight,
    borderWidth: 4,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 12,
  },
  topRightCorner: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 12,
  },
  scanLine: {
    width: '100%',
    height: 2,
    zIndex: 10,
  },
  scanLineInner: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.accentLight,
    shadowColor: Colors.accentLight,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5,
  },
  hintContainer: {
    position: 'absolute',
    bottom: -60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  hintText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  bottomSection: {
    width: '100%',
    paddingBottom: 40,
  },
  bottomBlur: {
    paddingVertical: 24,
    width: '100%',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 30,
  },
  sideBtn: {
    alignItems: 'center',
    gap: 6,
    width: 60,
  },
  sideBtnText: {
    color: '#ccc',
    fontSize: 12,
    fontWeight: '600',
  },
  captureBtnOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureBtnInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.white,
  },
});
