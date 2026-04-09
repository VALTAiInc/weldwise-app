// app/_layout.tsx
import React, { useEffect, useState } from "react";
import { Stack, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DisclaimerModal from "../components/DisclaimerModal";
import { loadProfile } from "../constants/workerProfile";

export default function RootLayout() {
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkDisclaimer = async () => {
      const accepted = await AsyncStorage.getItem("disclaimerAccepted");
      if (!accepted) {
        setShowDisclaimer(true);
      }
    };

    checkDisclaimer();
  }, []);

  useEffect(() => {
    const checkProfile = async () => {
      const profile = await loadProfile();
      if (!profile || !profile.profileComplete) {
        router.replace("/onboarding");
      }
    };

    checkProfile();
  }, [router]);

  const handleAcceptDisclaimer = async () => {
    await AsyncStorage.setItem("disclaimerAccepted", "true");
    setShowDisclaimer(false);
  };

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="lockbox" options={{ gestureEnabled: true }} />
      </Stack>

      <DisclaimerModal
        visible={showDisclaimer}
        onAccept={handleAcceptDisclaimer}
      />
    </>
  );
}