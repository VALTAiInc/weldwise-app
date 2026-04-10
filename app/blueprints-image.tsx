import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Image, Alert, Linking } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";

const COLORS = {
  background: "#000000",
  card: "#0b0b0b",
  border: "#141414",
  text: "#ffffff",
  textSecondary: "rgba(255,255,255,0.70)",
  orange: "#fe7725",
};

export default function BlueprintsImageScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topInset = isWeb ? 67 : insets.top;
  const [imageUri, setImageUri] = useState<string | null>(null);

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission required",
        "Photo library access is needed to select a blueprint image.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
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
        <View style={styles.headerArea}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <Text style={styles.headerTitle}>Blueprint image</Text>
          <Text style={styles.headerSub}>Select a blueprint photo from your library.</Text>
        </View>

        <View style={styles.viewer}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.selectedImage} resizeMode="contain" />
          ) : (
            <>
              <View style={styles.iconWrap}>
                <Ionicons name="image-outline" size={44} color={COLORS.orange} />
              </View>
              <Text style={styles.title}>No image selected</Text>
              <Text style={styles.sub}>
                Pick a blueprint photo from your library to view it here.
              </Text>
            </>
          )}

          <Pressable
            onPress={pickImage}
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name={imageUri ? "swap-horizontal-outline" : "cloud-upload-outline"} size={18} color="#fff" />
            <Text style={styles.buttonText}>{imageUri ? "Choose different image" : "Choose image"}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 20,
  },
  headerArea: {
    marginBottom: 18,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  backText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700" as const,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: "900" as const,
    color: COLORS.text,
    marginBottom: 6,
  },
  headerSub: {
    fontSize: 15,
    lineHeight: 21,
    color: COLORS.textSecondary,
  },
  viewer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 26,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 360,
  },
  iconWrap: {
    width: 100,
    height: 100,
    borderRadius: 24,
    backgroundColor: "rgba(254,119,37,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "rgba(254,119,37,0.22)",
  },
  title: {
    fontSize: 20,
    fontWeight: "900" as const,
    color: COLORS.text,
    marginBottom: 8,
  },
  sub: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 20,
  },
  selectedImage: {
    width: "100%",
    height: 300,
    borderRadius: 12,
    marginBottom: 16,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.orange,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900" as const,
    letterSpacing: 0.5,
  },
});