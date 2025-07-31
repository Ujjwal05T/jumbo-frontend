/**
 * Users API utilities
 */

import { MASTER_ENDPOINTS, createRequestOptions } from "./api-config";

export interface User {
  id: string;
  name: string;
  username: string;
  role: string;
  contact: string | null;
  department: string | null;
  status: "active" | "inactive";
  created_at: string;
  last_login: string | null;
}

export interface CreateUserData {
  name: string;
  username: string;
  password: string;
  role: string;
  contact?: string;
  department?: string;
  status: "active" | "inactive";
}

export interface CreateUserFormData {
  name: string;
  username: string;
  password: string;
  role: string;
  contact?: string;
  department?: string;
}

export interface UpdateUserData {
  name?: string;
  username?: string;
  password?: string;
  role?: string;
  contact?: string;
  department?: string;
  status?: "active" | "inactive";
}

/**
 * Fetch all users from the API
 */
export async function fetchUsers(): Promise<User[]> {
  const response = await fetch(
    MASTER_ENDPOINTS.USERS,
    createRequestOptions("GET")
  );

  if (!response.ok) {
    throw new Error("Failed to fetch users");
  }

  return response.json();
}

/**
 * Create a new user
 */
export async function createUser(userData: CreateUserFormData): Promise<User> {
  const userDataWithDefaults: CreateUserData = {
    ...userData,
    status: "active", // Default to active
  };

  console.log("Sending user data:", userDataWithDefaults);

  const response = await fetch(
    MASTER_ENDPOINTS.USERS,
    createRequestOptions("POST", userDataWithDefaults)
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("API Error Response:", errorText);
    console.error("Response status:", response.status);

    let errorMessage = "Failed to create user";

    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.detail) {
        if (Array.isArray(errorJson.detail)) {
          // Handle validation errors
          errorMessage = errorJson.detail
            .map(
              (err: { loc?: string[]; msg: string }) =>
                `${err.loc?.join(".")}: ${err.msg}`
            )
            .join(", ");
        } else {
          errorMessage = errorJson.detail;
        }
      } else if (errorJson.message) {
        errorMessage = errorJson.message;
      }
    } catch {
      errorMessage = errorText || errorMessage;
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Update a user
 */
export async function updateUser(
  id: string,
  userData: UpdateUserData
): Promise<User> {
  const response = await fetch(
    `${MASTER_ENDPOINTS.USERS}/${id}`,
    createRequestOptions("PUT", userData)
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to update user");
  }

  return response.json();
}

/**
 * Delete a user
 */
export async function deleteUser(id: string): Promise<void> {
  const response = await fetch(
    `${MASTER_ENDPOINTS.USERS}/${id}`,
    createRequestOptions("DELETE")
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to delete user");
  }
}

/**
 * Update user status
 */
export async function updateUserStatus(
  id: string,
  status: "active" | "inactive"
): Promise<User> {
  return updateUser(id, { status });
}
