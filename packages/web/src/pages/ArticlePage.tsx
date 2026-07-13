import { useParams, Link } from "react-router-dom";
import { useProgress } from "../hooks/useProgress";
import { useTitle } from "../hooks/useTitle";
import { ArticleView } from "../components/ArticleView";
import { AppShell } from "../components/AppShell";
import { UniverseSidebar } from "../components/UniverseSidebar";

interface Props {
  isAuthenticated: boolean;
  user: { id?: string; username: string; role?: string } | null;
  sidebarOpen: boolean;
  onCloseSidebar?: () => void;
  onOpenAuth?: () => void;
}

export function ArticlePage({ isAuthenticated, user, sidebarOpen, onCloseSidebar, onOpenAuth }: Props) {
  const { universeSlug, articleSlug } = useParams<{
    universeSlug: string;
    articleSlug: string;
  }>();
  useTitle(articleSlug ?? "");
  const { progress, setEntryProgress } = useProgress(universeSlug!);
  const progressKey = JSON.stringify(progress);

  return (
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
            currentPage="article"
            onNavigate={onCloseSidebar}
            onOpenAuth={onOpenAuth}
          />
        </div>
      }
    >
      <div className="article-page">
        <nav className="breadcrumb">
          <Link to={`/${universeSlug}`}>← Back to articles</Link>
          {isAuthenticated && (
            <Link
              to={`/${universeSlug}/articles/${articleSlug}/edit`}
              className="btn-edit-link"
            >
              Edit Article
            </Link>
          )}
        </nav>

        <ArticleView
          universeSlug={universeSlug!}
          articleSlug={articleSlug!}
          progressKey={progressKey}
          currentUserId={user?.id}
          isAuthenticated={isAuthenticated}
        />
      </div>
    </AppShell>
  );
}
