import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useTitle } from "../hooks/useTitle";
import { getUserDrafts, renameArticle, deleteArticle } from "../api/client";
import { extractText } from "../components/TiptapRenderer";

interface Props {
  isAuthenticated: boolean;
}

interface DraftArticle {
  id: string;
  slug: string;
  title: string;
  status: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

interface DraftPassage {
  id: string;
  articleId: string;
  sectionId: string;
  body: string;
  passageType: string;
  status: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export function DraftsPage({ isAuthenticated }: Props) {
  const { universeSlug } = useParams<{ universeSlug: string }>();
  useTitle("My Drafts");
  const [drafts, setDrafts] = useState<{
    articles: DraftArticle[];
    passages: DraftPassage[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchDrafts = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const data = await getUserDrafts(universeSlug!);
      setDrafts(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [universeSlug, isAuthenticated]);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const handleRename = async (article: DraftArticle) => {
    if (!renameValue.trim()) return;
    try {
      await renameArticle(universeSlug!, article.slug, renameValue.trim());
      setRenamingId(null);
      setRenameValue("");
      fetchDrafts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (article: DraftArticle) => {
    try {
      await deleteArticle(universeSlug!, article.slug);
      setConfirmDeleteId(null);
      fetchDrafts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="drafts-page">
        <p className="empty-state">Sign in to see your drafts.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="drafts-page">
        <nav className="breadcrumb">
          <Link to={`/${universeSlug}`}>← Back</Link>
        </nav>
        <div className="form-error">{error}</div>
      </div>
    );
  }

  if (loading || !drafts) {
    return <div className="drafts-page">Loading...</div>;
  }

  const groupedArticles = {
    draft: drafts.articles.filter(a => a.status === "draft"),
    review: drafts.articles.filter(a => a.status === "review"),
    rejected: drafts.articles.filter(a => a.status === "rejected"),
    published: drafts.articles.filter(a => a.status === "published"),
  };

  const groupedPassages = {
    draft: drafts.passages.filter(p => p.status === "draft"),
    review: drafts.passages.filter(p => p.status === "review"),
    rejected: drafts.passages.filter(p => p.status === "rejected"),
    published: drafts.passages.filter(p => p.status === "published"),
  };

  const renderArticleActions = (article: DraftArticle) => {
    if (renamingId === article.id) {
      return (
        <div className="draft-rename-form">
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename(article);
              if (e.key === "Escape") { setRenamingId(null); setRenameValue(""); }
            }}
            autoFocus
            placeholder="New title..."
          />
          <button className="btn-primary btn-sm" onClick={() => handleRename(article)}>Save</button>
          <button className="btn-secondary btn-sm" onClick={() => { setRenamingId(null); setRenameValue(""); }}>Cancel</button>
        </div>
      );
    }

    if (confirmDeleteId === article.id) {
      return (
        <div className="draft-confirm-delete">
          <span>Delete "{article.title}"?</span>
          <button className="btn-danger btn-sm" onClick={() => handleDelete(article)}>Yes, delete</button>
          <button className="btn-secondary btn-sm" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
        </div>
      );
    }

    return (
      <div className="draft-item-actions">
        <button
          className="btn-secondary btn-sm"
          onClick={() => { setRenamingId(article.id); setRenameValue(article.title); }}
          title="Rename"
        >
          ✏️ Rename
        </button>
        {article.status !== "published" && (
          <button
            className="btn-secondary btn-sm btn-danger-text"
            onClick={() => setConfirmDeleteId(article.id)}
            title="Delete"
          >
            🗑️ Delete
          </button>
        )}
      </div>
    );
  };

  const renderStatusSection = (
    title: string,
    articles: DraftArticle[],
    passages: DraftPassage[],
  ) => {
    if (articles.length === 0 && passages.length === 0) return null;

    return (
      <section className="drafts-section">
        <h2>{title} ({articles.length + passages.length})</h2>
        
        {articles.length > 0 && (
          <div className="drafts-group">
            <h3>Articles</h3>
            {articles.map((article) => (
              <div key={article.id} className="draft-item">
                <div className="draft-item-content">
                  <Link 
                    to={`/${universeSlug}/articles/${article.slug}/edit`}
                    className="draft-title"
                  >
                    {article.title}
                  </Link>
                  <span className={`status-badge status-${article.status}`}>
                    {article.status}
                  </span>
                </div>
                {article.status === "rejected" && article.rejectionReason && (
                  <div className="rejection-reason">
                    <strong>Reason:</strong> {article.rejectionReason}
                  </div>
                )}
                {renderArticleActions(article)}
                <div className="draft-meta">
                  Updated: {new Date(article.updatedAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}

        {passages.length > 0 && (
          <div className="drafts-group">
            <h3>Passages</h3>
            {passages.map((passage) => (
              <div key={passage.id} className="draft-item">
                <div className="draft-item-content">
                  <span className="draft-block-type">{passage.passageType}</span>
                  <span className="draft-title">
                    {extractText(passage.body ?? "", 80) || "—"}
                  </span>
                  <span className={`status-badge status-${passage.status}`}>
                    {passage.status}
                  </span>
                </div>
                {passage.status === "rejected" && passage.rejectionReason && (
                  <div className="rejection-reason">
                    <strong>Reason:</strong> {passage.rejectionReason}
                  </div>
                )}
                <div className="draft-meta">
                  Updated: {new Date(passage.updatedAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  };

  const totalItems = drafts.articles.length + drafts.passages.length;

  return (
    <div className="drafts-page">
      <nav className="breadcrumb">
        <Link to={`/${universeSlug}`}>← Back</Link>
      </nav>

      <h1>My Drafts</h1>

      {totalItems === 0 ? (
        <p className="empty-state">
          You haven't created any articles or passages yet.{" "}
          <Link to={`/${universeSlug}`}>Get started!</Link>
        </p>
      ) : (
        <>
          {renderStatusSection("Draft", groupedArticles.draft, groupedPassages.draft)}
          {renderStatusSection("Under Review", groupedArticles.review, groupedPassages.review)}
          {renderStatusSection("Published", groupedArticles.published, groupedPassages.published)}
          {renderStatusSection("Rejected", groupedArticles.rejected, groupedPassages.rejected)}
        </>
      )}
    </div>
  );
}
