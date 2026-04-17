import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, Image,
  TouchableOpacity, Dimensions, StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  ChevronLeft, Share2, Bookmark, MapPin, 
  History, Landmark, ScrollText, UserCircle2,
  Sparkles, Info, Volume2
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Colors, Gradients } from '@/constants/Colors';
import { CommonTopBar } from '@/components/ui/CommonTopBar';

const { width } = Dimensions.get('window');

export default function AiGuideDetailScreen() {
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <CommonTopBar 
        rightElement={
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerBtn}>
              <Share2 size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn}>
              <Bookmark size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView 
        style={styles.container} 
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
      >
        {/* Hero Section placeholder - will be handled by content below or integrated */}
        <View style={styles.heroSection}>
          <Image 
            source={{ uri: 'https://images.pexels.com/photos/2034335/pexels-photo-2034335.jpeg?auto=compress&cs=tinysrgb&w=1200' }} 
            style={styles.heroImage} 
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.heroGradient}
          />
          <View style={styles.heroContent}>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: Colors.accent }]}>
                <Sparkles size={12} color={Colors.white} />
                <Text style={styles.badgeText}>AI Scholar Guide</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Text style={styles.badgeText}>唐代建筑</Text>
              </View>
            </View>
            <Text style={styles.heroTitle}>南禅寺 Nanchan Temple</Text>
            <View style={styles.locationRow}>
              <MapPin size={14} color="rgba(255,255,255,0.8)" />
              <Text style={styles.locationText}>山西·五台县 | 公元782年</Text>
            </View>
          </View>
        </View>

        <View style={styles.contentCard}>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaValue}>最早</Text>
              <Text style={styles.metaLabel}>唐代木构</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.metaItem}>
              <Text style={styles.metaValue}>17尊</Text>
              <Text style={styles.metaLabel}>唐代彩塑</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.metaItem}>
              <Text style={styles.metaValue}>国一</Text>
              <Text style={styles.metaLabel}>文保级别</Text>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Info size={20} color={Colors.primary} />
              <Text style={styles.sectionTitle}>正殿建筑艺术解析</Text>
            </View>
            <Text style={styles.paragraph}>
              南禅寺大佛殿坐落于山西五台县阳白乡李家庄。它是中国现存最早的木结构建筑，不仅是建筑史上的奇迹，更是大唐风华的物质载体。
            </Text>
          </View>

          <View style={styles.aiInsightBox}>
            <LinearGradient
              colors={[Colors.backgroundAlt, Colors.card]}
              style={styles.aiBoxInner}
            >
              <View style={styles.aiBoxHeader}>
                <Sparkles size={16} color={Colors.accent} />
                <Text style={styles.aiBoxTitle}>AI 深度解读</Text>
              </View>
              <Text style={styles.aiBoxText}>
                建筑采用了“减柱法”的先雏形，内部空间宽敞明亮。最为精妙的是其斗拱结构，大斗与足材枋木交错衔接，犹如精准的榫卯交响。这种不着一钉的智慧，正是东方建筑哲学的巅峰表现。
              </Text>
            </LinearGradient>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <History size={20} color={Colors.primary} />
              <Text style={styles.sectionTitle}>历史背景</Text>
            </View>
            <Text style={styles.paragraph}>
              南禅寺始建年代不详，但重建于唐建中三年（公元782年）。在唐代“会昌法难”中，全国寺院大多毁损，唯此地由于地处偏僻，侥幸逃过一劫，成为弥足珍贵的唐代实物。
            </Text>
          </View>

          <View style={styles.poemCard}>
            <ScrollText size={32} color={Colors.accentLight} style={styles.quoteIcon} />
            <Text style={styles.poemText}>松径绕山晖，禅心远是非。</Text>
            <Text style={styles.poemText}>一从香火后，独见白云飞。</Text>
            <Text style={styles.poemAuthor}>—— 历代诗咏</Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <UserCircle2 size={20} color={Colors.primary} />
              <Text style={styles.sectionTitle}>人物故事</Text>
            </View>
            <View style={styles.storyContent}>
              <Text style={styles.paragraph}>
                1953年的黄昏，祁英涛与莫宗江两位先生跋涉至此。当他们抬头看见大殿脊檩上的墨书“大唐建中三年”时，那种跨越千年的激动可想而知。在此之前，学界普遍认为中国境内已无唐代木构。
              </Text>
            </View>
          </View>

          <View style={styles.timelineSection}>
              <View style={styles.sectionHeader}>
                <Landmark size={20} color={Colors.primary} />
                <Text style={styles.sectionTitle}>朝代演变</Text>
              </View>
              <View style={styles.timeline}>
                {[
                  { year: '782', event: '重建佛殿', desc: '唐建中三年，南禅寺大佛殿进行大规模重建，确立了今日所见的基础轮廓。' },
                  { year: '845', event: '会昌法难', desc: '唐武宗大规模拆毁佛寺，南禅寺因地处偏远小村，躲过灭顶之灾。' },
                  { year: '1953', event: '学术再发现', desc: '国家文物局勘察小组发现并鉴定其为中国现存最早唐代木结构。' },
                ].map((item, idx) => (
                  <View key={idx} style={styles.timelineItem}>
                    <View style={styles.timelineLeft}>
                      <Text style={styles.timelineYear}>{item.year}</Text>
                      <View style={styles.timelineLine} />
                      <View style={styles.timelineDot} />
                    </View>
                    <View style={styles.timelineRight}>
                      <Text style={styles.timelineEvent}>{item.event}</Text>
                      <Text style={styles.timelineDesc}>{item.desc}</Text>
                    </View>
                  </View>
                ))}
              </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity 
        style={styles.fab}
        onPress={() => {}}
      >
        <LinearGradient
          colors={Gradients.accent}
          style={styles.fabGradient}
        >
          <Volume2 size={24} color={Colors.white} />
        </LinearGradient>
      </TouchableOpacity>
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
  },
  heroSection: {
    width: '100%',
    height: 300,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.white,
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  contentCard: {
    backgroundColor: Colors.background,
    marginTop: -20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: Colors.card,
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  metaItem: {
    flex: 1,
    alignItems: 'center',
  },
  metaValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primary,
    marginBottom: 4,
  },
  metaLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.border,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 0.5,
  },
  paragraph: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 26,
    letterSpacing: 0.2,
  },
  aiInsightBox: {
    marginBottom: 32,
  },
  aiBoxInner: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  aiBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  aiBoxTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  aiBoxText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 24,
    fontStyle: 'italic',
  },
  poemCard: {
    backgroundColor: '#FDF9EF',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#E8DFD0',
  },
  quoteIcon: {
    marginBottom: 16,
    opacity: 0.5,
  },
  poemText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: 2,
  },
  poemAuthor: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 16,
    fontWeight: '500',
  },
  storyContent: {
    backgroundColor: Colors.card,
    padding: 20,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  timelineSection: {
    marginBottom: 20,
  },
  timeline: {
    marginTop: 10,
    paddingLeft: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  timelineLeft: {
    alignItems: 'center',
    marginRight: 16,
    width: 60,
  },
  timelineYear: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primary,
    marginBottom: 4,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
    position: 'absolute',
    top: 22,
    left: 26,
  },
  timelineRight: {
    flex: 1,
    paddingTop: 2,
  },
  timelineEvent: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },
  timelineDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    bottom: 40,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    elevation: 8,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  fabGradient: {
    flex: 1,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
