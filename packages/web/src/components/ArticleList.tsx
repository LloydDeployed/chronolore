import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getArticles, searchArticles } from "../api/client";

interface Props {
  universeSlug: string;
  /** Trigger re-fetch when progress changes */
  progressKey: string;
}

interface ArticleItem {
  id: string;
  slug: string;
  title: string;
  articleType: { slug: string; name: string; icon: string };
}

export function ArticleList({ universeSlug, progressKey }: Props) {
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const fetcher = query.trim()
      ? searchArticles(universeSlug, query)
      : getArticles(universeSlug);

    fetcher.then(setArticles).finally(() => setLoading(false));
  }, [universeSlug, progressKey, query]);

  return (
    <div className="article-list">
      <div className="search-bar">
        <input
          type="search"
          placeholder="Search articles..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading && <p>Loading...</p>}

      {!loading && articles.length === 0 && (
        <p className="empty-state">
          {query
            ? "No articles match your search at your current progress."
            : "No articles available at your current progress. Set your reading progress to see content."}
        </p>
      )}

      <div className="articles-grid">
        {articles.map((a) => (
          <Link
            key={a.id}
            to={`/${universeSlug}/articles/${a.slug}`}
            className="article-card"
          >
            <span className="article-icon">{a.articleType.icon}</span>
            <span className="article-title">{a.title}</span>
            <span className="article-type">{a.articleType.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
