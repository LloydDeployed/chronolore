import { useState } from "react";
import { Link } from "react-router-dom";
import { AuthModal } from "./AuthModal";

interface Props {
  user: { username: string } | null;
  onAuth: (token: string, user: any) => void;
  onLogout: () => void;
}

export function NavBar({ user, onAuth, onLogout }: Props) {
  const [showAuth, setShowAuth] = useState(false);

  return (
    <nav className="navbar">
      <Link to="/" className="nav-brand">
        Chronolore
      </Link>
      <div className="nav-right">
        {user ? (
          <>
            <span className="nav-user">{user.username}</span>
            <button className="btn-secondary btn-sm" onClick={onLogout}>
              Sign Out
            </button>
          </>
        ) : (
          <button
            className="btn-primary btn-sm"
            onClick={() => setShowAuth(true)}
          >
            Sign In
          </button>
        )}
      </div>
      {showAuth && (
        <AuthModal
          onAuth={(token, user) => {
            onAuth(token, user);
            setShowAuth(false);
          }}
          onClose={() => setShowAuth(false)}
        />
      )}
    </nav>
  );
}
