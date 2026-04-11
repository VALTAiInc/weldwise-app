// app/lockbox.tsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
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
import { WELDWISE_API } from "../constants/api";

const BG = "#0A0A0F";

type Role = "user" | "assistant";
type Msg = { id: string; role: Role; content: string };

function uid() {
  return Date.now() + "_" + Math.random().toString(16).slice(2);
}

function formatToday() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function buildSystemPrompt(profile: WorkerProfile | null) {
  return `You are WeldWise Lock Box Talk, a pre-shift safety briefing AI for skilled trades workers. Your job is to conduct a friendly, professional pre-shift safety conversation with the worker. You already know their profile:
- Name: ${profile?.name || "Unknown"}
- Trade: ${profile?.trade || "Unknown"}
- Certification: ${profile?.certificationLevel || "Unknown"}
- Employer: ${profile?.employer || "Unknown"}
- Union: ${profile?.unionLocal || "Unknown"}

Today's date is ${formatToday()}.

Start by greeting them by first name and today's date. Then naturally guide them through these key safety areas in a conversational way (not as a rigid list):
- Job site location today
- Work being performed this shift
- Materials and equipment
- Any hazards or unusual conditions
- PPE confirmation

Ask one thing at a time. Be warm, professional, and trade-specific. When you have gathered enough information (usually after 4-6 exchanges), offer to generate their pre-shift safety report by saying exactly: 'Ready to generate your safety report? Just say yes and I will create it for you.'

When they say yes, generate a complete professional pre-shift safety briefing as plain text with no markdown, no bullet points, no bold text. Use short paragraphs only.

Format rules:
- Plain text only
- No markdown
- No headings
- No bullet lists
- No bold or special formatting
- Short, clean paragraphs only`;
}

function isReportMessage(text: string): boolean {
  const lower = text.toLowerCase();
  const signals = [
    "pre-shift safety briefing",
    "safety report",
    "pre-shift briefing",
    "hazard assessment",
    "ppe requirements",
    "stay safe",
  ];
  let matches = 0;
  for (const s of signals) {
    if (lower.includes(s)) matches++;
  }
  return matches >= 2;
}

function getMimeFromUri(uri: string) {
  const u = uri.toLowerCase();
  if (u.endsWith(".m4a")) return "audio/m4a";
  if (u.endsWith(".mp3")) return "audio/mpeg";
  if (u.endsWith(".wav")) return "audio/wav";
  if (u.endsWith(".aac")) return "audio/aac";
  if (u.endsWith(".3gp")) return "audio/3gpp";
  return Platform.OS === "ios" ? "audio/m4a" : "audio/3gpp";
}

export default function LockBoxScreen() {
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [ttsStatus, setTtsStatus] = useState<"idle" | "loading" | "playing">("idle");
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);

  const systemPromptRef = useRef<string>("");
  const didInitRef = useRef(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    loadProfile()
      .then((p) => {
        console.log("[LOCKBOX] profile loaded:", JSON.stringify(p));
        setProfile(p);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  // Start conversation once profile loads
  useEffect(() => {
    if (didInitRef.current) return;
    if (profile === null) return;
    didInitRef.current = true;

    const sysPrompt = buildSystemPrompt(profile);
    systemPromptRef.current = sysPrompt;

    sendToChat([], sysPrompt);
  }, [profile]);

  function addMessage(role: Role, content: string): Msg {
    const msg: Msg = { id: uid(), role, content };
    setMessages((prev) => [...prev, msg]);

    return msg;
  }

  async function sendToChat(history: Msg[], systemPrompt?: string) {
    setIsProcessing(true);
    try {
      const sys = systemPrompt || systemPromptRef.current;
      const payload = {
        messages: history.length === 0
          ? [{ role: "user", content: "Hello, ready for my pre-shift briefing." }]
          : history.map((m) => ({ role: m.role, content: m.content })),
        profile: profile ? {
          name: profile.name,
          trade: profile.trade,
          certificationLevel: profile.certificationLevel,
          employer: profile.employer,
          unionLocal: profile.unionLocal,
        } : undefined,
      };

      const res = await fetch(`${WELDWISE_API}/api/lockbox`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("chat " + res.status);
      const data = (await res.json()) as { content?: string };
      const reply = (data?.content || "").trim() || "No response.";
      addMessage("assistant", reply);
    } catch (e: any) {
      console.error("[LOCKBOX] chat error:", e);
      addMessage("assistant", "Having trouble connecting. Please check your connection and try again.");
    } finally {
      setIsProcessing(false);
    }
  }

  function cancelEdit() {
    setEditingMsgId(null);
    setInput("");
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isProcessing) return;

    if (editingMsgId) {
      const idx = messages.findIndex((m) => m.id === editingMsgId);
      if (idx === -1) return;
      const prior = messages.slice(0, idx);
      const userMsg: Msg = { id: uid(), role: "user", content: trimmed };
      const updated = [...prior, userMsg];
      setMessages(updated);
      setEditingMsgId(null);
      setInput("");
  
      await sendToChat(updated);
      return;
    }

    const userMsg: Msg = { id: uid(), role: "user", content: trimmed };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");


    await sendToChat(updated);
  }

  // TTS
  async function stopAnyTTS() {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    } catch {}
    setTtsStatus("idle");
    setPlayingMsgId(null);
  }

  async function playMsgTTS(msgId: string, text: string) {
    if (playingMsgId === msgId && ttsStatus === "playing") {
      await stopAnyTTS();
      return;
    }
    await stopAnyTTS();
    setPlayingMsgId(msgId);
    setTtsStatus("loading");
    try {
      const res = await fetch(`${WELDWISE_API}/api/speak`, {
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
      await FileSystem.writeAsStringAsync(fileUri, audioBase64, { encoding: "base64" });
      const { sound } = await Audio.Sound.createAsync(
        { uri: fileUri },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      setTtsStatus("playing");
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          stopAnyTTS();
        }
      });
    } catch (error) {
      console.error("[LOCKBOX TTS] error:", error);
      setTtsStatus("idle");
      setPlayingMsgId(null);
    }
  }

  // Voice recording
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
      const mime = getMimeFromUri(uri);
      const filename = uri.split("/").pop() || "recording.m4a";
      formData.append("audio", { uri, name: filename, type: mime } as any);
      formData.append("language", "en");

      const response = await fetch(`${WELDWISE_API}/api/transcribe`, {
        method: "POST",
        body: formData,
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Transcription failed");
      }
      const result = await response.json();
      const text = (result.transcript || result.text || "").trim();
      if (text) {
        const userMsg: Msg = { id: uid(), role: "user", content: text };
        const updated = [...messages, userMsg];
        setMessages(updated);
    
        setIsProcessing(false);
        await sendToChat(updated);
        return;
      } else {
        addMessage("assistant", "I didn't catch that clearly. Try again a little closer to the mic.");
      }
    } catch (err: any) {
      Alert.alert("Voice Error", err.message || "Could not transcribe audio.");
    } finally {
      setIsProcessing(false);
    }
  }, [messages]);

  const toggleRecording = () => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isRecording) stopAndTranscribe();
    else startRecording();
  };

  const handleShare = async (text: string) => {
    try {
      await Share.share({ message: text });
    } catch (err: any) {
      Alert.alert("Share Error", err.message || "Could not open share sheet.");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss} pointerEvents="box-none">
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
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {messages.map((m) => (
            <Pressable
              key={m.id}
              onPress={m.role === "user" ? () => { setEditingMsgId(m.id); setInput(m.content); } : undefined}
              style={[
                styles.bubble,
                m.role === "assistant" ? styles.bubbleAi : styles.bubbleUser,
              ]}
            >
              {m.role === "assistant" && (
                <Pressable
                  onPress={() => playMsgTTS(m.id, m.content)}
                  style={styles.listenPill}
                >
                  {playingMsgId === m.id && ttsStatus === "loading" ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <Ionicons
                      name={
                        playingMsgId === m.id && ttsStatus === "playing"
                          ? "pause-circle"
                          : "play-circle"
                      }
                      size={18}
                      color={Colors.primary}
                    />
                  )}
                  <Text style={styles.listenPillText}>
                    {playingMsgId === m.id && ttsStatus === "loading"
                      ? "Loading..."
                      : playingMsgId === m.id && ttsStatus === "playing"
                        ? "Playing..."
                        : "Listen"}
                  </Text>
                </Pressable>
              )}
              <Text style={styles.bubbleText}>{m.content}</Text>
              {m.role === "assistant" && isReportMessage(m.content) && (
                <Pressable
                  onPress={() => handleShare(m.content)}
                  style={styles.sharePill}
                >
                  <Ionicons name="share-outline" size={16} color="#fff" />
                  <Text style={styles.sharePillText}>Share Report</Text>
                </Pressable>
              )}
              {m.role === "user" && (
                <View style={styles.editHint}>
                  <Ionicons name="pencil" size={12} color="rgba(255,255,255,0.35)" />
                  <Text style={styles.editHintText}>Edit</Text>
                </View>
              )}
            </Pressable>
          ))}

          {isProcessing && (
            <View style={[styles.bubble, styles.bubbleAi]}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          )}
        </ScrollView>

        <View style={styles.inputBar}>
          {editingMsgId && (
            <View style={styles.editingBar}>
              <Text style={styles.editingBarText}>Editing...</Text>
              <Pressable onPress={cancelEdit} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.5)" />
              </Pressable>
            </View>
          )}
          <View style={styles.inputRow}>
          <Pressable
            onPress={toggleRecording}
            disabled={isProcessing}
            style={[
              styles.micBtn,
              { backgroundColor: isRecording ? Colors.primary : "rgba(255,255,255,0.1)" },
              isProcessing && { opacity: 0.5 },
            ]}
          >
            {isProcessing && isRecording ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons name={isRecording ? "stop" : "mic"} size={22} color="#fff" />
            )}
          </Pressable>

          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Type your answer..."
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={styles.textInput}
            editable={!isProcessing}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            multiline
          />

          <Pressable
            onPress={handleSend}
            disabled={isProcessing || !input.trim()}
            style={[
              styles.sendBtn,
              (isProcessing || !input.trim()) && { opacity: 0.5 },
            ]}
          >
            <Text style={styles.sendBtnText}>{editingMsgId ? "Resend" : "Send"}</Text>
          </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
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
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
  bubble: {
    padding: 14,
    borderRadius: 18,
    marginBottom: 10,
    maxWidth: "90%",
  },
  bubbleAi: {
    backgroundColor: "#1A1A24",
    alignSelf: "flex-start",
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  bubbleUser: {
    backgroundColor: Colors.primary,
    alignSelf: "flex-end",
    borderTopRightRadius: 4,
  },
  bubbleText: { color: "#fff", fontSize: 15, lineHeight: 22 },
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
  sharePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 10,
    backgroundColor: Colors.primary,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 6,
  },
  sharePillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  inputBar: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 18 : 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    backgroundColor: BG,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  editingBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "rgba(254,119,37,0.15)",
    borderRadius: 10,
    marginBottom: 8,
  },
  editingBarText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.primary,
  },
  editHint: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    marginTop: 4,
    gap: 4,
  },
  editHintText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.15)",
  },
  textInput: {
    flex: 1,
    minHeight: 52,
    maxHeight: 120,
    color: "#fff",
    backgroundColor: "#15151C",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: "#26262E",
    fontSize: 16,
  },
  sendBtn: {
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
