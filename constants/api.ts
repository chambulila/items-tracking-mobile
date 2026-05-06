export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api';

export type ApiUser = {
  id: number;
  name: string;
  email: string;
};

export async function apiRequest<T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message ?? 'Request failed');
  }

  return payload as T;
}

export async function login(email: string, password: string): Promise<{ token: string; user: ApiUser }> {
  return apiRequest('/login', '', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}
