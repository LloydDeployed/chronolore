import { useParams, Link } from "react-router-dom";
import { useProgress } from "../hooks/useProgress";
import { ArticleView } from "../components/ArticleView";

export function ArticlePage() {
  const { universeSlug, articleSlug } = useParams<{
    universeSlug: string;
    articleSlug: string;
  }>();
  const { progress } = useProgress(universeSlug!);
  const progressKey = JSON.stringify(progress);

  return (
    <div className="article-page">
      <nav className="breadcrumb">
        <Link to={`/${universeSlug}`}>← Back to articles</Link>
      </nav>
      <ArticleView
        universeSlug={universeSlug!}
        articleSlug={articleSlug!}
        progressKey={progressKey}
      />
    </div>
  );
}
