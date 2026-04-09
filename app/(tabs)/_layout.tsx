// app/(tabs)/_layout.tsx
import React from "react";
import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

const ACCENT = "#fe7725";

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  // iPhone safe area can be small on some sims; force a minimum.
  const bottomPad = Math.max(insets.bottom, 14);

  // Base bar height before adding safe-area padding.
  const TAB_HEIGHT = 62;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        tabBarActiveTintColor: ACCENT,
        tabBarInactiveTintColor: "#6b6b6b",

        tabBarStyle: {
          backgroundColor: "#000",
          borderTopColor: "#141414",
          borderTopWidth: 1,

          // IMPORTANT: push content UP (less top padding) + give more bottom room
          height: TAB_HEIGHT + bottomPad + 26,
          paddingTop: 2,
          paddingBottom: bottomPad + 20,
        },

        // Give each tab item its own vertical breathing room (prevents label clipping)
        tabBarItemStyle: {
          paddingTop: 2,
          paddingBottom: 8,
        },

        // Slightly tighter label spacing so it sits safely above the bottom padding
        tabBarLabelStyle: {
          fontSize: 12,
          marginTop: 2,
          paddingBottom: Platform.OS === "ios" ? 0 : 2,
        },

        // Helps keep icon from drifting too low on some devices
        tabBarIconStyle: {
          marginTop: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="home-outline"
              size={Math.min(size, 24)}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="talk"
        options={{
          title: "Talk",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="mic-outline"
              size={Math.min(size, 24)}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="manual"
        options={{
          title: "Procedures",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="document-text-outline"
              size={Math.min(size, 24)}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="maintenance-log"
        options={{
          title: "Job Log",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="construct-outline"
              size={Math.min(size, 24)}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="blueprints"
        options={{
          title: "Blueprints",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="grid-outline"
              size={Math.min(size, 24)}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="worker-rights"
        options={{
          title: "Rights",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "shield" : "shield-outline"}
              size={Math.min(size, 24)}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}