import { User } from "../types";
import { apiBaseUrl, parseApiResponse } from "./client";

export type AuthMode = "login" | "register";

export async function authenticate(
  mode: AuthMode,
  email: string,
  password: string,
): Promise<User> {
  const response = await fetch(`${apiBaseUrl}/auth/${mode}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return parseApiResponse<User>(response);
}
