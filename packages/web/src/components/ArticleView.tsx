import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getArticle } from "../api/client";
import { TiptapRenderer } from "./TiptapRenderer";
import type { Section, Passage, Infobox, InfoboxField, InfoboxFieldMode } from "@chronolore/shared";

interface Props {
  universeSlug: string;
  articleSlug: string;
  progressKey: string;
  currentUserId?: string;
  isAuthenticated: boolean;
  isModerator?: boolean;
}

interface ArticleData {
  title: string;
  slug: string;
  articleType: { name: string; icon: string };
  sections: (Section & { passages: Passage[] })[];
  infobox: (Infobox & { fields: InfoboxField[] }) | null;
}

/** For replace-mode fields, keep only the last by sortOrder per fieldKey. */
function resolveInfoboxFields(fields: InfoboxField[]): { label: string; values: string[] }[] {
  const grouped = new Map<string, { label: string; mode: InfoboxFieldMode; entries: InfoboxField[] }>();

  for (const f of fields) {
    if (!grouped.has(f.fieldKey)) {
      grouped.set(f.fieldKey, { label: f.fieldLabel, mode: f.mode, entries: [] });
    }
    grouped.get(f.fieldKey)!.entries.push(f);
  }

  const result: { label: string; values: string[] }[] = [];
  for (const [, group] of grouped) {
    group.entries.sort((a, b) => a.sortOrder - b.sortOrder);

    if (group.mode === "replace") {
      const last = group.entries[group.entries.length - 1];
      result.push({ label: group.label, values: [last.fieldValue] });
    } else {
      result.push({ label: group.label, values: group.entries.map((e) => e.fieldValue) });
    }
  }
  return result;
}

export function ArticleView({ universeSlug, articleSlug, progressKey, currentUserId, isAuthenticated, isModerator }: Props) {
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

  const infoboxFields = article.infobox ? resolveInfoboxFields(article.infobox.fields) : [];
  const canEdit = isAuthenticated && currentUserId && article.sections.some(
    (s) => s.passages.some((p: Passage) => p.createdBy === currentUserId)
  ) || isModerator;

  const renderPassage = (passage: Passage) => {
    const statusBadge = passage.status !== "published" ? (
      <span className={`status-badge status-${passage.status}`}>{passage.status}</span>
    ) : null;

    let content: React.JSX.Element;
    switch (passage.passageType) {
      case "quote":
        content = (
          <blockquote className="passage-quote">
            <TiptapRenderer content={passage.body} />
          </blockquote>
        );
        break;
      case "note":
        content = (
          <aside className="passage-note">
            <TiptapRenderer content={passage.body} />
          </aside>
        );
        break;
      default:
        content = <div className="passage-prose"><TiptapRenderer content={passage.body} /></div>;
    }

    return (
      <div key={passage.id} className="passage-wrapper">
        {content}
        {statusBadge && (
          <div className="passage-meta">
            {statusBadge}
          </div>
        )}
      </div>
    );
  };

  return (
    <article className="article-view">
      <header>
        <span className="article-type-badge">
          {article.articleType.icon} {article.articleType.name}
        </span>
        <h1>{article.title}</h1>
        {canEdit && (
          <Link to={`/${universeSlug}/${articleSlug}/edit`} className="btn-secondary btn-sm edit-article-link">
            ✏️ Edit
          </Link>
        )}
      </header>

      <div className="article-layout">
        {/* Infobox sidebar */}
        {article.infobox && infoboxFields.length > 0 && (
          <aside className="infobox">
            {article.infobox.imageUrl && (
              <div className="infobox-image">
                <img src={article.infobox.imageUrl} alt={article.title} />
              </div>
            )}
            <h3 className="infobox-title">{article.title}</h3>
            <dl className="infobox-fields">
              {infoboxFields.map((field, i) => (
                <div key={i} className="infobox-field">
                  <dt>{field.label}</dt>
                  {field.values.length === 1 ? (
                    <dd>{field.values[0]}</dd>
                  ) : (
                    <dd>
                      <ul className="infobox-list">
                        {field.values.map((v, j) => (
                          <li key={j}>{v}</li>
                        ))}
                      </ul>
                    </dd>
                  )}
                </div>
              ))}
            </dl>
          </aside>
        )}

        {/* Main content */}
        <div className="article-content">
          {article.sections.length === 0 ? (
            <p className="empty-state">
              No content available at your current progress.
            </p>
          ) : (
            article.sections.map((section) => (
              <section key={section.id} className="article-section">
                <h2 className="section-heading">{section.heading}</h2>
                {section.passages.map(renderPassage)}
              </section>
            ))
          )}
        </div>
      </div>
    </article>
  );
}
