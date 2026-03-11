import { useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useProgress } from "../hooks/useProgress";
import { useTitle } from "../hooks/useTitle";
import { ArticleView } from "../components/ArticleView";
import { BlockEditor } from "../components/BlockEditor";

interface Props {
  isAuthenticated: boolean;
}

export function ArticlePage({ isAuthenticated }: Props) {
  const { universeSlug, articleSlug } = useParams<{
    universeSlug: string;
    articleSlug: string;
  }>();
  useTitle(articleSlug ?? "");
  const { progress } = useProgress(universeSlug!);
  const progressKey = JSON.stringify(progress);
  const [showEditor, setShowEditor] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleBlockCreated = useCallback(() => {
    setShowEditor(false);
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="article-page">
      <nav className="breadcrumb">
        <Link to={`/${universeSlug}`}>← Back to articles</Link>
      </nav>

      <ArticleView
        universeSlug={universeSlug!}
        articleSlug={articleSlug!}
        progressKey={progressKey + refreshKey}
      />

      {isAuthenticated && (
        <div className="contribute-section">
          {showEditor ? (
            <BlockEditor
              universeSlug={universeSlug!}
              articleSlug={articleSlug!}
              onCreated={handleBlockCreated}
              onCancel={() => setShowEditor(false)}
            />
          ) : (
            <button
              className="btn-primary"
              onClick={() => setShowEditor(true)}
            >
              + Add Content Block
            </button>
          )}
          <p className="contribute-note">
            New content will be in "draft" status until reviewed by a moderator.
          </p>
        </div>
      )}
    </div>
  );
}
