import { FormEvent, useState } from "react";
import { AuthMode } from "../api/auth";

export function AuthPanel({
  mode,
  error,
  isSubmitting,
  onModeChange,
  onSubmit,
}: {
  mode: AuthMode;
  error: string | null;
  isSubmitting: boolean;
  onModeChange: (mode: AuthMode) => void;
  onSubmit: (email: string, password: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(email, password);
  }

  return (
    <div className="auth-card">
      <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "login"}
          className={`auth-tab ${mode === "login" ? "active" : ""}`}
          onClick={() => onModeChange("login")}
        >
          Log in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "register"}
          className={`auth-tab ${mode === "register" ? "active" : ""}`}
          onClick={() => onModeChange("register")}
        >
          Register
        </button>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Email
          <input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label>
          Password
          <input
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={8}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>

        {error ? <p className="error">{error}</p> : null}

        <button type="submit" className="auth-submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Working..."
            : mode === "login"
              ? "Log in"
              : "Create account"}
        </button>
      </form>
    </div>
  );
}
