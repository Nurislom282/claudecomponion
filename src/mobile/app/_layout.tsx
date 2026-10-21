import { useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { wsService } from '../services/websocket';

const TAB_CONFIG = [
  { name: 'index', title: 'Home', icon: 'grid-outline', activeIcon: 'grid' },
  { name: 'activity', title: 'Live', icon: 'pulse-outline', activeIcon: 'pulse' },
  { name: 'questions', title: 'Ask', icon: 'chatbubble-ellipses-outline', activeIcon: 'chatbubble-ellipses' },
  { name: 'approvals', title: 'Approve', icon: 'shield-checkmark-outline', activeIcon: 'shield-checkmark' },
  { name: 'usage', title: 'Usage', icon: 'analytics-outline', activeIcon: 'analytics' },
  { name: 'settings', title: 'Settings', icon: 'settings-outline', activeIcon: 'settings' },
] as const;

function CustomTabBar({ state, descriptors, navigation }: any) {
  return (
    <View style={tabStyles.bar}>
      {state.routes.map((route: any, index: number) => {
        const isFocused = state.index === index;
        const config = TAB_CONFIG.find((t) => t.name === route.name);
        if (!config) return null;
        const iconName = isFocused ? config.activeIcon : config.icon;
        const color = isFocused ? '#6c5ce7' : '#888';

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
            style={tabStyles.tab}
          >
            <Ionicons name={iconName as any} size={22} color={color} />
            <Text style={[tabStyles.label, { color }]}>{config.title}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
    paddingBottom: 20,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: { fontSize: 10, fontWeight: '500' },
});

export default function RootLayout() {
  useEffect(() => {
    try { wsService.connect(); } catch {}
    return () => { wsService.disconnect(); };
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#fff',
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
        <Tabs.Screen name="activity" options={{ title: 'Live Activity' }} />
        <Tabs.Screen name="questions" options={{ title: 'Questions' }} />
        <Tabs.Screen name="approvals" options={{ title: 'Approvals' }} />
        <Tabs.Screen name="usage" options={{ title: 'Usage' }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      </Tabs>
    </>
  );
}
