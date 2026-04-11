// app/(tabs)/blueprints.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Linking,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";

// LINE 15: robust import that works whether colors.ts exports Brand as named or default
import * as ColorsModule from "../../constants/colors";

// LINE 18-30: fallbacks so the app never whitescreens from a missing export
const Brand: any =
  (ColorsModule as any).Brand ??
  (ColorsModule as any).default ??
  (ColorsModule as any).Colors ??
  {};

const ACCENT = Brand.orange ?? "#fe7725";

const STORAGE_KEY = "savedBlueprints";

type SavedDoc = { title: string; uri: string };

export default function BlueprintsScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topInset = isWeb ? 67 : insets.top;

  const [savedDocs, setSavedDocs] = useState<SavedDoc[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try { setSavedDocs(JSON.parse(raw)); } catch {}
      }
    });
  }, []);

  async function addDocument() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled) return;
      const file = res.assets?.[0];
      if (!file?.uri) return;
      const doc: SavedDoc = { title: file.name ?? "PDF Document", uri: file.uri };
      const updated = [...savedDocs, doc];
      setSavedDocs(updated);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      Alert.alert("Picker failed", "Couldn't open the Files picker.");
    }
  }

  async function removeDocument(index: number) {
    const updated = savedDocs.filter((_, i) => i !== index);
    setSavedDocs(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  async function openDocument(doc: SavedDoc) {
    console.log("[BLUEPRINTS] opening doc:", doc.uri);
    try {
      if (doc.uri.startsWith("file://")) {
        const available = await Sharing.isAvailableAsync();
        if (available) {
          await Sharing.shareAsync(doc.uri, { mimeType: "application/pdf" });
        } else {
          Alert.alert("Cannot open", "Sharing is not available on this device.");
        }
      } else {
        await Linking.openURL(doc.uri);
      }
    } catch (e: any) {
      Alert.alert("Open failed", e?.message || "Could not open the document.");
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: topInset + 12,
            paddingBottom: (isWeb ? 24 : insets.bottom) + 120,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headerTitle}>Blueprints</Text>
        <Text style={styles.headerSub}>
          Your documents, manuals, and blueprints in one place.
        </Text>

        <Text style={styles.sectionTitle}>Quick actions</Text>

        <View style={styles.card}>
          {/* Add a blueprint image */}
          <Pressable
            onPress={() => router.push("/blueprints-image")}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="cloud-upload-outline" size={20} color={ACCENT} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Add a blueprint image</Text>
              <Text style={styles.rowSub}>
                Demo placeholder (connect to image picker)
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={18} color="#5a5a5a" />
          </Pressable>

          <View style={styles.divider} />

          {/* Open demo PDF pack */}
          <Pressable
            onPress={() => router.push("/blueprints-pdf-pack")}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="document-text-outline" size={20} color={ACCENT} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Open demo PDF pack</Text>
              <Text style={styles.rowSub}>
                Demo placeholder (connect to PDF viewer)
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={18} color="#5a5a5a" />
          </Pressable>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 22 }]}>My Documents</Text>

        {savedDocs.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.iconCircle}>
              <Ionicons name="document-outline" size={24} color={ACCENT} />
            </View>
            <Text style={styles.emptyTitle}>No documents yet</Text>
            <Text style={styles.emptySub}>Tap + Add Document to upload your first PDF</Text>
          </View>
        ) : (
          <View style={styles.pinned}>
            {savedDocs.map((doc, i) => (
              <Pressable
                key={`${doc.title}-${i}`}
                onPress={() => openDocument(doc)}
                onLongPress={() => {
                  Alert.alert("Delete document?", doc.title, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: () => removeDocument(i) },
                  ]);
                }}
                style={({ pressed }) => [styles.pinnedRow, pressed && styles.rowPressed]}
              >
                <View style={styles.thumb}>
                  <Ionicons name="document-text" size={22} color={ACCENT} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pinnedTitle} numberOfLines={1}>{doc.title}</Text>
                  <Text style={styles.pinnedSub}>Tap to open · Long press to delete</Text>
                </View>
                <Ionicons name="open-outline" size={16} color="#5a5a5a" />
              </Pressable>
            ))}
          </View>
        )}

        <Pressable
          onPress={addDocument}
          style={({ pressed }) => [styles.addDocButton, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="add-circle-outline" size={20} color="#fff" />
          <Text style={styles.addDocText}>Add Document</Text>
        </Pressable>

        <Text style={[styles.sectionTitle, { marginTop: 22 }]}>Reference Manuals</Text>

        <View style={styles.pinned}>
          <Pressable
            onPress={() => Linking.openURL("https://www.millerwelds.com/files/owners-manuals/o257798c_mil.pdf")}
            style={({ pressed }) => [styles.pinnedRow, pressed && styles.rowPressed]}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="book-outline" size={20} color={ACCENT} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pinnedTitle}>Continuum 350 & 500 Manual</Text>
              <Text style={styles.pinnedSub}>Original owner's manual with diagrams</Text>
              <Text style={styles.browserLabel}>Opens in browser</Text>
            </View>
            <Ionicons name="open-outline" size={16} color="#5a5a5a" />
          </Pressable>

          <Pressable
            onPress={() => Linking.openURL("https://www.millerwelds.com/files/owners-manuals/O277115F_MIL.pdf")}
            style={({ pressed }) => [styles.pinnedRow, pressed && styles.rowPressed]}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="book-outline" size={20} color={ACCENT} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pinnedTitle}>Auto-Continuum 350 & 500 Manual</Text>
              <Text style={styles.pinnedSub}>w/ Insight Core — updated 2019</Text>
              <Text style={styles.browserLabel}>Opens in browser</Text>
            </View>
            <Ionicons name="open-outline" size={16} color="#5a5a5a" />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Brand.background ?? "#000",
  },
  content: {
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 40,
    fontWeight: "800" as const,
    color: Brand.text ?? "#fff",
    marginBottom: 6,
  },
  headerSub: {
    fontSize: 16,
    color: Brand.textSecondary ?? "rgba(255,255,255,0.65)",
    marginBottom: 18,
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: "800" as const,
    color: Brand.text ?? "#fff",
    marginBottom: 12,
  },
  card: {
    borderRadius: 18,
    backgroundColor: Brand.card ?? "#111",
    borderWidth: 1,
    borderColor: Brand.border ?? "#222",
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 14,
    gap: 12,
  },
  rowPressed: {
    opacity: 0.75,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(210,106,11,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(210,106,11,0.22)",
  },
  rowTitle: {
    fontSize: 18,
    fontWeight: "800" as const,
    color: Brand.text ?? "#fff",
  },
  rowSub: {
    fontSize: 14,
    color: Brand.textSecondary ?? "rgba(255,255,255,0.65)",
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Brand.border ?? "#222",
    opacity: 0.9,
  },
  pinned: {
    borderRadius: 18,
    backgroundColor: Brand.card ?? "#111",
    borderWidth: 1,
    borderColor: Brand.border ?? "#222",
    overflow: "hidden",
  },
  pinnedRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 14,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: Brand.border ?? "#222",
  },
  thumb: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: Brand.border ?? "#222",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  thumbLine: {
    width: 30,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(210,106,11,0.45)",
  },
  pinnedTitle: {
    fontSize: 18,
    fontWeight: "800" as const,
    color: Brand.text ?? "#fff",
  },
  pinnedSub: {
    fontSize: 14,
    color: Brand.textSecondary ?? "rgba(255,255,255,0.65)",
    marginTop: 2,
  },
  browserLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
    marginTop: 3,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderRadius: 18,
    backgroundColor: Brand.card ?? "#111",
    borderWidth: 1,
    borderColor: Brand.border ?? "#222",
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700" as const,
    color: Brand.text ?? "#fff",
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    color: Brand.textSecondary ?? "rgba(255,255,255,0.65)",
    marginTop: 4,
    textAlign: "center",
  },
  addDocButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
  },
  addDocText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800" as const,
  },
});