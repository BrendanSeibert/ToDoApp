import { apiRequest } from "./client";

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export function register(email: string, password: string): Promise<User> {
  return apiRequest<User>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function login(email: string, password: string): Promise<User> {
  return apiRequest<User>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function logout(): Promise<{ ok: boolean }> {
  return apiRequest("/api/auth/logout", { method: "POST" });
}

export function getMe(): Promise<User> {
  return apiRequest<User>("/api/auth/me", { method: "GET" });
}

export function deleteAccount(): Promise<{ ok: boolean }> {
  return apiRequest("/api/auth/me", { method: "DELETE" });
}
