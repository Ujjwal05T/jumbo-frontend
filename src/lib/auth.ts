/**
 * Authentication utilities for the application
 * Uses localStorage for session management
 */

import { AUTH_ENDPOINTS, createRequestOptions } from './api-config';

const USER_KEY = 'username';

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
export async function login(username: string, password: string): Promise<any> {
  const response = await fetch(AUTH_ENDPOINTS.LOGIN, createRequestOptions('POST', { username, password }));

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Login failed');
  }

  const data = await response.json();
  // Store all user data from UserMaster response
  localStorage.setItem('username', data.username);
  localStorage.setItem('user_id', data.id);
  localStorage.setItem('user_name', data.name);
  localStorage.setItem('user_role', data.role);

  // Sync auth data to cookies for middleware
  document.cookie = `username=${data.username}; path=/; max-age=${60 * 60 * 24 * 7}`;
  document.cookie = `user_role=${data.role}; path=/; max-age=${60 * 60 * 24 * 7}`;

  return data;
}

/**
 * Register new user
 */
export async function register(userData: any): Promise<any> {
  const response = await fetch(AUTH_ENDPOINTS.REGISTER, createRequestOptions('POST', userData));

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Registration failed');
  }

  const data = await response.json();
  // Store all user data from UserMaster response
  localStorage.setItem('username', data.username);
  localStorage.setItem('user_id', data.id);
  localStorage.setItem('user_name', data.name);
  localStorage.setItem('user_role', data.role);
  return data;
}

/**
 * Logout user - Clear all stored authentication data
 */
export function logout(): void {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem('user_id');
  localStorage.removeItem('user_name');
  localStorage.removeItem('user_role');

  // Clear auth cookies
  document.cookie = 'username=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
  document.cookie = 'user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
}

/**
 * Get auth headers (for future use if needed)
 */
export function getAuthHeaders(): Record<string, string> {
  const username = getCurrentUser();
  return username ? { 'X-Username': username } : {};
}