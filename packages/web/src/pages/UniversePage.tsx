import { useState } from "react";
import { useParams } from "react-router-dom";
import { useProgress } from "../hooks/useProgress";
import { ProgressPicker } from "../components/ProgressPicker";
import { ArticleList } from "../components/ArticleList";
import { CreateArticle } from "../components/CreateArticle";

interface Props {
  isAuthenticated: boolean;
}

export function UniversePage({ isAuthenticated }: Props) {
  const { universeSlug } = useParams<{ universeSlug: string }>();
  const { progress, setEntryProgress, hasAnyProgress } = useProgress(
    universeSlug!,
  );
  const [showCreate, setShowCreate] = useState(false);

  const progressKey = JSON.stringify(progress);

  return (
    <div className="universe-page">
      <div className="universe-layout">
        <aside className="sidebar">
          <ProgressPicker
            universeSlug={universeSlug!}
            progress={progress}
            onEntryChange={setEntryProgress}
          />
        </aside>
        <main className="content">
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
        </main>
      </div>

      {showCreate && (
        <CreateArticle
          universeSlug={universeSlug!}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
