import AsyncStorage from '@react-native-async-storage/async-storage';

export type WorkerProfile = {
  name: string;
  trade: string;
  certificationLevel: 'apprentice' | 'journeyman' | 'master' | '';
  employer: string;
  unionLocal?: string;
  profileComplete: boolean;
};

export const DEFAULT_PROFILE: WorkerProfile = {
  name: '',
  trade: '',
  certificationLevel: '',
  employer: '',
  unionLocal: '',
  profileComplete: false,
};

const STORAGE_KEY = 'worker_profile';

export async function saveProfile(profile: WorkerProfile): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export async function loadProfile(): Promise<WorkerProfile | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as WorkerProfile;
}

export async function clearProfile(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
