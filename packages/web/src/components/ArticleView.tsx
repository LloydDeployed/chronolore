import { useState, useEffect } from "react";
import { getArticle, updatePassage } from "../api/client";
import { TiptapEditor } from "./TiptapEditor";
import { TiptapRenderer } from "./TiptapRenderer";
import type { Section, Passage, Infobox, InfoboxField, InfoboxFieldMode } from "@chronolore/shared";

interface Props {
  universeSlug: string;
  articleSlug: string;
  progressKey: string;
  currentUserId?: string;
  isAuthenticated: boolean;
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
    // Sort by sortOrder ascending
    group.entries.sort((a, b) => a.sortOrder - b.sortOrder);

    if (group.mode === "replace") {
      // Latest value wins
      const last = group.entries[group.entries.length - 1];
      result.push({ label: group.label, values: [last.fieldValue] });
    } else {
      // Append: show all
      result.push({ label: group.label, values: group.entries.map((e) => e.fieldValue) });
    }
  }
  return result;
}

export function ArticleView({ universeSlug, articleSlug, progressKey, currentUserId, isAuthenticated }: Props) {
  const [article, setArticle] = useState<ArticleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingPassageId, setEditingPassageId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  useEffect(() => {
    setError(null);
    getArticle(universeSlug, articleSlug)
      .then(setArticle)
      .catch(() => setError("Article not found at your current progress."));
  }, [universeSlug, articleSlug, progressKey]);

  const startEditing = (passage: Passage) => {
    setEditingPassageId(passage.id);
    setEditBody(passage.body);
  };

  const cancelEditing = () => {
    setEditingPassageId(null);
    setEditBody("");
  };

  const savePassage = async (passageId: string) => {
    try {
      await updatePassage(universeSlug, articleSlug, passageId, { body: editBody });
      setEditingPassageId(null);
      const updated = await getArticle(universeSlug, articleSlug);
      setArticle(updated);
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (error) return <div className="article-error">{error}</div>;
  if (!article) return <div>Loading...</div>;

  const infoboxFields = article.infobox ? resolveInfoboxFields(article.infobox.fields) : [];

  const renderPassage = (passage: Passage) => {
    const canEdit = isAuthenticated && currentUserId && passage.createdBy === currentUserId;
    const isEditing = editingPassageId === passage.id;

    if (isEditing) {
      return (
        <div key={passage.id} className="passage-edit-form">
          <div className="form-field">
            <label>Content</label>
            <TiptapEditor content={editBody} onChange={setEditBody} editable={true} />
          </div>
          <div className="form-actions">
            <button className="btn-primary btn-sm" onClick={() => savePassage(passage.id)}>Save</button>
            <button className="btn-secondary btn-sm" onClick={cancelEditing}>Cancel</button>
          </div>
        </div>
      );
    }

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
        {(statusBadge || canEdit) && (
          <div className="passage-meta">
            {statusBadge}
            {canEdit && (
              <button className="btn-secondary btn-sm edit-passage-btn" onClick={() => startEditing(passage)}>
                Edit
              </button>
            )}
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
