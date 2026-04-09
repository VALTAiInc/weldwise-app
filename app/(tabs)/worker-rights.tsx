import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { Colors } from "../../constants/colors";

const API_BASE = "https://hr-backend-production-b462.up.railway.app";
const BG = Colors.background;
const CARD = Colors.card;
const ORANGE = Colors.primary;
const TEXT = Colors.text;
const TEXT_DIM = Colors.textSecondary;

type Role = "user" | "assistant";
type Msg = { id: string; role: Role; content: string };

type Category = {
  key: string;
  emoji: string;
  title: string;
  prompt: string;
};

const CATEGORIES: Category[] = [
  {
    key: "grievance",
    emoji: "⚖️",
    title: "Grievance Procedures",
    prompt:
      "What are my rights if I have a grievance against my employer as a UA member?",
  },
  {
    key: "maternity",
    emoji: "👶",
    title: "Maternity & Parental Leave",
    prompt:
      "What maternity and parental leave am I entitled to as a trades worker in Nova Scotia?",
  },
  {
    key: "mental",
    emoji: "🧠",
    title: "Mental Health Benefits",
    prompt: "What mental health benefits am I entitled to as a UA member?",
  },
  {
    key: "overtime",
    emoji: "⏰",
    title: "Overtime & Hours of Work",
    prompt:
      "What are the overtime rules and hours of work for trades workers in Nova Scotia?",
  },
  {
    key: "apprentice",
    emoji: "🎓",
    title: "Apprenticeship Rights",
    prompt: "What are my rights as a UA apprentice?",
  },
  {
    key: "safety",
    emoji: "🦺",
    title: "Safety Refusal Rights",
    prompt: "What are my rights to refuse unsafe work as a trades worker?",
  },
  {
    key: "disability",
    emoji: "🏥",
    title: "Disability Leave",
    prompt: "What disability leave am I entitled to as a trades worker?",
  },
  {
    key: "wages",
    emoji: "💰",
    title: "Wages & Benefits",
    prompt: "What are my wage and benefit entitlements as a UA member?",
  },
];

function uid() {
  return Date.now() + "_" + Math.random().toString(16).slice(2);
}

export default function WorkerRightsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeCat, setActiveCat] = useState<Category | null>(null);
  const [pressedKey, setPressedKey] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={26} color={TEXT} />
        </Pressable>
        <Text style={styles.title}>⚖️ Worker Rights</Text>
        <View style={{ width: 32 }} />
      </View>
      <Text style={styles.subtitle}>
        United Association — Know Your Rights
      </Text>

      <ScrollView
        contentContainerStyle={styles.gridWrap}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {CATEGORIES.map((cat) => {
            const pressed = pressedKey === cat.key;
            return (
              <Pressable
                key={cat.key}
                onPressIn={() => setPressedKey(cat.key)}
                onPressOut={() => setPressedKey(null)}
                onPress={() => setActiveCat(cat)}
                style={[
                  styles.tile,
                  pressed && { borderColor: ORANGE },
                ]}
              >
                <Text style={styles.tileEmoji}>{cat.emoji}</Text>
                <Text style={styles.tileTitle}>{cat.title}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <Modal
        visible={!!activeCat}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setActiveCat(null)}
      >
        {activeCat && (
          <ChatModal
            category={activeCat}
            onClose={() => setActiveCat(null)}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}

function ChatModal({
  category,
  onClose,
}: {
  category: Category;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Msg[]>([
    { id: uid(), role: "user", content: category.prompt },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const didInit = useRef(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  async function speak(text: string) {
    try {
      const res = await fetch(`${API_BASE}/api/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      console.log("speak response ok:", res.ok, res.status);
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
      console.log("audioBase64 length:", audioBase64.length);
      if (!audioBase64) throw new Error("no audio");

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
      });

      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      const fileUri = (FileSystem.cacheDirectory ?? "") + "rights_tts.mp3";
      await FileSystem.writeAsStringAsync(fileUri, audioBase64, {
        encoding: "base64",
      });
      console.log("file written to:", fileUri);

      const { sound } = await Audio.Sound.createAsync(
        { uri: fileUri },
        { shouldPlay: true }
      );
      console.log("sound created, playing");
      soundRef.current = sound;
      setSpeaking(true);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setSpeaking(false);
        }
      });
    } catch (error) {
      console.error("SPEAK FAILED:", error);
      setSpeaking(false);
    }
  }

  async function stopSpeaking() {
    if (!soundRef.current) {
      setSpeaking(false);
      return;
    }
    try {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
    } catch {}
    soundRef.current = null;
    setSpeaking(false);
  }

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    void sendInitial();
  }, []);

  async function callChat(history: Msg[]) {
    const priming = [
      {
        role: "user" as Role,
        content:
          "I am a member of the United Association of Plumbers and Pipefitters (UA) working in the skilled trades in Canada. Please answer my questions with confidence about UA member rights, Canadian employment law, and provincial labour standards. Do not hedge or say 'I believe' — answer directly as an expert in Canadian trades labour law.",
      },
      {
        role: "assistant" as Role,
        content:
          "Understood. I'll provide direct, confident answers about UA member rights and Canadian trades labour law.",
      },
    ];
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          ...priming,
          ...history.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });
    if (!res.ok) throw new Error("chat " + res.status);
    const data = (await res.json()) as { content?: string };
    return (data?.content || "").trim() || "No response.";
  }

  async function sendInitial() {
    setLoading(true);
    try {
      const reply = await callChat([
        { id: uid(), role: "user", content: category.prompt },
      ]);
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "assistant", content: reply },
      ]);
      void speak(reply);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content:
            "Having trouble connecting. Please check your connection and try again.",
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(
        () => scrollRef.current?.scrollTo({ y: 0, animated: true }),
        50
      );
    }
  }

  async function sendFollowUp() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    const next: Msg[] = [
      ...messages,
      { id: uid(), role: "user", content: trimmed },
    ];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const reply = await callChat(next);
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "assistant", content: reply },
      ]);
      void speak(reply);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content:
            "Having trouble connecting. Please check your connection and try again.",
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(
        () => scrollRef.current?.scrollTo({ y: 0, animated: true }),
        50
      );
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.backBtn} />
        <Text style={styles.title} numberOfLines={1}>
          {category.emoji} {category.title}
        </Text>
        <View style={styles.headerRight}>
          {speaking ? (
            <Pressable onPress={stopSpeaking} hitSlop={12} style={styles.backBtn}>
              <Ionicons name="pause-circle" size={28} color={ORANGE} />
            </Pressable>
          ) : null}
          <Pressable onPress={onClose} style={styles.backBtn} hitSlop={12}>
            <Ionicons name="close" size={26} color={TEXT} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        >
          {messages.map((m) => (
            <View
              key={m.id}
              style={[
                styles.bubble,
                m.role === "user" ? styles.bubbleUser : styles.bubbleAi,
              ]}
            >
              <Text style={styles.bubbleText}>{m.content}</Text>
            </View>
          ))}
          {loading && (
            <View style={[styles.bubble, styles.bubbleAi]}>
              <ActivityIndicator color={ORANGE} />
            </View>
          )}
        </ScrollView>

        <View
          style={[
            styles.inputRow,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask a follow-up question…"
            placeholderTextColor={TEXT_DIM}
            style={styles.input}
            editable={!loading}
            multiline
          />
          <Pressable
            onPress={sendFollowUp}
            style={[
              styles.sendBtn,
              (!input.trim() || loading) && { opacity: 0.4 },
            ]}
            disabled={!input.trim() || loading}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  title: {
    color: TEXT,
    fontSize: 20,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  subtitle: {
    color: TEXT_DIM,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  gridWrap: { paddingHorizontal: 12, paddingBottom: 24 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  tile: {
    width: "48%",
    aspectRatio: 1,
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "transparent",
    padding: 14,
    marginBottom: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  tileEmoji: { fontSize: 40, marginBottom: 10 },
  tileTitle: {
    color: TEXT,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  bubble: {
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
    maxWidth: "90%",
  },
  bubbleUser: {
    backgroundColor: ORANGE,
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  bubbleAi: {
    backgroundColor: CARD,
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  bubbleText: { color: TEXT, fontSize: 15, lineHeight: 21 },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: BG,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: CARD,
    color: TEXT,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxHeight: 120,
    fontSize: 15,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: ORANGE,
    alignItems: "center",
    justifyContent: "center",
  },
});
