import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import {
  WorkerProfile,
  saveProfile,
} from '@/constants/workerProfile';

const BACKGROUND = '#0A0A0F';

const CERT_LEVELS: { label: string; value: WorkerProfile['certificationLevel'] }[] = [
  { label: 'Apprentice', value: 'apprentice' },
  { label: 'Journeyman', value: 'journeyman' },
  { label: 'Master', value: 'master' },
];

const TRADES = ['Welder', 'Pipefitter', 'Electrician', 'Other'];

export default function OnboardingScreen() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [employer, setEmployer] = useState('');
  const [unionLocal, setUnionLocal] = useState('');
  const [certificationLevel, setCertificationLevel] =
    useState<WorkerProfile['certificationLevel']>('');
  const [trade, setTrade] = useState('');

  const handleSubmit = async () => {
    if (!name.trim() || !employer.trim()) {
      Alert.alert(
        'Missing information',
        'Please fill in your full name and employer to continue.',
      );
      return;
    }

    const profile: WorkerProfile = {
      name: name.trim(),
      trade,
      certificationLevel,
      employer: employer.trim(),
      unionLocal: unionLocal.trim(),
      profileComplete: true,
    };

    try {
      await saveProfile(profile);
      router.replace('/(tabs)');
    } catch (e) {
      Alert.alert('Error', 'Could not save your profile. Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoWrap}>
          <Image
            source={require('@/assets/images/LOGOVALT.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.title}>Let's set up your profile</Text>
        <Text style={styles.subtitle}>We only ask once</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor="#666"
            autoCapitalize="words"
            returnKeyType="next"
          />

          <Text style={styles.label}>Employer / Contractor</Text>
          <TextInput
            style={styles.input}
            value={employer}
            onChangeText={setEmployer}
            placeholder="Company name"
            placeholderTextColor="#666"
            autoCapitalize="words"
            returnKeyType="next"
          />

          <Text style={styles.label}>Union Local</Text>
          <TextInput
            style={styles.input}
            value={unionLocal}
            onChangeText={setUnionLocal}
            placeholder="Optional"
            placeholderTextColor="#666"
            autoCapitalize="characters"
            returnKeyType="done"
          />

          <Text style={styles.label}>Certification Level</Text>
          <View style={styles.pillRow}>
            {CERT_LEVELS.map((lvl) => {
              const active = certificationLevel === lvl.value;
              return (
                <TouchableOpacity
                  key={lvl.value}
                  style={[styles.pill, active && styles.pillActive]}
                  onPress={() => setCertificationLevel(lvl.value)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>
                    {lvl.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Trade</Text>
          <View style={styles.pillRow}>
            {TRADES.map((t) => {
              const active = trade === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.pill, active && styles.pillActive]}
                  onPress={() => setTrade(t)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleSubmit}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 48,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 140,
    height: 60,
  },
  title: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 28,
  },
  form: {
    width: '100%',
  },
  label: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: '#15151C',
    borderWidth: 1,
    borderColor: '#26262E',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    color: Colors.text,
    fontSize: 16,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#15151C',
    borderWidth: 1,
    borderColor: '#26262E',
  },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pillText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#fff',
  },
  primaryButton: {
    marginTop: 32,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
