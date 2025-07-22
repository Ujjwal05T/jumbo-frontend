/**
 * Authentication utilities for the frontend
 */

// API base URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// User interface
export interface User {
  id: string;
  username: string;
  role: string;
}

/**
 * Get the current user from localStorage
 */
export function getCurrentUser(): User | null {
  if (typeof window === "undefined") {
    return null;
  }
  
  const userJson = localStorage.getItem("user");
  if (!userJson) {
    return null;
  }
  
  try {
    return JSON.parse(userJson) as User;
  } catch (e) {
    console.error("Error parsing user from localStorage:", e);
    return null;
  }
}

/**
 * Set a cookie
 */
export function setCookie(name: string, value: string, days: number = 7): void {
  if (typeof window === "undefined") {
    return;
  }
  
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
}

/**
 * Get a cookie by name
 */
export function getCookie(name: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

/**
 * Delete a cookie
 */
export function deleteCookie(name: string): void {
  if (typeof window === "undefined") {
    return;
  }
  
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Strict`;
}

/**
 * Get the current session token from localStorage and cookies
 */
export function getSessionToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  
  // Try to get from localStorage first
  const tokenFromStorage = localStorage.getItem("sessionToken");
  if (tokenFromStorage) {
    return tokenFromStorage;
  }
  
  // Fall back to cookies
  return getCookie("sessionToken");
}

/**
 * Check if the user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = getSessionToken();
  if (!token) {
    return false;
  }
  
  try {
    const response = await fetch(`${API_URL}/api/auth/session-check`, {
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });
    
    return response.ok;
  } catch (e) {
    console.error("Error checking authentication:", e);
    return false;
  }
}

/**
 * Set the session token in both localStorage and cookies
 */
export function setSessionToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }
  
  localStorage.setItem("sessionToken", token);
  setCookie("sessionToken", token);
}

/**
 * Logout the current user
 */
export async function logout(): Promise<boolean> {
  const token = getSessionToken();
  
  try {
    // Call logout API
    const response = await fetch(`${API_URL}/api/auth/logout`, {
      method: "POST",
      headers: {
        "Authorization": token ? `Bearer ${token}` : "",
      },
    });
    
    // Clear storage regardless of API response
    localStorage.removeItem("sessionToken");
    localStorage.removeItem("user");
    deleteCookie("sessionToken");
    
    return response.ok;
  } catch (e) {
    console.error("Error logging out:", e);
    
    // Still clear storage on error
    localStorage.removeItem("sessionToken");
    localStorage.removeItem("user");
    deleteCookie("sessionToken");
    
    return false;
  }
}

/**
 * Create authenticated fetch function with session token
 */
export function createAuthFetch() {
  return async (url: string, options: RequestInit = {}) => {
    const token = getSessionToken();
    
    const headers = {
      ...options.headers,
      "Authorization": token ? `Bearer ${token}` : "",
    };
    
    return fetch(url, {
      ...options,
      headers,
    });
  };
}

// Create an authenticated fetch instance
export const authFetch = createAuthFetch();