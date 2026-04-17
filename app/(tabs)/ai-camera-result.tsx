import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, Image,
  TouchableOpacity, Dimensions, StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  ChevronLeft, Share2, Bookmark, Info,
  Sparkles, Landmark, Calendar, MapPin,
  ArrowRight
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { CommonTopBar } from '@/components/ui/CommonTopBar';

const { width } = Dimensions.get('window');

export default function AiCameraResultScreen() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <CommonTopBar 
        rightElement={
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerBtn}>
              <Share2 size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.resultHeader}>
          <Text style={styles.resultTag}>识别成功</Text>
          <Text style={styles.resultTitle}>活态档案馆：AI 深度识别</Text>
        </View>

        <View style={styles.imageCard}>
          <Image 
            source={{ uri: 'https://images.pexels.com/photos/2034335/pexels-photo-2034335.jpeg?auto=compress&cs=tinysrgb&w=1200' }} 
            style={styles.capturedImage} 
          />
          <View style={styles.matchingOverlay}>
            <View style={styles.matchCircle}>
              <Text style={styles.matchText}>98%</Text>
              <Text style={styles.matchLabel}>匹配度</Text>
            </View>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoTitleRow}>
            <Landmark size={24} color={Colors.primary} />
            <View>
              <Text style={styles.siteName}>南禅寺大殿</Text>
              <Text style={styles.siteSubtitle}>Nanchan Temple Main Hall</Text>
            </View>
          </View>

          <View style={styles.detailGrid}>
            <View style={styles.detailItem}>
              <Calendar size={16} color={Colors.textMuted} />
              <Text style={styles.detailText}>唐建中三年 (782年)</Text>
            </View>
            <View style={styles.detailItem}>
              <MapPin size={16} color={Colors.textMuted} />
              <Text style={styles.detailText}>山西省五台县</Text>
            </View>
          </View>

          <View style={styles.descriptionBox}>
            <Text style={styles.descriptionText}>
              十二世纪风沙席卷，它是无声的见证者。作为中国现存最古老的木结构建筑，它质朴的屋檐承载着唐代深邃的建筑基因——在这里，极简与绝对的结构完美相遇。
            </Text>
          </View>

          <TouchableOpacity 
            style={styles.actionBtn}
            onPress={() => router.push('/ai-guide-detail')}
          >
            <LinearGradient
              colors={[Colors.primary, Colors.primaryDark]}
              style={styles.actionGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.actionBtnText}>查看深度文化解读</Text>
              <ArrowRight size={20} color={Colors.white} />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.relatedSection}>
          <Text style={styles.relatedTitle}>相关数字遗产</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relatedScroll}>
            {[
              { id: 1, name: '佛光寺东大殿', image: 'https://images.pexels.com/photos/2034335/pexels-photo-2034335.jpeg?auto=compress&cs=tinysrgb&w=400' },
              { id: 2, name: '观音阁', image: 'https://images.pexels.com/photos/3586966/pexels-photo-3586966.jpeg?auto=compress&cs=tinysrgb&w=400' },
              { id: 3, name: '应县木塔', image: 'https://images.pexels.com/photos/1674049/pexels-photo-1674049.jpeg?auto=compress&cs=tinysrgb&w=400' },
            ].map(item => (
              <TouchableOpacity key={item.id} style={styles.relatedCard}>
                <Image source={{ uri: item.image }} style={styles.relatedImage} />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={styles.relatedGradient} />
                <Text style={styles.relatedName}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.cardMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  resultHeader: {
    marginTop: 20,
    marginBottom: 20,
  },
  resultTag: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.success,
    backgroundColor: Colors.success + '15',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  imageCard: {
    width: '100%',
    height: 300,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 24,
    position: 'relative',
    backgroundColor: Colors.card,
    elevation: 4,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  capturedImage: {
    width: '100%',
    height: '100%',
  },
  matchingOverlay: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  matchCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 2,
    borderColor: Colors.goldLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchText: {
    color: Colors.goldLight,
    fontSize: 16,
    fontWeight: '800',
  },
  matchLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 8,
    fontWeight: '700',
    marginTop: -2,
  },
  infoCard: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    elevation: 2,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  infoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  siteName: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 0.5,
  },
  siteSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
    marginTop: 2,
  },
  detailGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  detailText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  descriptionBox: {
    marginBottom: 24,
  },
  descriptionText: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  actionBtn: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  actionBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  relatedSection: {
    marginBottom: 20,
  },
  relatedTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 16,
  },
  relatedScroll: {
    gap: 12,
    paddingBottom: 4,
  },
  relatedCard: {
    width: 140,
    height: 180,
    borderRadius: 16,
    backgroundColor: Colors.cardMuted,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  relatedImage: {
    ...StyleSheet.absoluteFillObject,
  },
  relatedGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  relatedName: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
    padding: 12,
  },
});
