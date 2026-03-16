import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useTitle } from "../hooks/useTitle";
import { TiptapRenderer } from "../components/TiptapRenderer";
import {
  getReviewQueue,
  getArticleForReview,
  publishArticle,
  rejectArticle,
  publishPassage,
  rejectPassage,
  publishInfoboxField,
  rejectInfoboxField,
} from "../api/client";

interface Props {
  isAuthenticated: boolean;
}

interface RevealPoint {
  entryName: string;
  segmentName: string | null;
}

interface GroupedItem {
  id: string;
  slug: string;
  title: string;
  status: string;
  articlePending: boolean;
  revealPoint: RevealPoint | null;
  pendingPassages: number;
  pendingFields: number;
}

function RevealTag({ rp }: { rp: RevealPoint | null }) {
  if (!rp) return null;
  return (
    <span className="queue-reveal-tag">
      📖 {rp.entryName}{rp.segmentName ? `, ${rp.segmentName}` : ""}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge status-${status}`}>{status}</span>;
}

// ── Article Review Detail View ──

function ArticleReview({
  universeSlug,
  articleSlug,
  onBack,
  onAction,
}: {
  universeSlug: string;
  articleSlug: string;
  onBack: () => void;
  onAction: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; type: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await getArticleForReview(universeSlug, articleSlug);
      setData(d);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [universeSlug, articleSlug]);

  useEffect(() => { load(); }, [load]);

  const handlePublish = async (type: string, id: string) => {
    try {
      if (type === "article") await publishArticle(universeSlug, id);
      else if (type === "passage") await publishPassage(universeSlug, id);
      else if (type === "field") await publishInfoboxField(universeSlug, id);
      await load();
      onAction();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    try {
      const { id, type } = rejectTarget;
      if (type === "article") await rejectArticle(universeSlug, id, rejectReason);
      else if (type === "passage") await rejectPassage(universeSlug, id, rejectReason);
      else if (type === "field") await rejectInfoboxField(universeSlug, id, rejectReason);
      setRejectTarget(null);
      setRejectReason("");
      await load();
      onAction();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) return <div className="moderate-page">Loading article...</div>;
  if (error) return <div className="moderate-page"><div className="form-error">{error}</div></div>;
  if (!data) return null;

  const { article, sections, infobox } = data;
  const articleNeedsReview = article.status === "review";

  return (
    <div className="moderate-page">
      <button className="btn-back" onClick={onBack}>← Back to queue</button>

      {/* Article header */}
      <div className="review-article-header">
        <h1>{article.title}</h1>
        <div className="review-article-meta">
          <StatusBadge status={article.status} />
          <RevealTag rp={article.revealPoint} />
        </div>

        {articleNeedsReview && (
          <div className="review-action-bar">
            <span className="review-action-label">Article needs approval before its content can be reviewed</span>
            <button className="btn-primary btn-sm" onClick={() => handlePublish("article", article.id)}>
              ✓ Publish Article
            </button>
            <button className="btn-secondary btn-sm" onClick={() => setRejectTarget({ id: article.id, type: "article" })}>
              ✗ Reject Article
            </button>
          </div>
        )}
      </div>

      {/* Content always visible — helps inform the article approval decision */}
      {articleNeedsReview && (
        <div className="review-gated-note">
          ⚠️ Article not yet published — passages and fields below cannot be published until the article is approved.
        </div>
      )}

      {(
        <>
          {/* Infobox */}
          {infobox && infobox.fields && infobox.fields.length > 0 && (
            <div className="review-infobox">
              <h3>Infobox</h3>
              <div className="review-infobox-fields">
                {infobox.fields.map((f: any) => (
                  <div key={f.id} className={`review-field ${f.status === "review" ? "review-field--pending" : ""}`}>
                    <div className="review-field-content">
                      <strong>{f.fieldLabel}:</strong> {f.fieldValue}
                      <StatusBadge status={f.status} />
                      <RevealTag rp={f.revealPoint} />
                      <span className="review-field-mode">{f.mode}</span>
                    </div>
                    {f.status === "review" && (
                      <div className="review-field-actions">
                        <button className="btn-primary btn-xs" onClick={() => handlePublish("field", f.id)} disabled={articleNeedsReview} title={articleNeedsReview ? "Approve article first" : ""}>✓</button>
                        <button className="btn-secondary btn-xs" onClick={() => setRejectTarget({ id: f.id, type: "field" })}>✗</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sections & Passages */}
          {sections.map((section: any) => (
            <div key={section.id} className="review-section">
              <h3 className="review-section-heading">{section.heading}</h3>
              {section.passages.length === 0 ? (
                <p className="review-empty">No passages in this section</p>
              ) : (
                section.passages.map((p: any) => (
                  <div key={p.id} className={`review-passage ${p.status === "review" ? "review-passage--pending" : ""}`}>
                    <div className="review-passage-content">
                      <div className="review-passage-meta">
                        <StatusBadge status={p.status} />
                        <span className="queue-block-type">{p.passageType}</span>
                        <RevealTag rp={p.revealPoint} />
                      </div>
                      <div className="review-passage-body"><TiptapRenderer content={p.body} /></div>
                    </div>
                    {p.status === "review" && (
                      <div className="review-passage-actions">
                        <button className="btn-primary btn-xs" onClick={() => handlePublish("passage", p.id)} disabled={articleNeedsReview} title={articleNeedsReview ? "Approve article first" : ""}>✓ Publish</button>
                        <button className="btn-secondary btn-xs" onClick={() => setRejectTarget({ id: p.id, type: "passage" })}>✗ Reject</button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          ))}
        </>
      )}

      {/* Rejection Modal */}
      {rejectTarget && (
        <div className="modal-overlay" onClick={() => setRejectTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Reject {rejectTarget.type}</h2>
              <button className="close-btn" onClick={() => setRejectTarget(null)}>×</button>
            </div>
            <div className="form-field">
              <label>Reason (optional)</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Why is this being rejected?"
                rows={3}
                autoFocus
              />
            </div>
            <div className="form-actions">
              <button className="btn-secondary" onClick={confirmReject}>Confirm Rejection</button>
              <button className="btn-primary" onClick={() => setRejectTarget(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Queue List ──

export function ModeratePage({ isAuthenticated }: Props) {
  const { universeSlug } = useParams<{ universeSlug: string }>();
  useTitle("Review Queue");
  const [grouped, setGrouped] = useState<GroupedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const data = await getReviewQueue(universeSlug!);
      setGrouped(data.grouped ?? []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [universeSlug, isAuthenticated]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  if (!isAuthenticated) {
    return <div className="moderate-page"><p className="empty-state">Sign in to access moderation.</p></div>;
  }

  // Detail view for a specific article
  if (selectedArticle) {
    return (
      <ArticleReview
        universeSlug={universeSlug!}
        articleSlug={selectedArticle}
        onBack={() => setSelectedArticle(null)}
        onAction={fetchQueue}
      />
    );
  }

  if (error) {
    return (
      <div className="moderate-page">
        <nav className="breadcrumb"><Link to={`/${universeSlug}`}>← Back</Link></nav>
        <div className="form-error">{error}</div>
      </div>
    );
  }

  if (loading) return <div className="moderate-page">Loading...</div>;

  return (
    <div className="moderate-page">
      <nav className="breadcrumb"><Link to={`/${universeSlug}`}>← Back</Link></nav>
      <h1>Review Queue</h1>

      {grouped.length === 0 ? (
        <p className="empty-state">Nothing to review. 🎉</p>
      ) : (
        <div className="queue-list">
          {grouped.map((item) => {
            const totalPending = (item.articlePending ? 1 : 0) + item.pendingPassages + item.pendingFields;
            return (
              <div
                key={item.id}
                className="queue-card"
                onClick={() => setSelectedArticle(item.slug)}
              >
                <div className="queue-card-main">
                  <h3 className="queue-card-title">{item.title}</h3>
                  <StatusBadge status={item.status} />
                </div>
                <div className="queue-card-meta">
                  <RevealTag rp={item.revealPoint} />
                  <span className="queue-card-counts">
                    {item.articlePending && <span className="queue-count-tag">article</span>}
                    {item.pendingPassages > 0 && (
                      <span className="queue-count-tag">{item.pendingPassages} passage{item.pendingPassages !== 1 ? "s" : ""}</span>
                    )}
                    {item.pendingFields > 0 && (
                      <span className="queue-count-tag">{item.pendingFields} field{item.pendingFields !== 1 ? "s" : ""}</span>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
