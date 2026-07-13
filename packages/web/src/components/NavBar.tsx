import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import menuOpenIconUrl from "./svgs/menu-open.svg";

interface Props {
  user: { username: string; role?: string } | null;
  onOpenAuth?: () => void;
  onLogout: () => void;
  onToggleSidebar?: () => void;
  showSidebarToggle?: boolean;
  sidebarOpen?: boolean;
}

function formatUniverseName(universeSlug: string) {
  return universeSlug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}


export function NavBar({ user, onOpenAuth, onLogout, onToggleSidebar, showSidebarToggle = false, sidebarOpen = false }: Props) {
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
      <div className="nav-left">
        {showSidebarToggle && (
          <button
            type="button"
            className={`sidebar-toggle${sidebarOpen ? " is-open" : ""}`}
            onClick={onToggleSidebar}
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            <img
              className={`sidebar-toggle__icon${sidebarOpen ? " is-open" : ""}`}
              src={menuOpenIconUrl}
              alt=""
              aria-hidden="true"
            />
          </button>
        )}
        <Link to="/" className="nav-brand">
          Chronolore
        </Link>
        {universeSlug && (
          <div className="nav-context-links">
            <Link to={`/${universeSlug}`} className="nav-context-link">
              {formatUniverseName(universeSlug)}
            </Link>
          </div>
        )}
      </div>
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
            className="btn-primary btn-sm nav-sign-in"
            onClick={onOpenAuth}
          >
            Sign In
          </button>
        )}
      </div>

    </nav>
  );
}
