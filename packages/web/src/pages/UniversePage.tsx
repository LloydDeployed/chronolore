import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useProgress } from "../hooks/useProgress";
import { useTitle } from "../hooks/useTitle";
import { ArticleList } from "../components/ArticleList";
import { CreateArticle } from "../components/CreateArticle";
import { AppShell } from "../components/AppShell";
import { UniverseSidebar } from "../components/UniverseSidebar";

interface Props {
  isAuthenticated: boolean;
  user: { username: string; role?: string } | null;
  sidebarOpen: boolean;
  onCloseSidebar?: () => void;
  onOpenAuth?: () => void;
}

export function UniversePage({ isAuthenticated, user, sidebarOpen, onCloseSidebar, onOpenAuth }: Props) {
  const { universeSlug } = useParams<{ universeSlug: string }>();
  const { progress, setEntryProgress, hasAnyProgress } = useProgress(
    universeSlug!,
  );
  useTitle(universeSlug ?? "");
  const [showCreate, setShowCreate] = useState(false);

  const progressKey = JSON.stringify(progress);

  return (
    <div className="universe-page">
      <AppShell
        sidebarOpen={sidebarOpen}
        onCloseSidebar={onCloseSidebar}
        sidebar={
          <div className={`shell-sidebar-panel${sidebarOpen ? " is-open" : ""}`}>
            <UniverseSidebar
              universeSlug={universeSlug!}
              progress={progress}
              onEntryChange={setEntryProgress}
              isAuthenticated={isAuthenticated}
              username={user?.username}
              userRole={user?.role}
              currentPage="universe"
              onNavigate={onCloseSidebar}
              onOpenAuth={onOpenAuth}
            />
          </div>
        }
      >
        <div className="content">
          {isAuthenticated && (
            <div className="content-actions">
              <button
                className="btn-primary"
                onClick={() => setShowCreate(true)}
              >
                + New Article
              </button>
            </div>
          )}

          {!hasAnyProgress ? (
            <div className="welcome">
              <h2>Welcome!</h2>
              <p>
                Set your reading progress in the sidebar to start browsing.
                You'll only see articles and content that's safe at your
                current point in the series.
              </p>
            </div>
          ) : (
            <ArticleList
              universeSlug={universeSlug!}
              progressKey={progressKey}
            />
          )}
        </div>
      </AppShell>

      {showCreate && (
        <CreateArticle
          universeSlug={universeSlug!}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
