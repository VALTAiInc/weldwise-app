// app/blueprints-pdf-viewer.tsx
import React from "react";
import { View, Text, StyleSheet, Pressable, TouchableOpacity, Linking, Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Sharing from "expo-sharing";
import { Brand } from "../constants/colors";

const ACCENT = Brand?.orange ?? "#fe7725";

export default function BlueprintsPdfViewerScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ uri?: string; name?: string }>();

  const uri = params?.uri ? decodeURIComponent(String(params.uri)) : "";
  const name = params?.name ? decodeURIComponent(String(params.name)) : "Selected PDF";

  const open = async () => {
    console.log("[PDF] open called, uri:", uri, "platform:", Platform.OS);
    if (!uri) return;
    try {
      if (Platform.OS !== "web" && uri.startsWith("file://")) {
        const isAvailable = await Sharing.isAvailableAsync();
        console.log("[PDF] sharing available:", isAvailable);
        if (isAvailable) {
          await Sharing.shareAsync(uri);
        } else {
          Alert.alert("Cannot share", "Sharing is not available on this device.");
        }
      } else {
        const supported = await Linking.canOpenURL(uri);
        console.log("[PDF] canOpenURL:", supported);
        if (supported) {
          await Linking.openURL(uri);
        } else {
          Alert.alert("Cannot open PDF", "No app is available to open this file.");
        }
      }
    } catch (e: any) {
      console.error("[PDF] open error:", e);
      Alert.alert("PDF open failed", e?.message || "Could not open the PDF.");
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 10 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={18} color="#fff" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>{name}</Text>
      <Text style={styles.subtitle}>
        For now we open the PDF in the system viewer. Later we can embed a real in-app PDF renderer.
      </Text>

      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="document-outline" size={22} color={ACCENT} />
        </View>
        <Text style={styles.cardTitle}>Ready to open</Text>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={open}
          style={styles.openButton}
        >
          <Ionicons name="open-outline" size={20} color="#fff" />
          <Text style={styles.openButtonText}>Open PDF</Text>
        </TouchableOpacity>

        <Text style={styles.uriText} numberOfLines={2}>
          {uri}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0a0a0a", paddingHorizontal: 18, gap: 12 },
  header: { flexDirection: "row", justifyContent: "flex-start" },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  backText: { color: "#fff", fontSize: 14 },
  title: { color: "#fff", fontSize: 32, fontWeight: "700", letterSpacing: -0.5, marginTop: 6 },
  subtitle: { color: "rgba(255,255,255,0.7)", fontSize: 14, lineHeight: 20, marginBottom: 10 },
  card: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: "#121212",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 10,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(254,119,37,0.12)",
    borderWidth: 1,
    borderColor: "rgba(254,119,37,0.20)",
  },
  cardTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  openButton: {
    marginTop: 6,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fe7725",
  },
  openButtonText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  uriText: { color: "rgba(255,255,255,0.45)", fontSize: 11, lineHeight: 16 },
});