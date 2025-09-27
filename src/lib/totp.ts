/**
 * TOTP Service - Admin TOTP management and verification
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export interface TOTPSetupResponse {
  secret: string;
  qr_code: string; // Base64 encoded
  backup_codes: string[];
}

export interface TOTPVerifyRequest {
  user_id: string;
  otp_code: string;
}

export interface TOTPVerifyResponse {
  valid: boolean;
  message: string;
}

export interface AdminUser {
  id: string;
  name: string;
  username: string;
  totp_enabled: boolean;
}

export interface TOTPStatus {
  totp_enabled: boolean;
  has_backup_codes: boolean;
}

/**
 * Generate TOTP setup for current admin user
 */
export async function generateAdminTOTP(): Promise<TOTPSetupResponse> {
  // Get user ID from localStorage
  const userId = localStorage.getItem('user_id');
  if (!userId) {
    throw new Error('User not authenticated');
  }

  const response = await fetch(`${API_BASE}/admin/generate-totp/${userId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to generate TOTP');
  }

  return response.json();
}

/**
 * Disable TOTP for current admin user
 */
export async function disableAdminTOTP(): Promise<{ message: string }> {
  // Get user ID from localStorage
  const userId = localStorage.getItem('user_id');
  if (!userId) {
    throw new Error('User not authenticated');
  }

  const response = await fetch(`${API_BASE}/admin/disable-totp/${userId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to disable TOTP');
  }

  return response.json();
}

/**
 * Verify admin OTP code
 */
export async function verifyAdminOTP(request: TOTPVerifyRequest): Promise<TOTPVerifyResponse> {
  const response = await fetch(`${API_BASE}/verify-admin-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to verify OTP');
  }

  return response.json();
}

/**
 * Get TOTP status for current admin user
 */
export async function getAdminTOTPStatus(): Promise<TOTPStatus> {
  // Get user ID from localStorage
  const userId = localStorage.getItem('user_id');
  if (!userId) {
    throw new Error('User not authenticated');
  }

  const response = await fetch(`${API_BASE}/admin/totp-status/${userId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to get TOTP status');
  }

  return response.json();
}

/**
 * Get list of admin users with TOTP enabled
 */
export async function getAdminList(): Promise<AdminUser[]> {
  const response = await fetch(`${API_BASE}/admin/list`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to get admin list');
  }

  return response.json();
}