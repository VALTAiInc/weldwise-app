// app/(tabs)/talk.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Animated,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import { Buffer } from "buffer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useKeepAwake } from "expo-keep-awake";

// Ensure Buffer exists (needed for base64 conversions on iOS/React Native)
(globalThis as any).Buffer = (globalThis as any).Buffer || Buffer;

// Prefer env override if you set it. Fallback to your current deployed Replit app.
const API_BASE =
  (process.env.EXPO_PUBLIC_API_BASE as string) ||
"https://miller-backend-production.up.railway.app";

// Mentor context for the chat API
// Mentor context for the chat API
const MANUAL_CONTEXT = `
You are WeldWise, a friendly and experienced welding mentor.

Scope:
- Only answer questions about welding, fabrication, safety, PPE, WPS/procedure, troubleshooting, metallurgy, fit-up, consumables, parameters, weld defects, inspection, and relevant codes or standards.
- Always be prepared to discuss PPE requirements, safety protocols, and hazard awareness as part of any welding conversation.
- If the message is not clearly about welding, respond with ONE short sentence redirecting to welding (example: "I can help with welding — what process and material are you working with?").
- Do NOT provide relationship, life, personal, creative writing, or general coaching advice.

Tone:
- Warm, confident, and practical.
- Speak like a highly experienced journeyperson who genuinely enjoys helping others improve.
- Be encouraging without being preachy or generic.
- End most responses with one short, natural follow-up question — like a mentor checking in on their apprentice.
- Friendly and jobsite-ready. Not cold, not corporate.

Format:
- Plain text only.
- No markdown.
- No headings.
- No bullet lists.
- No bold or special formatting.
- Short, clean paragraphs only.

How to answer:
- Start with the correct code-compliant guideline or standard practice.
- Then optionally add one short "Shop Tip" or "Field Insight" from experienced welders.
- Prioritize safety and code-compliant best practice.
- Safety and PPE come first. If the topic involves fumes, confined space, energized equipment, hot work, grinding, or overhead welding — proactively mention the required PPE and hazard controls early in the response, not as an afterthought.
- If a welder mentions skipping PPE or taking a shortcut that creates risk, address it directly but without lecturing.
- Give step-by-step troubleshooting in the logical order a real welder would follow.
- Include realistic parameter ranges when relevant (amps, volts, wire feed speed, gas flow, cup size, stickout, travel angle, travel speed).

Length:
- Keep responses concise, practical, and jobsite-ready.
`.trim();

type Role = "user" | "assistant";
type Msg = { id: string; role: Role; content: string; ts: number };

const STORAGE_DISCLAIMER_KEY = "weldwise_disclaimer_accepted_v1";

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function getMimeFromUri(uri: string) {
  const u = uri.toLowerCase();
  if (u.endsWith(".m4a")) return "audio/m4a";
  if (u.endsWith(".mp3")) return "audio/mpeg";
  if (u.endsWith(".wav")) return "audio/wav";
  if (u.endsWith(".aac")) return "audio/aac";
  if (u.endsWith(".caf")) return "audio/x-caf";
  if (u.endsWith(".3gp")) return "audio/3gpp";
  if (u.endsWith(".mp4")) return "audio/mp4";
  return Platform.OS === "ios" ? "audio/m4a" : "audio/3gpp";
}

export default function TalkScreen() {
  useKeepAwake();

  const insets = useSafeAreaInsets();

  // keep the rest of your existing TalkScreen code starting from your state/hooks...

  const [messages, setMessages] = useState<Msg[]>(() => [
    {
      id: uid(),
      role: "assistant",
      content:
        "Hey! I'm WeldWise — your welding mentor. Whether you're troubleshooting, dialing in parameters, or just want to sharpen your skills, I've got you covered. What are you working on today — and would you like any tips or tricks to get started?",
      ts: Date.now(),
    },
  ]);

  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [micPermissionOk, setMicPermissionOk] = useState<boolean | null>(null);

  const [ttsStatus, setTtsStatus] = useState<
    "idle" | "loading" | "playing" | "paused"
  >("idle");

  const recordingRef = useRef<Audio.Recording | null>(null);

  // Native TTS playback
  const soundRef = useRef<Audio.Sound | null>(null);

  // Web TTS playback (browser Audio constructor)
  const webAudioRef = useRef<any>(null);
  const lastTtsRef = useRef<{ text: string; ts: number } | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);

  // One-time disclaimer
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  // Mic waveform animation (no new deps)
  const waveAnim = useRef(new Animated.Value(0)).current;

  const scrollBottomPad = useMemo(() => {
    // Padding for bubbles so they don't get covered by the input bar
    return 18;
  }, []);

  function addMessage(role: Role, content: string) {
    setMessages((prev) => [
      ...prev,
      { id: uid(), role, content, ts: Date.now() },
    ]);
    
  }

  async function ensureAudioMode(mode: "record" | "playback") {
    try {
      if (mode === "record") {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        } as any);
      } else {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        } as any);
      }
    } catch {
      // ignore
    }
  }

  async function checkMicPermission() {
    try {
      const perm = await Audio.getPermissionsAsync();
      if (perm.status === "granted") {
        setMicPermissionOk(true);
        return true;
      }
      const req = await Audio.requestPermissionsAsync();
      const ok = req.status === "granted";
      setMicPermissionOk(ok);
      if (!ok) {
        addMessage(
          "assistant",
          "Mic permission is off. Enable it in iPhone Settings for WeldWise, then try again.",
        );
      }
      return ok;
    } catch {
      setMicPermissionOk(false);
      addMessage("assistant", "Mic permission check failed.");
      return false;
    }
  }

  async function stopAnyTTS() {
    // Stop native sound
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    } catch {
      // ignore
    }

    // Stop web audio
    try {
      if (webAudioRef.current) {
        webAudioRef.current.pause?.();
        webAudioRef.current.currentTime = 0;
        webAudioRef.current = null;
      }
    } catch {
      // ignore
    }

    setTtsStatus("idle");
  }

  async function playTTS(text: string) {
    if (!text.trim()) return;
   
    const t0 = Date.now();
    console.log("[TTS] start");

    try {
      setTtsStatus("loading");

      const tFetchStart = Date.now();
      const res = await fetch(`${API_BASE}/api/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      console.log("[TTS] fetch done ms:", Date.now() - tFetchStart, "status:", res.status);

      if (!res.ok) {
        const body = await safeJson(res);
        throw new Error(`speak ${res.status}: ${JSON.stringify(body)}`);
      }

      // WEB
      if (Platform.OS === "web") {
        const tBlob = Date.now();
        const blob = await res.blob();
        console.log("[TTS] blob ms:", Date.now() - tBlob, "bytes:", blob.size);

        const url = URL.createObjectURL(blob);
        await stopAnyTTS();

        const A = (globalThis as any).Audio;
        const a = new A(url);
        webAudioRef.current = a;

        a.onplaying = () =>
          console.log("[TTS] web onplaying ms since start:", Date.now() - t0);

        a.onended = () => {
          try {
            URL.revokeObjectURL(url);
          } catch {}
          setTtsStatus("idle");
        };

        await a.play();
        setTtsStatus("playing");
        return;
      }

      // NATIVE
      const tArr = Date.now();
      const arr = await res.arrayBuffer();
      console.log("[TTS] arrayBuffer ms:", Date.now() - tArr, "bytes:", arr.byteLength);

      const tB64 = Date.now();
      const b64 = Buffer.from(arr).toString("base64");
      console.log("[TTS] base64 ms:", Date.now() - tB64);

      const dataUri = `data:audio/mpeg;base64,${b64}`;

      await stopAnyTTS();
      await ensureAudioMode("playback");

      const tCreate = Date.now();
      const { sound } = await Audio.Sound.createAsync(
        { uri: dataUri },
        { shouldPlay: true }
      );
      console.log("[TTS] createAsync ms:", Date.now() - tCreate);

      soundRef.current = sound;
      setTtsStatus("playing");

      let logged = false;
      sound.setOnPlaybackStatusUpdate((st: any) => {
        if (!st) return;

        if (!logged && st.isLoaded && st.isPlaying) {
          logged = true;
          console.log("[TTS] first isPlaying ms since start:", Date.now() - t0);
        }

        if (st.isLoaded && st.didJustFinish) {
          stopAnyTTS();
        } else if (st.isLoaded) {
          if (st.isPlaying) setTtsStatus("playing");
          else if (st.positionMillis > 0 && !st.isPlaying)
            setTtsStatus("paused");
        }
      });
    } catch (e: any) {
      setTtsStatus("idle");
      console.log("[TTS] error ms since start:", Date.now() - t0);
      addMessage("assistant", `TTS error: ${String(e?.message || e)}`);
    }
  }

  async function pauseTTS() {
    try {
      if (Platform.OS === "web") {
        if (webAudioRef.current) {
          webAudioRef.current.pause();
          setTtsStatus("paused");
        }
        return;
      }
      if (soundRef.current) {
        await soundRef.current.pauseAsync();
        setTtsStatus("paused");
      }
    } catch {
      // ignore
    }
  }

  async function resumeTTS() {
    try {
      if (Platform.OS === "web") {
        if (webAudioRef.current) {
          await webAudioRef.current.play();
          setTtsStatus("playing");
        }
        return;
      }
      if (soundRef.current) {
        await soundRef.current.playAsync();
        setTtsStatus("playing");
      }
    } catch {
      // ignore
    }
  }

  async function sendTextMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    addMessage("user", trimmed);
    setInput("");
    setIsProcessing(true);

    try {
      const payload = {
        messages: [
          { role: "system", content: MANUAL_CONTEXT },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: trimmed },
        ],
      };

      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await safeJson(res);
        throw new Error(`chat ${res.status}: ${JSON.stringify(body)}`);
      }

      const data = (await res.json()) as { content?: string };
      const reply = (data?.content || "").trim() || "No response.";
      addMessage("assistant", reply);

        // TTS: speak first chunk, once per reply
      const ttsText = reply.replace(/\s+/g, " ").trim().slice(0, 500);

        if (ttsText) {
          const now = Date.now();
          const prev = lastTtsRef.current;

          // Skip only if it's the same text and we fired very recently (prevents double-trigger)
          if (prev && prev.text === ttsText && now - prev.ts < 1200) {
            console.log("[TTS] skipped duplicate call");
          } else {
            lastTtsRef.current = { text: ttsText, ts: now };
            playTTS(ttsText);
          }
        }
      
    } catch (e: any) {
      addMessage(
        "assistant",
        `I can't reach the server right now.\nCheck API_BASE and /api/health.\n\nAPI_BASE: ${API_BASE}\nError: ${String(
          e?.message || e
        )}`
      );
    } finally {
      setIsProcessing(false);
    }
  }
  async function startRecording() {
    if (isProcessing) return;

    const ok = await checkMicPermission();
    if (!ok) return;

    try {
      await stopAnyTTS();
      await ensureAudioMode("record");

      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      });
      await rec.startAsync();

      recordingRef.current = rec;
      setIsRecording(true);
      Haptics.selectionAsync();
    } catch (e: any) {
      addMessage(
        "assistant",
        `Recording failed to start. ${String(e?.message || e)}`,
      );
    }
  }

  async function stopRecordingAndSend() {
    try {
      const rec = recordingRef.current;
      recordingRef.current = null;
      setIsRecording(false);

      if (!rec) return;

      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      if (!uri) return;

      setIsProcessing(true);


      const mime = getMimeFromUri(uri);
      const formData = new FormData();
      const filename = uri.split("/").pop() || "recording.m4a";

      formData.append("file", {
        uri,
        name: filename,
        type: mime,
      } as any);

      const transcriptRes = await fetch(`${API_BASE}/api/transcribe`, {
        method: "POST",
        body: formData,
      });

      if (!transcriptRes.ok) {
        const body = await safeJson(transcriptRes);
        throw new Error(
          `transcribe ${transcriptRes.status}: ${JSON.stringify(body)}`,
        );
      }

      const transcriptData = await transcriptRes.json();
      const cleaned = (transcriptData?.text || "").trim();

      if (!cleaned) {
        addMessage(
          "assistant",
          "I didn't catch that clearly. Try again a little closer to the mic.",
        );
        return;
      }

      await sendTextMessage(cleaned);
    } catch (e: any) {
      addMessage(
        "assistant",
        `I can't reach the server right now.\nCheck API_BASE and /api/health.\n\nAPI_BASE: ${API_BASE}\nError: ${String(
          e?.message || e,
        )}`,
      );
    } finally {
      setIsProcessing(false);
    }
  }

  async function onMicPress() {
    if (isRecording) {
      await stopRecordingAndSend();
    } else {
      await startRecording();
    }
  }

  async function checkDisclaimer() {
    try {
      const v = await AsyncStorage.getItem(STORAGE_DISCLAIMER_KEY);
      if (v === "1") return;
      setShowDisclaimer(true);
    } catch {
      // ignore
    }
  }

  async function acceptDisclaimer() {
    try {
      await AsyncStorage.setItem(STORAGE_DISCLAIMER_KEY, "1");
    } catch {
      // ignore
    }
    setShowDisclaimer(false);
  }

  useEffect(() => {
    checkMicPermission();
    checkDisclaimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      stopAnyTTS();
      try {
        recordingRef.current = null;
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wave animation while recording
  useEffect(() => {
    if (!isRecording) {
      waveAnim.stopAnimation();
      waveAnim.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: 850,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();

    return () => {
      loop.stop();
      waveAnim.setValue(0);
    };
  }, [isRecording, waveAnim]);

  const waveScale = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.35],
  });

  const waveOpacity = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.05],
  });

  const headerPauseIcon =
    ttsStatus === "playing"
      ? "pause"
      : ttsStatus === "paused"
        ? "play"
        : "volume-high";

  const onHeaderPausePress = async () => {
    if (ttsStatus === "playing") return pauseTTS();
    if (ttsStatus === "paused") return resumeTTS();

    // play last assistant message
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (last?.content) return playTTS(last.content);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <View style={[styles.container, { paddingTop: 18 }]}>
          {showDisclaimer && (
            <View style={styles.disclaimerOverlay}>
              <View style={styles.disclaimerCard}>
                <Text style={styles.disclaimerTitle}>Important</Text>
                <Text style={styles.disclaimerText}>
                  WeldWise is an AI-assisted tool for training and guidance. It
                  does not replace qualified supervision, code requirements,
                  inspections, or safe work procedures. Always follow your
                  employer’s policies, local codes, and jobsite safety rules.
                </Text>
                <Pressable
                  style={styles.disclaimerBtn}
                  onPress={acceptDisclaimer}
                >
                  <Text style={styles.disclaimerBtnText}>I understand</Text>
                </Pressable>
              </View>
            </View>
          )}

          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.title}>Talk</Text>
              <Text style={styles.subtitle}>
                Tap the mic to start. Tap again to stop and send.
              </Text>
            </View>

            <Pressable
              onPress={onHeaderPausePress}
              style={[
                styles.headerPauseBtn,
                ttsStatus === "playing" ? styles.headerPauseBtnOn : null,
              ]}
              disabled={ttsStatus === "loading"}
            >
              <Ionicons
                name={headerPauseIcon as any}
                size={22}
                color="#E07A1F"
              />
            </Pressable>
          </View>

          <ScrollView
            ref={(r) => (scrollRef.current = r)}
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: scrollBottomPad },
            ]}
            
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((m) => (
              <View
                key={m.id}
                style={[
                  styles.bubble,
                  m.role === "assistant"
                    ? styles.bubbleAssistant
                    : styles.bubbleUser,
                ]}
              >
                <Text style={styles.bubbleText}>{m.content}</Text>
              </View>
            ))}

            {isProcessing && (
              <View style={[styles.bubble, styles.bubbleAssistant]}>
                <ActivityIndicator />
              </View>
            )}

            {micPermissionOk === false && (
              <View style={styles.permissionBar}>
                <Text style={styles.permissionText}>
                  Mic permission is off. Enable it in iPhone Settings for
                  WeldWise.
                </Text>
              </View>
            )}
          </ScrollView>

          <View
            style={[styles.inputBar, { paddingBottom: insets.bottom + 12 }]}
          >
            <View style={styles.micWrap}>
              {isRecording && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.waveRing,
                    {
                      opacity: waveOpacity,
                      transform: [{ scale: waveScale }],
                    },
                  ]}
                />
              )}

              <Pressable
                onPress={onMicPress}
                style={[styles.micBtn, isRecording ? styles.micBtnOn : null]}
              >
                <Ionicons
                  name={(isRecording ? "stop" : "mic") as any}
                  size={22}
                  color="#fff"
                />
              </Pressable>
            </View>

            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask your mentor..."
              placeholderTextColor="#8B8F98"
              style={styles.textInput}
              editable={!isProcessing}
              multiline
            />

            <Pressable
              onPress={() => sendTextMessage(input)}
              style={[styles.sendBtn, isProcessing ? styles.btnDisabled : null]}
              disabled={isProcessing}
            >
              <Text style={styles.sendText}>Send</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0A0C10" },
  kav: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 18 },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  headerLeft: { flex: 1, paddingRight: 12 },
  title: {
    color: "#FFFFFF",
    fontSize: 52,
    fontWeight: "800",
    letterSpacing: -1,
  },
  subtitle: { color: "#8B8F98", fontSize: 18, marginTop: 6 },

  headerPauseBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: "rgba(224,122,31,0.65)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  headerPauseBtnOn: {
    borderColor: "rgba(224,122,31,0.95)",
  },

  scroll: { flex: 1, marginTop: 16 },
  scrollContent: { paddingTop: 10, gap: 12 },

  bubble: {
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 14,
    maxWidth: "92%",
  },
  bubbleAssistant: { backgroundColor: "#1B1E25", alignSelf: "flex-start" },
  bubbleUser: { backgroundColor: "#2B313D", alignSelf: "flex-end" },
  bubbleText: { color: "#FFFFFF", fontSize: 18, lineHeight: 24 },

  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 0,
    paddingTop: 12,
    paddingBottom: 18,
    backgroundColor: "rgba(10,12,16,0.92)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#222631",
  },

  micWrap: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  waveRing: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: "rgba(224,122,31,0.95)",
  },
  micBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E07A1F",
    alignItems: "center",
    justifyContent: "center",
  },
  micBtnOn: { backgroundColor: "#D64545" },

  textInput: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#13161D",
    color: "#FFFFFF",
    fontSize: 18,
  },

  sendBtn: {
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 24,
    backgroundColor: "#E07A1F",
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: { opacity: 0.6 },
  sendText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  permissionBar: {
    alignSelf: "stretch",
    backgroundColor: "rgba(214,69,69,0.15)",
    borderColor: "rgba(214,69,69,0.4)",
    borderWidth: 1,
    padding: 10,
    borderRadius: 14,
    marginTop: 10,
  },
  permissionText: { color: "#FFFFFF", fontSize: 14 },

  disclaimerOverlay: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
    paddingHorizontal: 18,
  },
  disclaimerCard: {
    width: "100%",
    backgroundColor: "#141823",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#2A3140",
  },
  disclaimerTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
  },
  disclaimerText: { color: "#D5D7DB", fontSize: 16, lineHeight: 22 },
  disclaimerBtn: {
    marginTop: 14,
    backgroundColor: "#E07A1F",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  disclaimerBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
});
