// app/(tabs)/index.tsx
import React, { useState, useRef, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  Image,
  Pressable,
  Platform,
  Modal,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  ScrollView,
  Animated,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import Colors from "../../constants/colors";

const heroImage = require("../../assets/images/HEROIMAGE.jpg");
const logoImage = require("../../assets/images/LOGOVALT.png");

const API_BASE = "https://weldwise-backend-gold-production.up.railway.app";

// ─── Languages ────────────────────────────────────────────────────────────────

const LANGUAGES = [
  { code: "en",    label: "English",    native: "English",      flag: "🇺🇸" },
  { code: "es",    label: "Spanish",    native: "Español",      flag: "🇲🇽" },
  { code: "fr",    label: "French",     native: "Français",     flag: "🇫🇷" },
  { code: "de",    label: "German",     native: "Deutsch",      flag: "🇩🇪" },
  { code: "pt",    label: "Portuguese", native: "Português",    flag: "🇧🇷" },
  { code: "zh",    label: "Chinese",    native: "中文",          flag: "🇨🇳" },
  { code: "ja",    label: "Japanese",   native: "日本語",        flag: "🇯🇵" },
  { code: "ko",    label: "Korean",     native: "한국어",        flag: "🇰🇷" },
  { code: "ar",    label: "Arabic",     native: "العربية",      flag: "🇸🇦" },
  { code: "hi",    label: "Hindi",      native: "हिंदी",         flag: "🇮🇳" },
  { code: "fil",   label: "Filipino",   native: "Filipino",     flag: "🇵🇭" },
  { code: "ar-LB", label: "Lebanese",   native: "عربي لبناني",  flag: "🇱🇧" },
  { code: "el",    label: "Greek",      native: "Ελληνικά",     flag: "🇬🇷" },
];

function getLang(code: string | null) {
  if (!code) return { code: "", label: "Select Language", native: "", flag: "🌐" };
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

// ─── Language Picker — centered modal overlay ─────────────────────────────────

function LangPicker({ value, onChange }: { value: string | null; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = getLang(value);

  return (
    <View style={{ flex: 1 }}>
      <Pressable onPress={() => setOpen(true)} style={[tStyles.langButton, !value && { borderColor: "rgba(255,255,255,0.25)" }]}>
        <Text style={{ fontSize: 18 }}>{current.flag}</Text>
        <Text style={[tStyles.langButtonText, !value && { color: "rgba(255,255,255,0.4)", fontStyle: "italic" }]}>{current.label}</Text>
        <Text style={tStyles.langChevron}>▼</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={tStyles.langModalOverlay} onPress={() => setOpen(false)}>
          <View style={tStyles.langModalBox}>
            <Text style={tStyles.langModalTitle}>Select Language</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[tStyles.langOption, lang.code === value && tStyles.langOptionActive]}
                  onPress={() => { onChange(lang.code); setOpen(false); }}
                >
                  <Text style={{ fontSize: 22 }}>{lang.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[tStyles.langOptionText, lang.code === value && tStyles.langOptionTextActive]}>
                      {lang.label}
                    </Text>
                    {lang.native !== lang.label && (
                      <Text style={tStyles.langOptionNative}>{lang.native}</Text>
                    )}
                  </View>
                  {lang.code === value && (
                    <Ionicons name="checkmark" size={18} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Talk Button ──────────────────────────────────────────────────────────────

function TalkButton({
  isRecording, isProcessing, onPress, color, disabled = false,
}: {
  isRecording: boolean; isProcessing: boolean;
  onPress: () => void; color: string; disabled?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const anim_opacity = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(scale, { toValue: 1.05, duration: 600, useNativeDriver: true }),
            Animated.timing(anim_opacity, { toValue: 0.75, duration: 600, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(scale, { toValue: 1.0, duration: 600, useNativeDriver: true }),
            Animated.timing(anim_opacity, { toValue: 1.0, duration: 600, useNativeDriver: true }),
          ]),
        ])
      ).start();
    } else {
      scale.stopAnimation();
      anim_opacity.stopAnimation();
      Animated.parallel([
        Animated.timing(scale, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(anim_opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [isRecording]);

  const handlePress = () => {
    Haptics.impactAsync(
      isRecording ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium
    );
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale }], opacity: anim_opacity }}>
      <Pressable
        onPress={handlePress}
        disabled={isProcessing || disabled}
        style={[
          tStyles.talkButton,
          { borderColor: isRecording ? color : "rgba(255,255,255,0.2)", backgroundColor: isRecording ? color : "rgba(255,255,255,0.06)" },
          (isProcessing || disabled) && { opacity: 0.35 },
        ]}
      >
        {isProcessing
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text style={[tStyles.talkButtonText, { color: isRecording ? "#fff" : "rgba(255,255,255,0.75)" }]}>
              {isRecording ? "Push to Send" : "Push to Talk"}
            </Text>
        }
      </Pressable>
    </Animated.View>
  );
}

// ─── Translator Modal ─────────────────────────────────────────────────────────

function TranslatorModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [langA, setLangA] = useState<string>("en");
  const [langB, setLangB] = useState<string | null>(null);
  const [aRecording, setARecording] = useState(false);
  const [aProcessing, setAProcessing] = useState(false);
  const [aTranscript, setATranscript] = useState("");
  const [aTranslation, setATranslation] = useState("");
  const [bRecording, setBRecording] = useState(false);
  const [bProcessing, setBProcessing] = useState(false);
  const [bTranscript, setBTranscript] = useState("");
  const [bTranslation, setBTranslation] = useState("");

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const clearContent = useCallback(() => {
    setATranscript("");
    setATranslation("");
    setBTranscript("");
    setBTranslation("");
  }, []);

  const handleClose = useCallback(() => {
    clearContent();
    setLangA("en");
    setLangB(null);
    onClose();
  }, [clearContent, onClose]);

  const startRecording = useCallback(async (speaker: "A" | "B") => {
    try {
      setARecording(false);
      setBRecording(false);

      if (recordingRef.current) {
        try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
        recordingRef.current = null;
      }

      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert("Permission required", "Microphone access is needed for translation.");
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      speaker === "A" ? setARecording(true) : setBRecording(true);
    } catch (err) {
      console.error("startRecording:", err);
    }
  }, []);

  const stopAndTranslate = useCallback(async (speaker: "A" | "B") => {
    const recording = recordingRef.current;
    if (!recording) return;

    const myLang = speaker === "A" ? langA : langB;
    const theirLang = speaker === "A" ? langB : langA;

    speaker === "A" ? setARecording(false) : setBRecording(false);
    speaker === "A" ? setAProcessing(true) : setBProcessing(true);

    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      recordingRef.current = null;

      const uri = recording.getURI();
      if (!uri) throw new Error("No recording URI");

      const formData = new FormData();
      formData.append("audio", { uri, name: "recording.m4a", type: "audio/m4a" } as any);
      formData.append("sourceLanguage", myLang);
      formData.append("targetLanguage", theirLang);
      formData.append("callerApp", "WeldWise");

      const response = await fetch(`${API_BASE}/api/translate`, {
        method: "POST",
        body: formData,
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Translation failed");
      }

      const result = await response.json();
      console.log('API result:', JSON.stringify(result));

      if (speaker === "A") {
        setATranscript(result.transcript);
        setBTranslation(result.translation);
      } else {
        setBTranscript(result.transcript);
        setATranslation(result.translation);
      }

      // Play translated audio
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
        const fileUri = (FileSystem.cacheDirectory ?? "") + "ww_translation.mp3";
        await FileSystem.writeAsStringAsync(fileUri, result.audioBase64, {
          encoding: 'base64',
        });
  
      const { sound } = await Audio.Sound.createAsync({ uri: fileUri }, { shouldPlay: true });
      soundRef.current = sound;

    } catch (err: any) {
      Alert.alert("Translation Error", err.message || "Something went wrong.");
    } finally {
      speaker === "A" ? setAProcessing(false) : setBProcessing(false);
    }
  }, [langA, langB]);

  const toggleRecording = useCallback((speaker: "A" | "B") => {
    const isRec = speaker === "A" ? aRecording : bRecording;
    if (isRec) {
      stopAndTranslate(speaker);
    } else {
      startRecording(speaker);
    }
  }, [aRecording, bRecording, startRecording, stopAndTranslate]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={tStyles.modal}>

        {/*
          ┌─────────────────────────┐  ← top of phone (Person B's edge)
          │  Person B panel         │  rotated 180° — B reads this right-side up
          ├─────────────────────────┤  ← center divider
          │  Person A panel         │  no rotation — A reads this right-side up
          └─────────────────────────┘  ← bottom of phone (Person A's edge)

          Within each panel (from that person's perspective, top→bottom):
            [language picker + Done]   ← far from person
            [text box]
            [mic button]               ← closest to person's edge
        */}

        {/* ── Person B — top of screen, rotated 180° for the person across the table ── */}
        <View style={[tStyles.panel, tStyles.panelB]}>
          <View style={tStyles.panelHeader}>
            <LangPicker value={langB} onChange={(c) => { setLangB(c); clearContent(); }} />
          </View>
          <View style={tStyles.textBox}>
            {!langA || !langB ? (
              <Text style={tStyles.placeholder}>Select languages to start</Text>
            ) : bTranscript || bTranslation ? (
              <>
                {bTranscript ? (
                  <>
                    <Text style={tStyles.transcriptLabel}>Said</Text>
                    <Text style={tStyles.transcriptText}>{bTranscript}</Text>
                    {bTranslation ? <View style={[tStyles.dividerLine, { backgroundColor: Colors.primary }]} /> : null}
                  </>
                ) : null}
                {bTranslation ? (
                  <>
                    <Text style={tStyles.translationLabel}>→ {getLang(langB).flag} {getLang(langB).label}</Text>
                    <Text style={tStyles.translationText}>{bTranslation}</Text>
                  </>
                ) : null}
              </>
            ) : (
              <Text style={tStyles.placeholder}>Push to Talk</Text>
            )}
          </View>
          <View style={tStyles.micRow}>
            <TalkButton
              isRecording={bRecording}
              isProcessing={bProcessing}
              onPress={() => toggleRecording("B")}
              color={Colors.primary}
              disabled={!langA || !langB}
            />
            <Pressable onPress={handleClose} style={tStyles.micRowDone}>
              <Text style={tStyles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Center divider ── */}
        <View style={tStyles.centerDivider}>
          <View style={tStyles.centerDividerLine} />
          <View style={tStyles.centerDividerBadge}>
            <Text style={{ fontSize: 16 }}>🌐</Text>
          </View>
          <View style={tStyles.centerDividerLine} />
        </View>

        {/* ── Person A — bottom of screen, normal orientation ── */}
        <View style={tStyles.panel}>
          <View style={tStyles.panelHeader}>
            <LangPicker value={langA} onChange={(c) => { setLangA(c); clearContent(); }} />
          </View>
          <View style={tStyles.textBox}>
            {!langA || !langB ? (
              <Text style={tStyles.placeholder}>Select languages to start</Text>
            ) : aTranscript || aTranslation ? (
              <>
                {aTranscript ? (
                  <>
                    <Text style={tStyles.transcriptLabel}>Said</Text>
                    <Text style={tStyles.transcriptText}>{aTranscript}</Text>
                    {aTranslation ? <View style={[tStyles.dividerLine, { backgroundColor: "#4ECDC4" }]} /> : null}
                  </>
                ) : null}
                {aTranslation ? (
                  <>
                    <Text style={tStyles.translationLabel}>→ {getLang(langA).flag} {getLang(langA).label}</Text>
                    <Text style={tStyles.translationText}>{aTranslation}</Text>
                  </>
                ) : null}
              </>
            ) : (
              <Text style={tStyles.placeholder}>Push to Talk</Text>
            )}
          </View>
          <View style={tStyles.micRow}>
            <TalkButton
              isRecording={aRecording}
              isProcessing={aProcessing}
              onPress={() => toggleRecording("A")}
              color="#4ECDC4"
              disabled={!langA || !langB}
            />
            <Pressable onPress={handleClose} style={tStyles.micRowDone}>
              <Text style={tStyles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>

      </SafeAreaView>
    </Modal>
  );
}

// ─── Home Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [translatorVisible, setTranslatorVisible] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : Math.max(insets.top + 12, 24);
  const bottomPad = Math.max(insets.bottom, 14) + 92;

  const handleAskMentor = () => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/(tabs)/talk");
  };

  const handleTranslator = () => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTranslatorVisible(true);
  };

  return (
    <View style={[styles.container, { paddingTop: topPad, paddingBottom: bottomPad }]}>
      <View style={styles.content}>

        <View style={styles.logoContainer}>
          <Image source={logoImage} style={styles.logo} resizeMode="contain" />
        </View>

        <View style={styles.heroCard}>
          <Image source={heroImage} style={styles.heroImage} resizeMode="cover" />
          <View style={styles.heroTextBox}>
            <Text style={styles.heroTitle}>WELDWISE</Text>
            <Text style={styles.heroSubtitle}>Mentor in your pocket</Text>
          </View>
        </View>

        {/* Ask Your Mentor — dominant CTA */}
        <View style={styles.ctaContainer}>
          <Pressable
            onPress={handleAskMentor}
            style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaButtonPressed]}
          >
            <Ionicons name="chatbubble-ellipses" size={20} color={Colors.textDark} />
            <Text style={styles.ctaText}>ASK YOUR MENTOR</Text>
          </Pressable>
        </View>

        {/* Translator — slim secondary pill */}
        <Pressable
          onPress={handleTranslator}
          style={({ pressed }) => [styles.translatorButton, pressed && styles.translatorButtonPressed]}
        >
          <View style={styles.translatorGlobe}>
            <Ionicons name="globe-outline" size={14} color="#fff" />
          </View>
          <Text style={styles.translatorText}>Translator</Text>
        </Pressable>

      </View>

      <TranslatorModal
        visible={translatorVisible}
        onClose={() => setTranslatorVisible(false)}
      />
    </View>
  );
}

// ─── Home Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, paddingHorizontal: 20 },

  logoContainer: { alignItems: "center", marginBottom: 12 },
  logo: { width: 195, height: 68 },

  heroCard: {
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: Colors.card,
    marginBottom: 14,
  },
  heroImage: { width: "100%", height: 235 },
  heroTextBox: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
  },
  heroTitle: {
    fontSize: 44,
    color: "#fff",
    letterSpacing: 3,
    fontWeight: "900",
    textAlign: "center",
  },
  heroSubtitle: {
    marginTop: 8,
    fontSize: 20,
    color: "#cfcfcf",
    textAlign: "center",
  },

  ctaContainer: { marginTop: 10, marginBottom: 12 },
  ctaButton: {
    backgroundColor: Colors.primary,
    borderRadius: 34,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  ctaButtonPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  ctaText: {
    fontSize: 16,
    color: Colors.textDark,
    letterSpacing: 0.5,
    fontWeight: "900",
  },

  // Translator pill
  translatorButton: {
    alignSelf: "center",
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 34,
    paddingVertical: 9,
    paddingHorizontal: 28,
    backgroundColor: "#111",
  },
  translatorButtonPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  translatorGlobe: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  translatorText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});

// ─── Translator Modal Styles ──────────────────────────────────────────────────

const tStyles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: "#0A0A0F" },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  modalTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  closeButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  closeButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  panel: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: "space-between",
  },
  panelB: {
    transform: [{ rotate: "180deg" }],
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  speakerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  speakerBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  speakerBadgeText: { color: "#fff", fontWeight: "800", fontSize: 14 },

  textBox: {
    flex: 2,
    marginVertical: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    justifyContent: "center",
  },
  transcriptLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  transcriptText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 14,
    fontStyle: "italic",
    lineHeight: 20,
  },
  dividerLine: { height: 1.5, marginVertical: 8, borderRadius: 1 },
  translationLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  translationText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
  placeholder: {
    color: "rgba(255,255,255,0.2)",
    fontSize: 14,
    textAlign: "center",
    fontStyle: "italic",
  },

  micRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  talkButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 30,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 160,
  },
  talkButtonText: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  micRowDone: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 30,
    opacity: 0.5,
  },
  micOuter: { alignItems: "center", justifyContent: "center", height: 80 },
  micPulse: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
  },
  micButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.15)",
  },

  centerDivider: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    height: 36,
  },
  centerDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  centerDividerBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#1A1A2E",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },

  langButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  langButtonText: { color: "#fff", fontSize: 13, fontWeight: "600", flex: 1 },
  langChevron: { color: "rgba(255,255,255,0.4)", fontSize: 9 },
  langModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  langModalBox: {
    width: "100%",
    backgroundColor: "#1A1A2E",
    borderRadius: 20,
    paddingTop: 20,
    paddingBottom: 8,
    maxHeight: 480,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  langModalTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  langOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  langOptionActive: { backgroundColor: "rgba(254,119,37,0.15)" },
  langOptionText: { color: "rgba(255,255,255,0.9)", fontSize: 16, fontWeight: "600" },
  langOptionTextActive: { color: Colors.primary, fontWeight: "700" },
  langOptionNative: { color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 1 },
});
