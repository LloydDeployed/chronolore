import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { AuthModal } from "./AuthModal";

interface Props {
  user: { username: string; role?: string } | null;
  onAuth: (token: string, user: any) => void;
  onLogout: () => void;
}

export function NavBar({ user, onAuth, onLogout }: Props) {
  const [showAuth, setShowAuth] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  // Extract universeSlug from path: /:universeSlug/...
  const pathParts = location.pathname.split("/").filter(Boolean);
  const universeSlug = pathParts.length >= 1 && pathParts[0] !== "" ? pathParts[0] : null;

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <nav className="navbar">
      <Link to="/" className="nav-brand">
        Chronolore
      </Link>
      <div className="nav-right">
        {user ? (
          <div className="user-menu" ref={menuRef}>
            <button
              className="user-menu-trigger"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="user-menu-avatar">
                {user.username.charAt(0).toUpperCase()}
              </span>
              <span>{user.username}</span>
              <span className="user-menu-caret">▾</span>
            </button>
            {menuOpen && (
              <div className="user-menu-dropdown">
                {universeSlug && (
                  <Link
                    className="user-menu-item"
                    to={`/${universeSlug}/drafts`}
                    onClick={() => setMenuOpen(false)}
                  >
                    My Drafts
                  </Link>
                )}
                {universeSlug && user.role && ["admin", "moderator"].includes(user.role) && (
                  <Link
                    className="user-menu-item"
                    to={`/${universeSlug}/moderate`}
                    onClick={() => setMenuOpen(false)}
                  >
                    Review Queue
                  </Link>
                )}
                <button
                  className="user-menu-item disabled"
                  disabled
                >
                  Profile
                </button>
                <div className="user-menu-divider" />
                <button
                  className="user-menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    onLogout();
                  }}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
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
