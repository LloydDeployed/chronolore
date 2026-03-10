import { useState } from "react";
import { register, login } from "../api/client";

interface Props {
  onAuth: (token: string, user: any) => void;
  onClose: () => void;
}

export function AuthModal({ onAuth, onClose }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result =
        mode === "register"
          ? await register(username, email, password)
          : await login(email, password);
      onAuth(result.token, result.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{mode === "login" ? "Sign In" : "Create Account"}</h2>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === "register" && (
            <div className="form-field">
              <label>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
          )}

          <div className="form-field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
            />
          </div>

          {error && <div className="form-error">{error}</div>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading
              ? "..."
              : mode === "login"
                ? "Sign In"
                : "Create Account"}
          </button>
        </form>

        <div className="modal-footer">
          {mode === "login" ? (
            <p>
              Don't have an account?{" "}
              <button className="link-btn" onClick={() => setMode("register")}>
                Create one
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{" "}
              <button className="link-btn" onClick={() => setMode("login")}>
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
