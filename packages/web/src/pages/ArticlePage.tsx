import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useProgress } from "../hooks/useProgress";
import { useTitle } from "../hooks/useTitle";
import { useAuth } from "../hooks/useAuth";
import { ArticleView } from "../components/ArticleView";

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
  const { user } = useAuth();
  const progressKey = JSON.stringify(progress);
  const [refreshKey] = useState(0);

  return (
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
        progressKey={progressKey + refreshKey}
        currentUserId={user?.id}
        isAuthenticated={isAuthenticated}
      />
    </div>
  );
}
