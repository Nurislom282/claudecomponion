import { useEffect, useRef } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { wsService } from '@/services/websocket';
import { initFirebaseClient } from '@/services/firebase';
import {
  registerForPushNotifications,
  addNotificationResponseListener,
} from '@/services/notifications';
import { useRouter } from 'expo-router';

export default function RootLayout() {
  const router = useRouter();
  const notifResponseListener = useRef<any>();

  useEffect(() => {
    initFirebaseClient();
    registerForPushNotifications();
    wsService.connect();

    notifResponseListener.current = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === 'question') {
        router.push('/questions');
      } else if (data?.type === 'approval') {
        router.push('/approvals');
      }
    });

    return () => {
      wsService.disconnect();
      notifResponseListener.current?.remove();
    };
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#6c5ce7',
          tabBarInactiveTintColor: '#888',
          tabBarStyle: {
            backgroundColor: '#1a1a2e',
            borderTopColor: '#2d2d44',
          },
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#fff',
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="grid-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="questions"
          options={{
            title: 'Questions',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="chatbubble-ellipses-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="approvals"
          options={{
            title: 'Approvals',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="shield-checkmark-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="usage"
          options={{
            title: 'Usage',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="analytics-outline" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}
