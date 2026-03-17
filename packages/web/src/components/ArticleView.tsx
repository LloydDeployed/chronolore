import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getArticle } from "../api/client";
import { TiptapRenderer } from "./TiptapRenderer";
import type { Section, Passage, PassageContainer, Infobox, InfoboxField, InfoboxFieldMode } from "@chronolore/shared";

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
  sections: (Section & { passages: Passage[]; containers?: PassageContainer[] })[];
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

  const renderPassage = (passage: Passage, inParagraphContainer = false) => {
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
        content = <div className={`passage-prose${inParagraphContainer ? " passage-prose--continuous" : ""}`}><TiptapRenderer content={passage.body} /></div>;
    }

    return (
      <div key={passage.id} className={`passage-wrapper${inParagraphContainer ? " passage-wrapper--continuous" : ""}`}>
        {content}
        {statusBadge && (
          <div className="passage-meta">
            {statusBadge}
          </div>
        )}
      </div>
    );
  };

  /** Render a table container: build an HTML table from passages placed in cells */
  const renderTableContainer = (container: PassageContainer, containerPassages: Passage[]) => {
    const config = container.config as { columns?: { name: string; key: string }[] };
    const columns = config?.columns ?? [];
    if (columns.length === 0) return null;

    // Group passages by row
    const rowMap = new Map<number, Map<string, Passage>>();
    for (const p of containerPassages) {
      const meta = (p.containerMeta ?? {}) as { row?: number; column?: string };
      const row = meta.row ?? 0;
      const col = meta.column ?? "";
      if (!rowMap.has(row)) rowMap.set(row, new Map());
      rowMap.get(row)!.set(col, p);
    }

    const sortedRows = [...rowMap.keys()].sort((a, b) => a - b);

    return (
      <div key={container.id} className="passage-container passage-container--table">
        {container.title && <h3 className="passage-container__title">{container.title}</h3>}
        <table className="passage-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key}>{col.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((rowIdx) => {
              const rowCells = rowMap.get(rowIdx)!;
              return (
                <tr key={rowIdx}>
                  {columns.map((col) => {
                    const passage = rowCells.get(col.key);
                    return (
                      <td key={col.key}>
                        {passage ? <TiptapRenderer content={passage.body} /> : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  /** Render section content, grouping passages by containers */
  const renderSectionContent = (section: ArticleData["sections"][number]) => {
    const containers = section.containers ?? [];
    const containerMap = new Map(containers.map((c) => [c.id, c]));

    // Separate standalone passages from container passages
    const standalonePassages: Passage[] = [];
    const containerPassagesMap = new Map<string, Passage[]>();

    for (const p of section.passages) {
      if (p.containerId && containerMap.has(p.containerId)) {
        if (!containerPassagesMap.has(p.containerId)) containerPassagesMap.set(p.containerId, []);
        containerPassagesMap.get(p.containerId)!.push(p);
      } else {
        standalonePassages.push(p);
      }
    }

    // Build render items sorted by sortOrder. Containers use their own sortOrder,
    // standalone passages use their sortOrder. We interleave them.
    type RenderItem =
      | { kind: "standalone"; passage: Passage; order: number }
      | { kind: "container"; container: PassageContainer; passages: Passage[]; order: number };

    const items: RenderItem[] = [];

    for (const p of standalonePassages) {
      items.push({ kind: "standalone", passage: p, order: p.sortOrder });
    }

    for (const c of containers) {
      const cPassages = containerPassagesMap.get(c.id) ?? [];
      if (cPassages.length > 0) {
        items.push({ kind: "container", container: c, passages: cPassages, order: c.sortOrder });
      }
    }

    items.sort((a, b) => a.order - b.order);

    return items.map((item) => {
      if (item.kind === "standalone") {
        return renderPassage(item.passage);
      }
      if (item.container.type === "paragraph") {
        const sorted = [...item.passages].sort((a, b) => a.sortOrder - b.sortOrder);
        return (
          <div key={item.container.id} className="passage-container passage-container--paragraph">
            {item.container.title && <h3 className="passage-container__title">{item.container.title}</h3>}
            {sorted.map((p) => renderPassage(p, true))}
          </div>
        );
      }
      if (item.container.type === "table") {
        return renderTableContainer(item.container, item.passages);
      }
      return null;
    });
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
                {renderSectionContent(section)}
              </section>
            ))
          )}
        </div>
      </div>
    </article>
  );
}
