import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  getReviewQueue,
  publishArticle,
  rejectArticle,
  publishBlock,
  rejectBlock,
  bulkModerate,
} from "../api/client";

interface Props {
  isAuthenticated: boolean;
}

interface QueueArticle {
  id: string;
  slug: string;
  title: string;
  status: string;
  createdAt: string;
}

interface QueueBlock {
  id: string;
  articleId: string;
  blockType: string;
  heading?: string;
  body?: string;
  status: string;
  createdAt: string;
}

export function ModeratePage({ isAuthenticated }: Props) {
  const { universeSlug } = useParams<{ universeSlug: string }>();
  const [queue, setQueue] = useState<{
    articles: QueueArticle[];
    blocks: QueueBlock[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(
    new Set(),
  );
  const [selectedBlocks, setSelectedBlocks] = useState<Set<string>>(
    new Set(),
  );

  const fetchQueue = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const data = await getReviewQueue(universeSlug!);
      setQueue(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [universeSlug, isAuthenticated]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handlePublishArticle = async (id: string) => {
    await publishArticle(universeSlug!, id);
    fetchQueue();
  };

  const handleRejectArticle = async (id: string) => {
    await rejectArticle(universeSlug!, id);
    fetchQueue();
  };

  const handlePublishBlock = async (id: string) => {
    await publishBlock(universeSlug!, id);
    fetchQueue();
  };

  const handleRejectBlock = async (id: string) => {
    await rejectBlock(universeSlug!, id);
    fetchQueue();
  };

  const handleBulkAction = async (action: "publish" | "reject") => {
    const artIds = Array.from(selectedArticles);
    const blkIds = Array.from(selectedBlocks);
    if (artIds.length === 0 && blkIds.length === 0) return;
    await bulkModerate(
      universeSlug!,
      action,
      artIds.length > 0 ? artIds : undefined,
      blkIds.length > 0 ? blkIds : undefined,
    );
    setSelectedArticles(new Set());
    setSelectedBlocks(new Set());
    fetchQueue();
  };

  const toggleArticle = (id: string) => {
    setSelectedArticles((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleBlock = (id: string) => {
    setSelectedBlocks((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="moderate-page">
        <p className="empty-state">Sign in to access moderation.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="moderate-page">
        <nav className="breadcrumb">
          <Link to={`/${universeSlug}`}>← Back</Link>
        </nav>
        <div className="form-error">{error}</div>
      </div>
    );
  }

  if (loading || !queue) {
    return <div className="moderate-page">Loading...</div>;
  }

  const hasSelected =
    selectedArticles.size > 0 || selectedBlocks.size > 0;

  return (
    <div className="moderate-page">
      <nav className="breadcrumb">
        <Link to={`/${universeSlug}`}>← Back</Link>
      </nav>

      <h1>Review Queue</h1>

      {hasSelected && (
        <div className="bulk-actions">
          <span>
            {selectedArticles.size + selectedBlocks.size} selected
          </span>
          <button
            className="btn-primary btn-sm"
            onClick={() => handleBulkAction("publish")}
          >
            ✓ Publish Selected
          </button>
          <button
            className="btn-secondary btn-sm"
            onClick={() => handleBulkAction("reject")}
          >
            ✗ Reject Selected
          </button>
        </div>
      )}

      {queue.articles.length > 0 && (
        <section className="queue-section">
          <h2>Articles ({queue.articles.length})</h2>
          {queue.articles.map((a) => (
            <div key={a.id} className="queue-item">
              <input
                type="checkbox"
                checked={selectedArticles.has(a.id)}
                onChange={() => toggleArticle(a.id)}
              />
              <div className="queue-item-content">
                <strong>{a.title}</strong>
                <span className={`status-badge status-${a.status}`}>
                  {a.status}
                </span>
              </div>
              <div className="queue-item-actions">
                <button
                  className="btn-primary btn-sm"
                  onClick={() => handlePublishArticle(a.id)}
                >
                  Publish
                </button>
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => handleRejectArticle(a.id)}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {queue.blocks.length > 0 && (
        <section className="queue-section">
          <h2>Content Blocks ({queue.blocks.length})</h2>
          {queue.blocks.map((b) => (
            <div key={b.id} className="queue-item">
              <input
                type="checkbox"
                checked={selectedBlocks.has(b.id)}
                onChange={() => toggleBlock(b.id)}
              />
              <div className="queue-item-content">
                <span className="queue-block-type">{b.blockType}</span>
                <strong>{b.heading || b.body?.slice(0, 80) || "—"}</strong>
                <span className={`status-badge status-${b.status}`}>
                  {b.status}
                </span>
              </div>
              <div className="queue-item-actions">
                <button
                  className="btn-primary btn-sm"
                  onClick={() => handlePublishBlock(b.id)}
                >
                  Publish
                </button>
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => handleRejectBlock(b.id)}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {queue.articles.length === 0 && queue.blocks.length === 0 && (
        <p className="empty-state">Nothing to review. 🎉</p>
      )}
    </div>
  );
}
