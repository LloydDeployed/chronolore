import type { Section, Passage, Infobox, InfoboxField, InfoboxFieldMode } from "@chronolore/shared";
import { TiptapRenderer } from "./TiptapRenderer";

interface SectionWithChildren extends Section {
  passages: Passage[];
  children?: SectionWithChildren[];
}

interface ArticlePreviewProps {
  title: string;
  articleType?: { name: string; icon: string };
  sections: SectionWithChildren[];
  infobox?: (Infobox & { fields: InfoboxField[] }) | null;
}

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

function renderPassage(passage: Passage) {
  switch (passage.passageType) {
    case "quote":
      return (
        <blockquote key={passage.id} className="passage-quote">
          <TiptapRenderer content={passage.body} />
        </blockquote>
      );
    case "note":
      return (
        <aside key={passage.id} className="passage-note">
          <TiptapRenderer content={passage.body} />
        </aside>
      );
    default:
      return <div key={passage.id} className="passage-prose"><TiptapRenderer content={passage.body} /></div>;
  }
}

function renderSection(section: SectionWithChildren, depth: number = 1) {
  const HeadingTag = depth === 1 ? "h2" : depth === 2 ? "h3" : "h4";

  return (
    <section key={section.id} className={`article-section article-section--depth-${depth}`}>
      <HeadingTag className="section-heading">{section.heading}</HeadingTag>
      {section.passages.map(renderPassage)}
      {section.children?.map((child) => renderSection(child, depth + 1))}
    </section>
  );
}

export function ArticlePreview({ title, articleType, sections, infobox }: ArticlePreviewProps) {
  const infoboxFields = infobox ? resolveInfoboxFields(infobox.fields) : [];

  return (
    <article className="article-view">
      <header>
        {articleType && (
          <span className="article-type-badge">
            {articleType.icon} {articleType.name}
          </span>
        )}
        <h1>{title}</h1>
      </header>

      <div className="article-layout">
        {infobox && infoboxFields.length > 0 && (
          <aside className="infobox">
            {infobox.imageUrl && (
              <div className="infobox-image">
                <img src={infobox.imageUrl} alt={title} />
              </div>
            )}
            <h3 className="infobox-title">{title}</h3>
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

        <div className="article-content">
          {sections.length === 0 ? (
            <p className="empty-state">No content yet.</p>
          ) : (
            sections.map((section) => renderSection(section))
          )}
        </div>
      </div>
    </article>
  );
}
