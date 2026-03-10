import { useState, useEffect } from "react";
import { getArticle } from "../api/client";

interface Props {
  universeSlug: string;
  articleSlug: string;
  progressKey: string;
}

interface Block {
  id: string;
  blockType: string;
  heading?: string;
  body?: string;
  metadata: Record<string, unknown>;
  children: Block[];
}

interface ArticleData {
  title: string;
  slug: string;
  articleType: { name: string; icon: string };
  blocks: Block[];
}

export function ArticleView({ universeSlug, articleSlug, progressKey }: Props) {
  const [article, setArticle] = useState<ArticleData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    getArticle(universeSlug, articleSlug)
      .then(setArticle)
      .catch(() => setError("Article not found at your current progress."));
  }, [universeSlug, articleSlug, progressKey]);

  if (error) return <div className="article-error">{error}</div>;
  if (!article) return <div>Loading...</div>;

  const renderBlock = (block: Block) => {
    switch (block.blockType) {
      case "section":
        return (
          <section key={block.id} className="content-section">
            {block.heading && <h3>{block.heading}</h3>}
            {block.body && <p>{block.body}</p>}
            {block.children.map(renderBlock)}
          </section>
        );
      case "fact":
        return (
          <div key={block.id} className="content-fact">
            <p>{block.body}</p>
          </div>
        );
      case "quote":
        return (
          <blockquote key={block.id} className="content-quote">
            <p>{block.body}</p>
          </blockquote>
        );
      case "image":
        return (
          <figure key={block.id} className="content-image">
            <img
              src={block.metadata.url as string}
              alt={block.heading ?? ""}
            />
            {block.heading && <figcaption>{block.heading}</figcaption>}
          </figure>
        );
      default:
        return (
          <div key={block.id} className="content-block">
            <p>{block.body}</p>
          </div>
        );
    }
  };

  return (
    <article className="article-view">
      <header>
        <span className="article-type-badge">
          {article.articleType.icon} {article.articleType.name}
        </span>
        <h1>{article.title}</h1>
      </header>
      <div className="article-content">
        {article.blocks.length === 0 ? (
          <p className="empty-state">
            No content available at your current progress.
          </p>
        ) : (
          article.blocks.map(renderBlock)
        )}
      </div>
    </article>
  );
}
