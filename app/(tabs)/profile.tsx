import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView,
  TouchableOpacity, StatusBar, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { STAMPS_DATA, ACHIEVEMENTS, USER_STATS, PROVINCES_VISITED } from '@/constants/MockData';
import { StampItem } from '@/components/profile/StampItem';
import { AchievementCard } from '@/components/profile/AchievementCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import {
  Settings, Share2, ChevronRight, MapPin, Award,
  BookOpen, Globe, Clock, Star, LogOut,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';

const AVATAR = 'https://images.pexels.com/photos/1040881/pexels-photo-1040881.jpeg?auto=compress&cs=tinysrgb&w=200';

const STAT_ITEMS = [
  { label: '已打卡', value: USER_STATS.sitesVisited, Icon: MapPin, color: Colors.accent },
  { label: '探索省份', value: USER_STATS.provincesExplored, Icon: Globe, color: Colors.primary },
  { label: '数字印章', value: USER_STATS.stampsCollected, Icon: Star, color: Colors.seal },
  { label: '完成旅程', value: USER_STATS.journeysCompleted, Icon: Clock, color: Colors.jade },
];

const TITLES = ['文化旅行者', '古建筑爱好者', '博物馆达人'];

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [selectedTitle, setSelectedTitle] = useState(0);
  const displayedStamps = STAMPS_DATA.slice(0, 6);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={[Colors.primaryDark, Colors.primary, Colors.jade]}
          style={styles.heroGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <SafeAreaView>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.headerBtn}>
                <Share2 size={18} color={Colors.white} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerBtn}>
                <Settings size={18} color={Colors.white} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerBtn}
                onPress={() => void signOut()}
                accessibilityRole="button"
                accessibilityLabel="登出"
              >
                <LogOut size={18} color={Colors.white} />
              </TouchableOpacity>
            </View>

            <View style={styles.profileSection}>
              <View style={styles.avatarWrapper}>
                <Image source={{ uri: AVATAR }} style={styles.avatar} />
                <View style={styles.levelBadge}>
                  <Text style={styles.levelText}>Lv.7</Text>
                </View>
              </View>
              <Text style={styles.username}>
                {user?.email ?? '文化探索者 · 山河客'}
              </Text>
              <TouchableOpacity
                style={styles.titleSelector}
                onPress={() => setSelectedTitle((v) => (v + 1) % TITLES.length)}
              >
                <Star size={12} color={Colors.gold} fill={Colors.gold} />
                <Text style={styles.userTitle}>{TITLES[selectedTitle]}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.passportCard}>
              <View style={styles.passportHeader}>
                <View style={styles.passportLeft}>
                  <Text style={styles.passportLabel}>文旅护照</Text>
                  <Text style={styles.passportId}>JIKE-2024-001847</Text>
                </View>
                <View style={styles.passportSeal}>
                  <Text style={styles.passportSealText}>集</Text>
                  <Text style={styles.passportSealText}>刻</Text>
                </View>
              </View>
              <View style={styles.statsGrid}>
                {STAT_ITEMS.map(({ label, value, Icon, color }) => (
                  <View key={label} style={styles.statItem}>
                    <View style={[styles.statIconBg, { backgroundColor: color + '22' }]}>
                      <Icon size={16} color={color} />
                    </View>
                    <Text style={styles.statValue}>{value}</Text>
                    <Text style={styles.statLabel}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>

        <View style={styles.content}>
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionAccent} />
                <Text style={styles.sectionTitle}>文化足迹地图</Text>
              </View>
              <TouchableOpacity>
                <Text style={styles.seeAll}>查看全图</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.heatmapContainer}>
              <View style={styles.heatmapGrid}>
                {['云', '甘', '陕', '豫', '冀', '晋', '鲁', '苏', '浙', '闽',
                  '粤', '湘', '鄂', '皖', '川', '渝', '贵', '滇', '琼', '藏',
                  '新', '蒙', '辽', '吉', '黑', '京', '津', '沪'].map((province) => {
                  const visited = PROVINCES_VISITED.includes(
                    province === '京' ? '北京' : province === '沪' ? '上海' : ''
                  ) || ['陕', '甘', '京', '苏', '浙', '川'].includes(province);
                  return (
                    <View
                      key={province}
                      style={[
                        styles.provinceCell,
                        visited ? styles.provinceCellVisited : styles.provinceCellUnvisited,
                      ]}
                    >
                      <Text style={[styles.provinceText, visited && styles.provinceTextVisited]}>
                        {province}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <View style={styles.heatmapLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
                  <Text style={styles.legendText}>已探索 ({PROVINCES_VISITED.length} 省)</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: Colors.borderLight }]} />
                  <Text style={styles.legendText}>未探索</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <SectionHeader title="数字印章集" subtitle="到访后自动解锁" onSeeAll={() => {}} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.stampsRow}
            >
              {displayedStamps.map((stamp) => (
                <StampItem
                  key={stamp.id}
                  name={stamp.name}
                  image={stamp.image}
                  date={stamp.date}
                  unlocked={stamp.unlocked}
                  color={stamp.color}
                />
              ))}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <SectionHeader title="文化成就" subtitle={`${ACHIEVEMENTS.filter((a) => a.unlocked).length} / ${ACHIEVEMENTS.length} 已解锁`} />
            {ACHIEVEMENTS.map((achievement) => (
              <AchievementCard
                key={achievement.id}
                title={achievement.title}
                description={achievement.description}
                progress={achievement.progress}
                total={achievement.total}
                icon={achievement.icon}
                color={achievement.color}
                unlocked={achievement.unlocked}
              />
            ))}
          </View>

          <View style={styles.menuSection}>
            {[
              { label: '我的游记', icon: BookOpen, desc: '3 篇', color: Colors.accent },
              { label: '参观历史', icon: Clock, desc: '47 次', color: Colors.primary },
              { label: '文化称号', icon: Award, desc: '5 个', color: Colors.seal },
              { label: '探索地图', icon: Globe, desc: '12 省', color: Colors.jade },
            ].map(({ label, icon: Icon, desc, color }) => (
              <TouchableOpacity key={label} style={styles.menuItem}>
                <View style={[styles.menuIcon, { backgroundColor: color + '18' }]}>
                  <Icon size={18} color={color} />
                </View>
                <View style={styles.menuContent}>
                  <Text style={styles.menuLabel}>{label}</Text>
                  <Text style={styles.menuDesc}>{desc}</Text>
                </View>
                <ChevronRight size={16} color={Colors.textLight} />
              </TouchableOpacity>
            ))}
          </View>
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
  heroGradient: {
    paddingBottom: 24,
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 8,
  },
  headerBtn: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileSection: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 16,
    gap: 8,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  levelBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.accent,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  levelText: {
    fontSize: 10,
    color: Colors.white,
    fontWeight: '800',
  },
  username: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 1,
  },
  titleSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  userTitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  passportCard: {
    marginHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    gap: 14,
  },
  passportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  passportLeft: {
    gap: 3,
  },
  passportLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 2,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  passportId: {
    fontSize: 14,
    color: Colors.goldLight,
    fontWeight: '700',
    letterSpacing: 1,
  },
  passportSeal: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  passportSealText: {
    fontSize: 12,
    color: Colors.goldLight,
    fontWeight: '800',
    lineHeight: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.white,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  content: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    paddingTop: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionAccent: {
    width: 3,
    height: 18,
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  seeAll: {
    fontSize: 13,
    color: Colors.accent,
    fontWeight: '500',
  },
  heatmapContainer: {
    marginHorizontal: 20,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  heatmapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  provinceCell: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  provinceCellVisited: {
    backgroundColor: Colors.primary,
  },
  provinceCellUnvisited: {
    backgroundColor: Colors.backgroundAlt,
  },
  provinceText: {
    fontSize: 12,
    color: Colors.textLight,
    fontWeight: '600',
  },
  provinceTextVisited: {
    color: Colors.white,
  },
  heatmapLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  stampsRow: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 4,
  },
  menuSection: {
    marginHorizontal: 20,
    backgroundColor: Colors.card,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  menuDesc: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
});
