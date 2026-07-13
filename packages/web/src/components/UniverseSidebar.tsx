import { Link } from "react-router-dom";
import { ProgressPicker } from "./ProgressPicker";
import { SidebarSection } from "./SidebarSection";
import type { EntryProgress } from "@chronolore/shared";

interface Props {
  universeSlug: string;
  progress?: EntryProgress;
  onEntryChange?: (entrySlug: string, value: string | null) => void;
  isAuthenticated: boolean;
  username?: string;
  userRole?: string;
  currentPage?: "universe" | "article" | "drafts" | "moderate" | "edit";
  onNavigate?: () => void;
  onOpenAuth?: () => void;
}

export function UniverseSidebar({
  universeSlug,
  progress,
  onEntryChange,
  isAuthenticated,
  username,
  userRole,
  currentPage,
  onNavigate,
  onOpenAuth,
}: Props) {
  const canModerate = !!userRole && ["admin", "moderator"].includes(userRole);
  const showProgress = progress && onEntryChange;

  return (
    <div className="universe-sidebar">
      <div className="universe-sidebar__main">
        <div className="universe-sidebar__header">
          <Link to={`/${universeSlug}`} className="universe-sidebar__title">
            {universeSlug.replace(/-/g, " ")}
          </Link>
          <p className="universe-sidebar__subtitle">Spoiler-safe reading tools</p>
        </div>

        <nav className="sidebar-nav sidebar-nav--primary">
          <Link
            to={`/${universeSlug}`}
            className={`sidebar-nav__link${currentPage === "universe" ? " is-active" : ""}`}
            onClick={onNavigate}
          >
            Search & Browse
          </Link>
        </nav>

        {showProgress ? (
          <SidebarSection title="Reading Progress" defaultOpen>
            <ProgressPicker
              universeSlug={universeSlug}
              progress={progress}
              onEntryChange={onEntryChange}
            />
          </SidebarSection>
        ) : null}
      </div>

      <div className="universe-sidebar__footer">
        {isAuthenticated ? (
          <SidebarSection title="Account" defaultOpen>
            <div className="sidebar-account">
              {username ? <p className="sidebar-account__meta">Signed in as {username}</p> : null}
              <nav className="sidebar-nav">
                <Link
                  to={`/${universeSlug}/drafts`}
                  className={`sidebar-nav__link${currentPage === "drafts" ? " is-active" : ""}`}
                  onClick={onNavigate}
                >
                  My Drafts
                </Link>
                {canModerate ? (
                  <Link
                    to={`/${universeSlug}/moderate`}
                    className={`sidebar-nav__link${currentPage === "moderate" ? " is-active" : ""}`}
                    onClick={onNavigate}
                  >
                    Review Queue
                  </Link>
                ) : null}
              </nav>
            </div>
          </SidebarSection>
        ) : (
          <button
            type="button"
            className="sidebar-nav__link sidebar-nav__action universe-sidebar__signin"
            onClick={onOpenAuth}
          >
            Sign In
          </button>
        )}
      </div>
    </div>
  );
}
