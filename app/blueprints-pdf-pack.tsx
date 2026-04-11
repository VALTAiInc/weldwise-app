// app/blueprints-pdf-pack.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
  Alert,
  Linking,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Brand } from "../constants/colors";

const ACCENT = Brand?.orange ?? "#fe7725";

type PickedPdf = {
  name: string;
  uri: string;
  size?: number;
};

async function openPdfWithSystem(uri: string) {
  console.log("[PDF-PACK] opening uri:", uri);
  try {
    if (uri.startsWith("file://")) {
      const isAvailable = await Sharing.isAvailableAsync();
      console.log("[PDF-PACK] sharing available:", isAvailable);
      if (isAvailable) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
      } else {
        Alert.alert("Cannot open PDF", "Sharing is not available on this device.");
      }
    } else {
      const can = await Linking.canOpenURL(uri);
      if (!can) {
        Alert.alert("Can't open this PDF", "Your device says it can't open this link.");
        return;
      }
      await Linking.openURL(uri);
    }
  } catch (e: any) {
    console.error("[PDF-PACK] open error:", e);
    Alert.alert("PDF open failed", e?.message || "Could not open the PDF.");
  }
}

export default function BlueprintsPdfPackScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topInset = isWeb ? 67 : insets.top;

  const [picked, setPicked] = useState<PickedPdf | null>(null);

  const prettySize = useMemo(() => {
    if (!picked?.size) return "";
    const mb = picked.size / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    const kb = picked.size / 1024;
    return `${kb.toFixed(0)} KB`;
  }, [picked]);

  const pickPdf = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf"],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (res.canceled) return;

      const file = res.assets?.[0];
      if (!file?.uri) return;

      setPicked({
        name: file.name ?? "Selected PDF",
        uri: file.uri,
        size: file.size,
      });
    } catch (e) {
      Alert.alert("Picker failed", "Couldn't open the Files picker.");
    }
  };

  const goOpen = async () => {
    if (!picked?.uri) return;
    // Line 94: open with system viewer (not WebBrowser)
    await openPdfWithSystem(picked.uri);
  };

  return (
    <View style={[styles.screen, { paddingTop: topInset }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={18} color="#fff" />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>

        <Text style={styles.title}>PDF pack</Text>
        <Text style={styles.subtitle}>
          Pick a PDF from Files and open it. (This is the real flow we'll use later.)
        </Text>

        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="document-text-outline" size={22} color={ACCENT} />
          </View>
          <Text style={styles.cardTitle}>Choose a PDF</Text>
          <Text style={styles.cardSub}>
            Opens iOS Files picker (iCloud Drive / Downloads / On My iPhone).
          </Text>

          <Pressable onPress={pickPdf} style={[styles.primaryBtn, { backgroundColor: ACCENT }]}>
            <Ionicons name="folder-open-outline" size={18} color="#111" />
            <Text style={styles.primaryBtnText}>Pick PDF from Files</Text>
          </Pressable>
        </View>

        <View style={styles.cardSmall}>
          <Text style={styles.smallTitle}>Photos vs Files</Text>
          <Text style={styles.smallSub}>
            PDFs are normally in Files. Photos is for images. We'll use the image picker on the
            "Blueprint image" screen.
          </Text>
        </View>

        {picked ? (
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <Ionicons name="document-outline" size={22} color={ACCENT} />
            </View>
            <Text style={styles.cardTitle}>{picked.name}</Text>
            <Text style={styles.cardSub}>
              Ready to open{prettySize ? ` • ${prettySize}` : ""}
            </Text>

            <Pressable onPress={goOpen} style={[styles.primaryBtn, { backgroundColor: ACCENT }]}>
              <Ionicons name="open-outline" size={18} color="#111" />
              <Text style={styles.primaryBtnText}>Open PDF</Text>
            </Pressable>

            <Text style={styles.uriText} numberOfLines={2}>
              {picked.uri}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0a0a0a" },
  content: { padding: 18, paddingBottom: 40, gap: 14 },
  headerRow: { flexDirection: "row", justifyContent: "flex-start" },
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
  title: { color: "#fff", fontSize: 34, fontWeight: "700", letterSpacing: -0.5 },
  subtitle: { color: "rgba(255,255,255,0.7)", fontSize: 14, lineHeight: 20 },
  card: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: "#121212",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 10,
  },
  cardSmall: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: "#101010",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 8,
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
  cardSub: { color: "rgba(255,255,255,0.7)", fontSize: 13, lineHeight: 18 },
  primaryBtn: {
    marginTop: 6,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnText: { color: "#111", fontSize: 15, fontWeight: "800" },
  smallTitle: { color: "#fff", fontSize: 14, fontWeight: "700" },
  smallSub: { color: "rgba(255,255,255,0.65)", fontSize: 13, lineHeight: 18 },
  uriText: { color: "rgba(255,255,255,0.45)", fontSize: 11, lineHeight: 16 },
});