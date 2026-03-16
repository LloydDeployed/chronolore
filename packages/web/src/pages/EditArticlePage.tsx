import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useTitle } from "../hooks/useTitle";
import { ArticlePreview } from "../components/ArticlePreview";
import { PreviewProgressPicker } from "../components/PreviewProgressPicker";
import { BlockEditor } from "../components/block-editor/BlockEditor";
import {
  getArticleForEdit,
  getArticleWithPreviewProgress,
  renameArticle,
  submitArticleForReview,
} from "../api/client";
import type {
  Article,
  Section,
  Passage,
  Infobox,
  InfoboxField,
} from "@chronolore/shared";

interface Props {
  isAuthenticated: boolean;
}

export function EditArticlePage({ isAuthenticated }: Props) {
  const { universeSlug, articleSlug } = useParams<{
    universeSlug: string;
    articleSlug: string;
  }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  useTitle(`Edit: ${articleSlug ?? ""}`);

  const [article, setArticle] = useState<Article | null>(null);
  const [articleType, setArticleType] = useState<{ name: string; icon: string } | undefined>();
  const [infobox, setInfobox] = useState<any>(null);
  const [sectionsList, setSectionsList] = useState<any[]>([]);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Preview progress simulation
  const [previewProgressIds, setPreviewProgressIds] = useState<Set<string>>(new Set());
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Title editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate(`/${universeSlug}/articles/${articleSlug}`, { replace: true });
    }
  }, [isAuthenticated, navigate, universeSlug, articleSlug]);

  const loadArticle = useCallback(async () => {
    if (!universeSlug || !articleSlug) return;
    try {
      setLoading(true);
      const data = await getArticleForEdit(universeSlug, articleSlug);
      setArticle(data);
      setArticleType(data.articleType ?? undefined);
      setInfobox(data.infobox ?? null);
      setSectionsList(
        (data.sections ?? [])
          .sort((a: Section, b: Section) => a.sortOrder - b.sortOrder)
          .map((s: any) => ({
            ...s,
            passages: (s.passages ?? []).sort((a: Passage, b: Passage) => a.sortOrder - b.sortOrder),
          })),
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [universeSlug, articleSlug]);

  useEffect(() => {
    loadArticle();
  }, [loadArticle]);

  // Fetch preview-filtered article when progress changes in preview mode
  useEffect(() => {
    if (mode !== "preview" || !universeSlug || !articleSlug) return;
    let cancelled = false;
    setPreviewLoading(true);
    getArticleWithPreviewProgress(universeSlug, articleSlug, [...previewProgressIds])
      .then((data) => {
        if (!cancelled) {
          setPreviewData(data);
        }
      })
      .catch(() => {
        // On error, show empty preview (don't fall back to full edit data)
        if (!cancelled) setPreviewData({ sections: [], infobox: null });
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => { cancelled = true; };
  }, [mode, previewProgressIds, universeSlug, articleSlug]);

  if (!isAuthenticated) return null;
  if (loading) return <div className="edit-page"><p>Loading...</p></div>;
  if (error && !article) return <div className="edit-page"><p className="form-error">{error}</p></div>;
  if (!article) return <div className="edit-page"><p>Article not found</p></div>;

  const handleTitleSave = async () => {
    if (!titleDraft.trim()) return;
    try {
      const updated = await renameArticle(universeSlug!, articleSlug!, titleDraft.trim());
      setArticle(updated);
      setEditingTitle(false);
      if (updated.slug !== articleSlug) {
        navigate(`/${universeSlug}/${updated.slug}/edit`, { replace: true });
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="edit-page">
      <nav className="breadcrumb">
        <Link to={`/${universeSlug}/articles/${articleSlug}`}>← Back to article</Link>
      </nav>

      {/* Mode toggle */}
      <div className="edit-mode-toggle">
        <button
          className={`edit-mode-tab${mode === "edit" ? " active" : ""}`}
          onClick={() => setMode("edit")}
        >
          ✏️ Edit
        </button>
        <button
          className={`edit-mode-tab${mode === "preview" ? " active" : ""}`}
          onClick={() => setMode("preview")}
        >
          👁️ Preview
        </button>
      </div>

      {mode === "preview" ? (
        <div className="block-preview-wrapper">
          <PreviewProgressPicker
            universeSlug={universeSlug!}
            articleSlug={articleSlug!}
            selectedIds={previewProgressIds}
            onChange={setPreviewProgressIds}
          />
          {previewLoading ? (
            <p className="loading-text">Loading preview…</p>
          ) : (
            <ArticlePreview
              title={article.title}
              articleType={previewData?.articleType ?? articleType}
              sections={
                previewData?.sections
                  ? previewData.sections
                      .sort((a: Section, b: Section) => a.sortOrder - b.sortOrder)
                      .map((s: any) => ({
                        ...s,
                        passages: (s.passages ?? []).sort((a: Passage, b: Passage) => a.sortOrder - b.sortOrder),
                      }))
                  : sectionsList
              }
              infobox={previewData?.infobox ?? infobox}
            />
          )}
        </div>
      ) : (
        <div className="edit-mode-content">
          {/* Article Title */}
          <div className="edit-header">
            {editingTitle ? (
              <div className="edit-title-row">
                <input
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleTitleSave()}
                  autoFocus
                />
                <button className="btn-small btn-save" onClick={handleTitleSave}>Save</button>
                <button className="btn-small btn-cancel" onClick={() => setEditingTitle(false)}>Cancel</button>
              </div>
            ) : (
              <h1
                className="edit-title"
                onClick={() => { setEditingTitle(true); setTitleDraft(article.title); }}
                title="Click to edit title"
              >
                {article.title} <span className="edit-icon">✎</span>
              </h1>
            )}
            <div className="edit-header-actions">
              <span className={`status-badge status-${article.status}`}>{article.status}</span>
              {article.status === "draft" && (
                <button
                  className="btn-primary btn-sm"
                  onClick={async () => {
                    try {
                      await submitArticleForReview(universeSlug!, articleSlug!);
                      await loadArticle();
                    } catch (err: any) {
                      setError(err.message);
                    }
                  }}
                >
                  📤 Submit Article for Review
                </button>
              )}
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}

          <BlockEditor
            article={article}
            articleType={articleType}
            sections={sectionsList}
            infobox={infobox}
            universeSlug={universeSlug!}
            articleSlug={articleSlug!}
            onReload={loadArticle}
            onError={(msg) => setError(msg)}
          />
        </div>
      )}
    </div>
  );
}
