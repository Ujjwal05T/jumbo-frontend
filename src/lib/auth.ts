/**
 * Authentication utilities for the application
 * Uses localStorage for session management
 */

const USER_KEY = 'username';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://c997dd342fc6.ngrok-free.app';

/**
 * Get the current authenticated user
 */
export function getCurrentUser(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return localStorage.getItem(USER_KEY);
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getCurrentUser();
}

/**
 * Login user
 */
export async function login(username: string, password: string): Promise<{ username: string }> {
  const response = await fetch(`${API_URL}/api/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Login failed');
  }

  const data = await response.json();
  localStorage.setItem(USER_KEY, data.username);
  return data;
}

/**
 * Register new user
 */
export async function register(username: string, password: string): Promise<{ username: string }> {
  const response = await fetch(`${API_URL}/api/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Registration failed');
  }

  const data = await response.json();
  return data;
}

/**
 * Logout user
 */
export function logout(): void {
  localStorage.removeItem(USER_KEY);
}

/**
 * Get auth headers (for future use if needed)
 */
export function getAuthHeaders(): Record<string, string> {
  const username = getCurrentUser();
  return username ? { 'X-Username': username } : {};
}