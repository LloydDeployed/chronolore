import { useParams } from "react-router-dom";
import { useProgress } from "../hooks/useProgress";
import { ProgressPicker } from "../components/ProgressPicker";
import { ArticleList } from "../components/ArticleList";

export function UniversePage() {
  const { universeSlug } = useParams<{ universeSlug: string }>();
  const { progress, setEntryProgress, hasAnyProgress } = useProgress(
    universeSlug!,
  );

  // Key that changes when progress changes, to trigger article re-fetch
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
    </div>
  );
}
