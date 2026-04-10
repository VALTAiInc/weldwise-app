// constants/api.ts — single source of truth for backend URLs
export const BRIDGE_API =
  process.env.EXPO_PUBLIC_BRIDGE_API ||
  "https://bridge-backend-production-b481.up.railway.app";

// /api/speak only exists on HR_API not BRIDGE_API
export const HR_API =
  process.env.EXPO_PUBLIC_HR_API ||
  "https://hr-backend-production-b462.up.railway.app";

export const WELDWISE_API =
  process.env.EXPO_PUBLIC_API_BASE ||
  "https://weldwise-backend-gold-production.up.railway.app";
