const TOKEN_KEY = 'splitter_token';
const PROFILE_KEY = 'splitter_profile';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export interface ProfileCache {
  id: string;
  account: string;
  username: string;
  roleType: string;
  realNameVerified: number;
  regionId: string;
}

export function getProfileCache(): ProfileCache | null {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setProfileCache(profile: ProfileCache): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function removeProfileCache(): void {
  localStorage.removeItem(PROFILE_KEY);
}

export function clearAuth(): void {
  removeToken();
  removeProfileCache();
}
