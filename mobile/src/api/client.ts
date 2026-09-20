import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'toca_access_token';
const REFRESH_TOKEN_KEY = 'toca_refresh_token';

// Em dispositivo físico com Expo Go, "localhost" é o próprio celular — aponte
// para o IP da máquina de desenvolvimento via EXPO_PUBLIC_API_URL no .env.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8001/api';

export const api = axios.create({ baseURL: API_URL });

export async function getTokens() {
  const [access, refresh] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  ]);
  return { access, refresh };
}

export async function setTokens(access: string, refresh: string) {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh),
  ]);
}

export async function clearTokens() {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}

api.interceptors.request.use(async (config) => {
  const { access } = await getTokens();
  if (access) {
    config.headers.Authorization = `Bearer ${access}`;
  }
  return config;
});

// Evita múltiplas chamadas de refresh simultâneas quando várias requisições
// caem em 401 ao mesmo tempo (ex.: tela que dispara várias chamadas juntas).
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refresh } = await getTokens();
  if (!refresh) return null;
  try {
    const { data } = await axios.post(`${API_URL}/auth/refresh/`, { refresh });
    await setTokens(data.access, data.refresh ?? refresh);
    return data.access as string;
  } catch {
    await clearTokens();
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      refreshPromise ??= refreshAccessToken();
      const newAccess = await refreshPromise;
      refreshPromise = null;
      if (newAccess) {
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  }
);
