import { api, clearTokens, setTokens } from './client';

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  role_display: string;
  is_active: boolean;
}

interface LoginResponse {
  access: string;
  refresh: string;
  user: User;
}

export async function login(email: string, password: string): Promise<User> {
  const { data } = await api.post<LoginResponse>('/auth/login/', { email, password });
  await setTokens(data.access, data.refresh);
  return data.user;
}

export async function logout(refresh: string | null): Promise<void> {
  try {
    if (refresh) {
      await api.post('/auth/logout/', { refresh });
    }
  } finally {
    await clearTokens();
  }
}

export async function fetchMe(): Promise<User> {
  const { data } = await api.get<User>('/auth/me/');
  return data;
}
