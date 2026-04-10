// app/lockbox.tsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import Colors from "../constants/colors";
import { loadProfile, WorkerProfile } from "../constants/workerProfile";
import * as FileSystem from "expo-file-system/legacy";
import { BRIDGE_API, HR_API } from "../constants/api";

const BACKGROUND = "#0A0A0F";

const QUESTIONS = [
  "What job site are you on today?",
  "What work are you performing this shift?",
  "What materials or equipment are you working with?",
  "Anything unusual or out of the ordinary on site today?",
];

function formatToday() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function greetingForHour() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function LockBoxScreen() {
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [answers, setAnswers] = useState<string[]>(Array(QUESTIONS.length).fill(""));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [draft, setDraft] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    loadProfile().then(setProfile).catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  async function speakText(text: string) {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync().catch(() => {});
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      const res = await fetch(`${HR_API}/api/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId: "65dhNaIr3Y4ovumVtdy0" }),
      });
      if (!res.ok) throw new Error("speak " + res.status);
      const arrayBuffer = await res.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(
          null,
          Array.from(bytes.subarray(i, i + chunkSize))
        );
      }
      const audioBase64 = btoa(binary);
      if (!audioBase64) throw new Error("no audio");

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
      });

      const fileUri = (FileSystem.cacheDirectory ?? "") + "lockbox_tts.mp3";
      await FileSystem.writeAsStringAsync(fileUri, audioBase64, {
        encoding: "base64",
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri: fileUri },
        { shouldPlay: true }
      );
      soundRef.current = sound;
    } catch (error) {
      console.error("[LOCKBOX TTS] error:", error);
    }
  }


  const allAnswered = currentIndex >= QUESTIONS.length;

  const submitAnswer = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setAnswers((prev) => {
      const next = [...prev];
      next[currentIndex] = trimmed;
      return next;
    });
    setDraft("");
    setCurrentIndex((i) => i + 1);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  };

  const startRecording = useCallback(async () => {
    try {
      if (recordingRef.current) {
        try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
        recordingRef.current = null;
      }
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert("Permission required", "Microphone access is needed.");
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (err) {
      console.error("startRecording:", err);
    }
  }, []);

  const stopAndTranscribe = useCallback(async () => {
    const recording = recordingRef.current;
    if (!recording) return;
    setIsRecording(false);
    setIsProcessing(true);
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      recordingRef.current = null;

      const uri = recording.getURI();
      if (!uri) throw new Error("No recording URI");

      const formData = new FormData();
      formData.append("audio", { uri, name: "recording.m4a", type: "audio/m4a" } as any);
      formData.append("language", "en");

      const response = await fetch(`${BRIDGE_API}/api/transcribe`, {
        method: "POST",
        body: formData,
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Transcription failed");
      }
      const result = await response.json();
      const text = (result.transcript || "").trim();
      if (text) submitAnswer(text);
    } catch (err: any) {
      Alert.alert("Voice Error", err.message || "Could not transcribe audio.");
    } finally {
      setIsProcessing(false);
    }
  }, [currentIndex]);

  const toggleRecording = () => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isRecording) stopAndTranscribe();
    else startRecording();
  };

  const buildReportText = () => {
    const today = formatToday();
    const lines: string[] = [];
    lines.push("LOCK BOX TALK — PRE-SHIFT BRIEFING");
    lines.push(today);
    lines.push("");
    if (profile) {
      lines.push(`Worker: ${profile.name}`);
      if (profile.trade) lines.push(`Trade: ${profile.trade}`);
      if (profile.certificationLevel) lines.push(`Certification: ${profile.certificationLevel}`);
      if (profile.employer) lines.push(`Employer: ${profile.employer}`);
      if (profile.unionLocal) lines.push(`Union Local: ${profile.unionLocal}`);
      lines.push("");
    }
    QUESTIONS.forEach((q, i) => {
      lines.push(`Q: ${q}`);
      lines.push(`A: ${answers[i] || "—"}`);
      lines.push("");
    });
    lines.push("---");
    lines.push("This report was generated by WeldWise AI and is not a certified safety inspection. For reference purposes only.");
    return lines.join("\n");
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: buildReportText() });
    } catch (err: any) {
      Alert.alert("Share Error", err.message || "Could not open share sheet.");
    }
  };

  const workerName = profile?.name?.split(" ")[0] || "there";

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>⛑️ Lock Box Talk</Text>
        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.greeting}>
            {greetingForHour()} {workerName}
          </Text>
          <Text style={styles.date}>{formatToday()}</Text>

          {QUESTIONS.map((q, i) => {
            if (i > currentIndex) return null;
            return (
              <View key={i} style={styles.qaBlock}>
                <View style={styles.botBubble}>
                  <Pressable
                    onPress={() => speakText(q)}
                    style={styles.listenPill}
                  >
                    <Ionicons name="play-circle" size={18} color={Colors.primary} />
                    <Text style={styles.listenPillText}>Listen</Text>
                  </Pressable>
                  <Text style={styles.botBubbleText}>{q}</Text>
                </View>
                {answers[i] ? (
                  <View style={styles.userBubble}>
                    <Text style={styles.userBubbleText}>{answers[i]}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}

          {showReport && (
            <View style={styles.reportCard}>
              <Text style={styles.reportTitle}>PRE-SHIFT BRIEFING</Text>
              <Text style={styles.reportDate}>{formatToday()}</Text>

              {profile && (
                <View style={styles.reportSection}>
                  <Text style={styles.reportRow}>
                    <Text style={styles.reportLabel}>Worker: </Text>
                    {profile.name}
                  </Text>
                  {!!profile.trade && (
                    <Text style={styles.reportRow}>
                      <Text style={styles.reportLabel}>Trade: </Text>
                      {profile.trade}
                    </Text>
                  )}
                  {!!profile.certificationLevel && (
                    <Text style={styles.reportRow}>
                      <Text style={styles.reportLabel}>Certification: </Text>
                      {profile.certificationLevel}
                    </Text>
                  )}
                  {!!profile.employer && (
                    <Text style={styles.reportRow}>
                      <Text style={styles.reportLabel}>Employer: </Text>
                      {profile.employer}
                    </Text>
                  )}
                  {!!profile.unionLocal && (
                    <Text style={styles.reportRow}>
                      <Text style={styles.reportLabel}>Union Local: </Text>
                      {profile.unionLocal}
                    </Text>
                  )}
                </View>
              )}

              <View style={styles.reportDivider} />

              {QUESTIONS.map((q, i) => (
                <View key={i} style={styles.reportQA}>
                  <Text style={styles.reportQ}>{q}</Text>
                  <Text style={styles.reportA}>{answers[i] || "—"}</Text>
                </View>
              ))}
            </View>
          )}

          {showReport && (
            <>
              <Text style={styles.disclaimer}>
                This report was generated by WeldWise AI and is not a certified safety inspection. For reference purposes only.
              </Text>
              <Pressable
                onPress={handleShare}
                style={({ pressed }) => [styles.shareButton, pressed && { opacity: 0.85 }]}
              >
                <Ionicons name="share-outline" size={18} color="#fff" />
                <Text style={styles.shareButtonText}>Share Report</Text>
              </Pressable>
            </>
          )}
        </ScrollView>

        {!showReport && (
          <View style={styles.inputBar}>
            {allAnswered ? (
              <Pressable
                onPress={() => {
                  if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setShowReport(true);
                }}
                style={({ pressed }) => [styles.generateButton, pressed && { opacity: 0.9 }]}
              >
                <Text style={styles.generateButtonText}>Generate Report</Text>
              </Pressable>
            ) : (
              <View style={styles.composerRow}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Type your answer..."
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  style={styles.composerInput}
                  editable={!isProcessing}
                  onSubmitEditing={() => submitAnswer(draft)}
                  returnKeyType="send"
                  multiline
                />
                <Pressable
                  onPress={toggleRecording}
                  disabled={isProcessing}
                  style={[
                    styles.micButton,
                    { backgroundColor: isRecording ? Colors.primary : "rgba(255,255,255,0.1)" },
                    isProcessing && { opacity: 0.5 },
                  ]}
                >
                  {isProcessing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Ionicons name={isRecording ? "stop" : "mic"} size={22} color="#fff" />
                  )}
                </Pressable>
                <Pressable
                  onPress={() => submitAnswer(draft)}
                  disabled={isProcessing || !draft.trim()}
                  style={[
                    styles.sendButton,
                    (isProcessing || !draft.trim()) && { opacity: 0.5 },
                  ]}
                >
                  <Text style={styles.sendButtonText}>Send</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "700", letterSpacing: 0.3 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 24 },
  greeting: { color: "#fff", fontSize: 24, fontWeight: "800" },
  date: { color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 4, marginBottom: 18 },
  qaBlock: { marginBottom: 14 },
  botBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#1A1A24",
    borderRadius: 16,
    borderTopLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 11,
    maxWidth: "85%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  botBubbleText: { color: "#fff", fontSize: 15, lineHeight: 21 },
  listenPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginBottom: 8,
    backgroundColor: "rgba(254,119,37,0.15)",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  listenPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.primary,
    marginLeft: 6,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: Colors.primary,
    borderRadius: 16,
    borderTopRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 11,
    maxWidth: "85%",
    marginTop: 8,
  },
  userBubbleText: { color: "#fff", fontSize: 15, lineHeight: 21, fontWeight: "600" },
  inputBar: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 18 : 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    backgroundColor: BACKGROUND,
  },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  composerInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    color: "#fff",
    backgroundColor: "#15151C",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: "#26262E",
    fontSize: 15,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.15)",
  },
  sendButton: {
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  generateButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  generateButtonText: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.5 },
  reportCard: {
    marginTop: 16,
    backgroundColor: "#15151C",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  reportTitle: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.2,
    textAlign: "center",
  },
  reportDate: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 14,
  },
  reportSection: { gap: 4 },
  reportRow: { color: "#fff", fontSize: 14, lineHeight: 20 },
  reportLabel: { color: "rgba(255,255,255,0.5)", fontWeight: "700" },
  reportDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginVertical: 14,
  },
  reportQA: { marginBottom: 12 },
  reportQ: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "700", marginBottom: 4 },
  reportA: { color: "#fff", fontSize: 15, lineHeight: 21 },
  disclaimer: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    textAlign: "center",
    marginTop: 14,
    marginBottom: 14,
    fontStyle: "italic",
    paddingHorizontal: 12,
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 8,
  },
  shareButtonText: { color: "#fff", fontSize: 15, fontWeight: "800", letterSpacing: 0.4 },
});
