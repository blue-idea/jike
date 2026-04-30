import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ImageBackground,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { JOURNEY_TEMPLATES } from '@/constants/MockData';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { BrandHeader } from '@/components/ui/BrandHeader';
import { Plus, Calendar, MapPin, ChevronRight } from 'lucide-react-native';
import { AiItineraryPlanner } from '@/components/journey/AiItineraryPlanner';

export default function JourneyScreen() {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FDF9EF" />
      <BrandHeader
        rightElement={
          <TouchableOpacity style={styles.createBtn} activeOpacity={0.8}>
            <Plus size={16} color={Colors.white} />
            <Text style={styles.createBtnText}>新建</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <AiItineraryPlanner />

        <SectionHeader title="路线模板" subtitle="精选主题文化行程" onSeeAll={() => {}} />

        {JOURNEY_TEMPLATES.map((tpl) => (
          <TouchableOpacity key={tpl.id} style={styles.templateCard} activeOpacity={0.88}>
            <ImageBackground
              source={{ uri: tpl.image }}
              style={styles.templateImage}
              imageStyle={styles.templateImageStyle}
              resizeMode="cover"
            >
              <LinearGradient colors={['transparent', 'rgba(26,22,3,0.8)']} style={styles.templateGradient}>
                <View style={styles.templateContent}>
                  <View style={styles.templateTop}>
                    <View style={styles.themePill}>
                      <Text style={styles.themePillText}>{tpl.theme}</Text>
                    </View>
                  </View>
                  <View style={styles.templateBottom}>
                    <Text style={styles.templateTitle}>{tpl.title}</Text>
                    <View style={styles.templateMeta}>
                      <View style={styles.tplMetaItem}>
                        <Calendar size={12} color="rgba(255,255,255,0.7)" />
                        <Text style={styles.tplMetaText}>{tpl.days} 天</Text>
                      </View>
                      <View style={styles.tplMetaItem}>
                        <MapPin size={12} color="rgba(255,255,255,0.7)" />
                        <Text style={styles.tplMetaText}>{tpl.siteCount} 处</Text>
                      </View>
                    </View>
                    <View style={styles.tplTagsRow}>
                      {tpl.tags.map((tag) => (
                        <View key={tag} style={styles.tplTag}>
                          <Text style={styles.tplTagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                    <TouchableOpacity style={styles.useTemplateBtn}>
                      <Text style={styles.useTemplateBtnText}>使用此模板</Text>
                      <ChevronRight size={14} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              </LinearGradient>
            </ImageBackground>
          </TouchableOpacity>
        ))}

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
  },
  createBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  templateCard: {
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  templateImage: {
    height: 200,
  },
  templateImageStyle: {
    borderRadius: 16,
  },
  templateGradient: {
    flex: 1,
  },
  templateContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 16,
  },
  templateTop: {
    alignItems: 'flex-start',
  },
  themePill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  themePillText: {
    fontSize: 11,
    color: Colors.white,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  templateBottom: {
    gap: 6,
  },
  templateTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  templateMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  tplMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tplMetaText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
  },
  tplTagsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tplTag: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tplTagText: {
    fontSize: 11,
    color: Colors.white,
    fontWeight: '500',
  },
  useTemplateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.white,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  useTemplateBtnText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '700',
  },
});
