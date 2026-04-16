import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Compass, MapPin, Route, BookOpen, User } from 'lucide-react-native';

function TabIcon({
  Icon,
  focused,
}: {
  Icon: React.ElementType;
  focused: boolean;
}) {
  return (
    <View style={[styles.iconWrapper, focused && styles.iconWrapperActive]}>
      <Icon
        size={22}
        color={focused ? Colors.primary : Colors.textMuted}
        strokeWidth={focused ? 2.5 : 1.8}
      />
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '首页',
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={MapPin} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: '发现',
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={Compass} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="journey"
        options={{
          title: '路线',
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={Route} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="collection"
        options={{
          title: '收藏',
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={BookOpen} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={User} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="heritage-directory"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="museum-directory"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="scenic-search"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.card,
    borderTopWidth: 0,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 16,
    height: Platform.OS === 'ios' ? 78 : 62,
    paddingBottom: Platform.OS === 'ios' ? 18 : 6,
    paddingTop: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 0,
    includeFontPadding: false,
    lineHeight: 14,
  },
  tabItem: {
    paddingTop: 0,
  },
  iconWrapper: {
    width: 40,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  iconWrapperActive: {
    backgroundColor: Colors.primary + '14',
  },
});
