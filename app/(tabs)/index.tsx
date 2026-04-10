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
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import Colors from "../../constants/colors";
import { BRIDGE_API } from "../../constants/api";

const heroImage = require("../../assets/images/HEROIMAGE.jpg");
const logoImage = require("../../assets/images/LOGOVALT.png");

const LANGUAGES = [
  { code: "en", label: "English",   english: "English",    flag: "🇨🇦" },
  { code: "es", label: "Español",   english: "Spanish",    flag: "🇲🇽" },
  { code: "fr", label: "Français",  english: "French",     flag: "🇫🇷" },
  { code: "de", label: "Deutsch",   english: "German",     flag: "🇩🇪" },
  { code: "pt", label: "Português", english: "Portuguese", flag: "🇧🇷" },
  { code: "zh", label: "中文",       english: "Chinese",    flag: "🇨🇳" },
  { code: "ja", label: "日本語",      english: "Japanese",   flag: "🇯🇵" },
  { code: "ko", label: "한국어",      english: "Korean",     flag: "🇰🇷" },
  { code: "ar", label: "العربية",    english: "Arabic",     flag: "🇸🇦" },
  { code: "hi", label: "हिंदी",       english: "Hindi",      flag: "🇮🇳" },
];

function getLang(code: string) {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

// ─── Language Picker — uses Modal so dropdown never clips ─────────────────────

function LangPicker({ value, onChange, flipped }: { value: string; onChange: (c: string) => void; flipped?: boolean }) {
  const [open, setOpen] = useState(false);
  const current = getLang(value);

  return (
    <View style={{ flex: 1 }}>
      <Pressable onPress={() => setOpen(true)} style={tStyles.langButton}>
        <Text style={{ fontSize: 18 }}>{current.flag}</Text>
        <Text style={tStyles.langButtonText}>{current.label}</Text>
        <Text style={tStyles.langChevron}>▼</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={[tStyles.langModalOverlay, flipped && { justifyContent: "flex-start" as const, paddingTop: 60 }]} onPress={() => setOpen(false)}>
          <View style={[tStyles.langModalBox, flipped && { transform: [{ rotate: "180deg" }] }]}>
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
                      {lang.english}
                    </Text>
                    {lang.english !== lang.label && (
                      <Text style={tStyles.langOptionNative}>{lang.label}</Text>
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

// ─── Mic Button ───────────────────────────────────────────────────────────────

function MicButton({
  isRecording, isProcessing, onPress, color, flipped,
}: {
  isRecording: boolean; isProcessing: boolean;
  onPress: () => void; color: string; flipped?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (isRecording) {
      Animated.spring(scale, { toValue: 0.93, useNativeDriver: true }).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.25, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
      pulse.stopAnimation();
      Animated.timing(pulse, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    }
  }, [isRecording]);

  return (
    <View style={[tStyles.micOuter, flipped && { transform: [{ rotate: "180deg" }] }]}>
      <View style={tStyles.micButtonWrap}>
        {isRecording && (
          <Animated.View style={[tStyles.micPulse, { borderColor: color, transform: [{ scale: pulse }] }]} />
        )}
        <Animated.View style={{ transform: [{ scale }] }}>
          <Pressable
            onPress={onPress}
            disabled={isProcessing}
            style={[
              tStyles.micButton,
              { backgroundColor: isRecording ? color : "rgba(255,255,255,0.1)" },
              isProcessing && { opacity: 0.5 },
            ]}
          >
            {isProcessing
              ? <ActivityIndicator size="large" color="#fff" />
              : <Ionicons name={isRecording ? "stop" : "mic"} size={28} color="#fff" />
            }
          </Pressable>
        </Animated.View>
      </View>
      <Text style={[tStyles.micHint, { color: isRecording ? color : "rgba(255,255,255,0.25)" }]}>
        {isProcessing ? "Translating..." : isRecording ? "Tap to translate" : "Tap to speak"}
      </Text>
    </View>
  );
}

// ─── Person Panel ─────────────────────────────────────────────────────────────

function PersonPanel({
  lang, setLang, transcript, translation, targetLang,
  isRecording, isProcessing, onPress,
  color, flipped, onClose,
  typedText, setTypedText, onSendTyped,
}: {
  lang: string; setLang: (c: string) => void;
  transcript: string; translation: string; targetLang: string;
  isRecording: boolean; isProcessing: boolean;
  onPress: () => void;
  color: string; flipped: boolean; onClose: () => void;
  typedText: string; setTypedText: (t: string) => void; onSendTyped: () => void;
}) {
  const content = (
    <View style={[tStyles.panelContent, flipped && { transform: [{ rotate: "180deg" }] }]}>
      <View style={tStyles.panelHeader}>
        <LangPicker value={lang} onChange={setLang} flipped={flipped} />
        <Pressable onPress={onClose} style={tStyles.doneButton}>
          <Text style={tStyles.doneButtonText}>Done</Text>
        </Pressable>
      </View>

      <View style={tStyles.textBox}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {transcript ? (
            <>
              <Text style={tStyles.transcriptLabel}>SAID</Text>
              <Text style={tStyles.transcriptText}>{transcript}</Text>
              {translation ? (
                <>
                  <View style={[tStyles.dividerLine, { backgroundColor: color }]} />
                  <Text style={tStyles.translationText}>{translation}</Text>
                </>
              ) : null}
            </>
          ) : translation ? (
            <Text style={tStyles.translationText}>{translation}</Text>
          ) : (
            <Text style={tStyles.placeholder}>Tap mic to speak</Text>
          )}
        </ScrollView>
      </View>

      <View style={tStyles.typedRow}>
        <TextInput
          value={typedText}
          onChangeText={setTypedText}
          placeholder="Or type here..."
          placeholderTextColor="rgba(255,255,255,0.35)"
          style={tStyles.typedInput}
          editable={!isProcessing}
          onSubmitEditing={onSendTyped}
          returnKeyType="send"
        />
        <Pressable
          onPress={onSendTyped}
          disabled={isProcessing || !typedText.trim()}
          style={[tStyles.sendButton, (isProcessing || !typedText.trim()) && { opacity: 0.5 }]}
        >
          <Text style={tStyles.sendButtonText}>Send</Text>
        </Pressable>
      </View>
    </View>
  );

  const mic = (
    <MicButton
      isRecording={isRecording}
      isProcessing={isProcessing}
      onPress={onPress}
      color={color}
      flipped={flipped}
    />
  );

  return (
    <View style={tStyles.panel}>
      {flipped ? <>{mic}{content}</> : <>{content}{mic}</>}
    </View>
  );
}

// ─── Translator Modal ─────────────────────────────────────────────────────────

function TranslatorModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [langA, setLangA] = useState("en");
  const [langB, setLangB] = useState("es");
  const [aRecording, setARecording] = useState(false);
  const [aProcessing, setAProcessing] = useState(false);
  const [aTranscript, setATranscript] = useState("");
  const [aTranslation, setATranslation] = useState("");
  const [bRecording, setBRecording] = useState(false);
  const [bProcessing, setBProcessing] = useState(false);
  const [bTranscript, setBTranscript] = useState("");
  const [bTranslation, setBTranslation] = useState("");
  const [aTyped, setATyped] = useState("");
  const [bTyped, setBTyped] = useState("");

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const activeSpeakerRef = useRef<"A" | "B" | null>(null);

  const startRecording = useCallback(async (speaker: "A" | "B") => {
    try {
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
      activeSpeakerRef.current = speaker;
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
    activeSpeakerRef.current = null;

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

      const response = await fetch(`${BRIDGE_API}/api/translate`, {
        method: "POST",
        body: formData,
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Translation failed");
      }

      const result = await response.json();
      console.log("[Translate] status:", response.status, "result keys:", Object.keys(result), "transcript:", result.transcript?.slice(0,50), "translation:", result.translation?.slice(0,50));

      if (speaker === "A") {
        setATranscript(result.transcript);
        setBTranslation(result.translation);
        console.log("[Translate] setBTranslation:", result.translation?.slice(0,50));
      } else {
        setBTranscript(result.transcript);
        setATranslation(result.translation);
        console.log("[Translate] setATranslation:", result.translation?.slice(0,50));
      }

      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      const fileUri = (FileSystem.cacheDirectory ?? "") + "ww_translation.mp3";
      await FileSystem.writeAsStringAsync(fileUri, result.audioBase64, { encoding: 'base64' });
      const { sound } = await Audio.Sound.createAsync({ uri: fileUri }, { shouldPlay: true });
      soundRef.current = sound;

    } catch (err: any) {
      speaker === "A" ? setARecording(false) : setBRecording(false);
      Alert.alert("Translation Error", err.message || "Something went wrong.");
    } finally {
      speaker === "A" ? setAProcessing(false) : setBProcessing(false);
    }
  }, [langA, langB]);

  const sendTyped = useCallback(async (speaker: "A" | "B", text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const myLang = speaker === "A" ? langA : langB;
    const theirLang = speaker === "A" ? langB : langA;

    speaker === "A" ? setAProcessing(true) : setBProcessing(true);
    speaker === "A" ? setATyped("") : setBTyped("");

    try {
      const response = await fetch(`${BRIDGE_API}/api/translate-text`, {
        method: "POST",
        body: JSON.stringify({
          text: trimmed,
          sourceLanguage: myLang,
          targetLanguage: theirLang,
          callerApp: "WeldWise",
        }),
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Translation failed");
      }

      const result = await response.json();

      if (speaker === "A") {
        setATranscript(result.transcript ?? trimmed);
        setBTranslation(result.translation);
      } else {
        setBTranscript(result.transcript ?? trimmed);
        setATranslation(result.translation);
      }

      if (result.audioBase64) {
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }
        const fileUri = (FileSystem.cacheDirectory ?? "") + "ww_translation.mp3";
        await FileSystem.writeAsStringAsync(fileUri, result.audioBase64, { encoding: 'base64' });
        const { sound } = await Audio.Sound.createAsync({ uri: fileUri }, { shouldPlay: true });
        soundRef.current = sound;
      }
    } catch (err: any) {
      Alert.alert("Translation Error", err.message || "Something went wrong.");
    } finally {
      speaker === "A" ? setAProcessing(false) : setBProcessing(false);
    }
  }, [langA, langB]);

  const toggleRecording = useCallback((speaker: "A" | "B") => {
    const isCurrentlyRecording = speaker === "A" ? aRecording : bRecording;
    if (isCurrentlyRecording) {
      stopAndTranslate(speaker);
    } else {
      startRecording(speaker);
    }
  }, [aRecording, bRecording, startRecording, stopAndTranslate]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={tStyles.modal}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >

          <PersonPanel
            lang={langB} setLang={setLangB}
            transcript={bTranscript} translation={bTranslation} targetLang={langA}
            isRecording={bRecording} isProcessing={bProcessing}
            onPress={() => toggleRecording("B")}
            color={Colors.primary} flipped={true} onClose={onClose}
            typedText={bTyped} setTypedText={setBTyped}
            onSendTyped={() => sendTyped("B", bTyped)}
          />

          <View style={tStyles.centerDivider}>
            <View style={tStyles.centerDividerLine} />
            <View style={tStyles.centerDividerBadge}>
              <Text style={{ fontSize: 16 }}>🌐</Text>
            </View>
            <View style={tStyles.centerDividerLine} />
          </View>

          <PersonPanel
            lang={langA} setLang={setLangA}
            transcript={aTranscript} translation={aTranslation} targetLang={langB}
            isRecording={aRecording} isProcessing={aProcessing}
            onPress={() => toggleRecording("A")}
            color="#4ECDC4" flipped={false} onClose={onClose}
            typedText={aTyped} setTypedText={setATyped}
            onSendTyped={() => sendTyped("A", aTyped)}
          />

        </KeyboardAvoidingView>
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
        <View style={styles.ctaContainer}>
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/(tabs)/talk");
            }}
            style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaButtonPressed]}
          >
            <Ionicons name="chatbubble-ellipses" size={20} color={Colors.textDark} />
            <Text style={styles.ctaText}>ASK YOUR MENTOR</Text>
          </Pressable>
        </View>
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push("/lockbox");
          }}
          style={({ pressed }) => [styles.lockBoxButton, pressed && styles.lockBoxButtonPressed]}
        >
          <Text style={styles.lockBoxIcon}>⛑️</Text>
          <Text style={styles.lockBoxText}>LOCK BOX TALK</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setTranslatorVisible(true);
          }}
          style={({ pressed }) => [styles.translatorButton, pressed && styles.translatorButtonPressed]}
        >
          <View style={styles.translatorGlobe}>
            <Ionicons name="globe-outline" size={14} color="#fff" />
          </View>
          <Text style={styles.translatorText}>Translator</Text>
        </Pressable>
      </View>

      <TranslatorModal visible={translatorVisible} onClose={() => setTranslatorVisible(false)} />
    </View>
  );
}

// ─── Home Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, paddingHorizontal: 20 },
  logoContainer: { alignItems: "center", marginBottom: 12 },
  logo: { width: 195, height: 68 },
  heroCard: { borderRadius: 26, overflow: "hidden", backgroundColor: Colors.card, marginBottom: 14 },
  heroImage: { width: "100%", height: 235 },
  heroTextBox: { paddingHorizontal: 18, paddingVertical: 16, backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center" },
  heroTitle: { fontSize: 44, color: "#fff", letterSpacing: 3, fontWeight: "900", textAlign: "center" },
  heroSubtitle: { marginTop: 8, fontSize: 20, color: "#cfcfcf", textAlign: "center" },
  ctaContainer: { marginTop: 10, marginBottom: 12 },
  ctaButton: { backgroundColor: Colors.primary, borderRadius: 34, paddingVertical: 16, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  ctaButtonPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  ctaText: { fontSize: 16, color: Colors.textDark, letterSpacing: 0.5, fontWeight: "900" },
  lockBoxButton: { alignSelf: "center", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderWidth: 2, borderColor: Colors.primary, borderRadius: 34, paddingVertical: 13, paddingHorizontal: 36, backgroundColor: "#111", marginBottom: 12 },
  lockBoxButtonPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  lockBoxIcon: { fontSize: 20 },
  lockBoxText: { color: Colors.primary, fontSize: 15, fontWeight: "800", letterSpacing: 0.6 },
  translatorButton: { alignSelf: "center", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 34, paddingVertical: 9, paddingHorizontal: 28, backgroundColor: "#111" },
  translatorButtonPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  translatorGlobe: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  translatorText: { color: Colors.primary, fontSize: 13, fontWeight: "700", letterSpacing: 0.3 },
});

// ─── Translator Styles ────────────────────────────────────────────────────────

const tStyles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: "#0A0A0F" },
  panel: { flex: 1, paddingHorizontal: 20, paddingVertical: 12, justifyContent: "space-between" },
  panelContent: { flex: 1 },
  panelHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  doneButton: { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 16 },
  doneButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  textBox: { flex: 1, marginVertical: 10, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  transcriptLabel: { color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: "600", letterSpacing: 1.2, marginBottom: 4 },
  transcriptText: { color: "rgba(255,255,255,0.55)", fontSize: 13, fontStyle: "italic", lineHeight: 19 },
  dividerLine: { height: 1.5, marginVertical: 8, borderRadius: 1 },
  translationLabel: { color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: "600", letterSpacing: 1.2, marginBottom: 4 },
  translationText: { color: "#fff", fontSize: 17, fontWeight: "700", lineHeight: 24 },
  placeholder: { color: "rgba(255,255,255,0.18)", fontSize: 14, textAlign: "center", fontStyle: "italic" },
  micOuter: { alignItems: "center", justifyContent: "center", paddingVertical: 4 },
  micButtonWrap: { width: 76, height: 76, alignItems: "center", justifyContent: "center" },
  micPulse: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 38, borderWidth: 2 },
  micButton: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.15)" },
  micHint: { marginTop: 6, fontSize: 11, fontWeight: "500" },
  centerDivider: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, height: 32 },
  centerDividerLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.08)" },
  centerDividerBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#1A1A2E", alignItems: "center", justifyContent: "center", marginHorizontal: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  langButton: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, gap: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", width: "100%" },
  langButtonText: { color: "#fff", fontSize: 14, fontWeight: "600", flexShrink: 0 },
  langChevron: { color: "rgba(255,255,255,0.4)", fontSize: 10 },
  langModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 24 },
  langModalBox: { width: "100%", maxHeight: "70%", backgroundColor: "#1A1A2E", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  langModalTitle: { color: "#fff", fontSize: 15, fontWeight: "700", textAlign: "center", marginBottom: 12, letterSpacing: 0.5 },
  langOption: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, gap: 12, borderRadius: 10 },
  langOptionActive: { backgroundColor: "rgba(254,119,37,0.15)" },
  langOptionText: { color: "rgba(255,255,255,0.7)", fontSize: 15, fontWeight: "500" },
  langOptionTextActive: { color: Colors.primary, fontWeight: "700" },
  langOptionNative: { color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 2 },
  typedRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  typedInput: { flex: 1, color: "#fff", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, padding: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  sendButton: { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  sendButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
