import { useState } from "react";
import { User } from "../types";

const STORAGE_KEY = "imperial:user";

function readStoredUser(): User | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as User;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function useUser() {
  const [user, setUserState] = useState<User | null>(readStoredUser);

  function setUser(next: User | null) {
    if (next) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setUserState(next);
  }

  return { user, setUser };
}
