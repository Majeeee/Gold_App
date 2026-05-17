import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: '#0f0f1e', borderTopColor: '#1e1e3a' },
        tabBarActiveTintColor: '#B8860B',
        tabBarInactiveTintColor: '#555',
        headerStyle: { backgroundColor: '#0f0f1e' },
        headerTintColor: '#B8860B',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Tabs.Screen
        name="global/index"
        options={{
          title: 'Global',
          tabBarIcon: ({ color, size }) =>
            <Ionicons name="globe-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="iran/index"
        options={{
          title: 'Iran',
          tabBarIcon: ({ color, size }) =>
            <Ionicons name="flag-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="portfolio/index"
        options={{
          title: 'Portfolio',
          tabBarIcon: ({ color, size }) =>
            <Ionicons name="briefcase-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="trade/backtest"
        options={{
          title: 'Backtest',
          tabBarIcon: ({ color, size }) =>
            <Ionicons name="bar-chart-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings/index"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, size }) =>
            <Ionicons name="notifications-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
