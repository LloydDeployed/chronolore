import { Router, type Request, type Response } from "express";
import { db } from "../db/index.js";
import {
  articles,
  contentBlocks,
  universes,
  users,
  universeRoles,
} from "../db/schema.js";
import { eq, and, inArray, asc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";

const router: Router = Router({ mergeParams: true });

router.use(requireAuth);

/** Check if user is a moderator or admin for the given universe (or globally) */
async function isModerator(
  userId: string,
  universeId: string,
): Promise<boolean> {
  // Check global role
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId));
  if (!user) return false;
  if (user.role === "admin" || user.role === "moderator") return true;

  // Check universe-specific role
  const [uRole] = await db
    .select()
    .from(universeRoles)
    .where(
      and(
        eq(universeRoles.userId, userId),
        eq(universeRoles.universeId, universeId),
      ),
    );
  if (uRole && (uRole.role === "admin" || uRole.role === "moderator"))
    return true;

  return false;
}

// GET /api/universes/:universeSlug/moderate/queue — review queue
router.get("/queue", async (req: AuthRequest, res: Response) => {
  const universeSlug = req.params.universeSlug as string;

  const [universe] = await db
    .select()
    .from(universes)
    .where(eq(universes.slug, universeSlug));
  if (!universe)
    return res.status(404).json({ error: "Universe not found" });

  if (!(await isModerator(req.userId!, universe.id))) {
    return res.status(403).json({ error: "Moderator access required" });
  }

  // Get articles in review or draft
  const pendingArticles = await db
    .select()
    .from(articles)
    .where(
      and(
        eq(articles.universeId, universe.id),
        inArray(articles.status, ["draft", "review"]),
      ),
    )
    .orderBy(asc(articles.updatedAt));

  // Get blocks in review or draft
  const articleIds = pendingArticles.map((a) => a.id);

  // Also get blocks from published articles that are in draft/review
  const allArticles = await db
    .select({ id: articles.id })
    .from(articles)
    .where(eq(articles.universeId, universe.id));
  const allArticleIds = allArticles.map((a) => a.id);

  const pendingBlocks =
    allArticleIds.length > 0
      ? await db
          .select()
          .from(contentBlocks)
          .where(
            and(
              inArray(contentBlocks.articleId, allArticleIds),
              inArray(contentBlocks.status, ["draft", "review"]),
            ),
          )
          .orderBy(asc(contentBlocks.updatedAt))
      : [];

  res.json({
    articles: pendingArticles,
    blocks: pendingBlocks,
  });
});

// POST /api/universes/:universeSlug/moderate/articles/:articleId/publish
router.post(
  "/articles/:articleId/publish",
  async (req: AuthRequest, res: Response) => {
    const universeSlug = req.params.universeSlug as string;
    const articleId = req.params.articleId as string;

    const [universe] = await db
      .select()
      .from(universes)
      .where(eq(universes.slug, universeSlug));
    if (!universe)
      return res.status(404).json({ error: "Universe not found" });

    if (!(await isModerator(req.userId!, universe.id))) {
      return res.status(403).json({ error: "Moderator access required" });
    }

    const [updated] = await db
      .update(articles)
      .set({ status: "published", updatedAt: new Date() })
      .where(eq(articles.id, articleId))
      .returning();

    if (!updated)
      return res.status(404).json({ error: "Article not found" });

    res.json(updated);
  },
);

// POST /api/universes/:universeSlug/moderate/articles/:articleId/reject
router.post(
  "/articles/:articleId/reject",
  async (req: AuthRequest, res: Response) => {
    const universeSlug = req.params.universeSlug as string;
    const articleId = req.params.articleId as string;

    const [universe] = await db
      .select()
      .from(universes)
      .where(eq(universes.slug, universeSlug));
    if (!universe)
      return res.status(404).json({ error: "Universe not found" });

    if (!(await isModerator(req.userId!, universe.id))) {
      return res.status(403).json({ error: "Moderator access required" });
    }

    const [updated] = await db
      .update(articles)
      .set({ status: "draft", updatedAt: new Date() })
      .where(eq(articles.id, articleId))
      .returning();

    if (!updated)
      return res.status(404).json({ error: "Article not found" });

    res.json(updated);
  },
);

// POST /api/universes/:universeSlug/moderate/blocks/:blockId/publish
router.post(
  "/blocks/:blockId/publish",
  async (req: AuthRequest, res: Response) => {
    const universeSlug = req.params.universeSlug as string;
    const blockId = req.params.blockId as string;

    const [universe] = await db
      .select()
      .from(universes)
      .where(eq(universes.slug, universeSlug));
    if (!universe)
      return res.status(404).json({ error: "Universe not found" });

    if (!(await isModerator(req.userId!, universe.id))) {
      return res.status(403).json({ error: "Moderator access required" });
    }

    const [updated] = await db
      .update(contentBlocks)
      .set({ status: "published", updatedAt: new Date() })
      .where(eq(contentBlocks.id, blockId))
      .returning();

    if (!updated)
      return res.status(404).json({ error: "Block not found" });

    res.json(updated);
  },
);

// POST /api/universes/:universeSlug/moderate/blocks/:blockId/reject
router.post(
  "/blocks/:blockId/reject",
  async (req: AuthRequest, res: Response) => {
    const universeSlug = req.params.universeSlug as string;
    const blockId = req.params.blockId as string;

    const [universe] = await db
      .select()
      .from(universes)
      .where(eq(universes.slug, universeSlug));
    if (!universe)
      return res.status(404).json({ error: "Universe not found" });

    if (!(await isModerator(req.userId!, universe.id))) {
      return res.status(403).json({ error: "Moderator access required" });
    }

    const [updated] = await db
      .update(contentBlocks)
      .set({ status: "draft", updatedAt: new Date() })
      .where(eq(contentBlocks.id, blockId))
      .returning();

    if (!updated)
      return res.status(404).json({ error: "Block not found" });

    res.json(updated);
  },
);

// POST /api/universes/:universeSlug/moderate/bulk — bulk publish/reject
router.post("/bulk", async (req: AuthRequest, res: Response) => {
  const universeSlug = req.params.universeSlug as string;
  const { action, articleIds, blockIds } = req.body as {
    action: "publish" | "reject";
    articleIds?: string[];
    blockIds?: string[];
  };

  if (!action || !["publish", "reject"].includes(action)) {
    return res.status(400).json({ error: "action must be 'publish' or 'reject'" });
  }

  const [universe] = await db
    .select()
    .from(universes)
    .where(eq(universes.slug, universeSlug));
  if (!universe)
    return res.status(404).json({ error: "Universe not found" });

  if (!(await isModerator(req.userId!, universe.id))) {
    return res.status(403).json({ error: "Moderator access required" });
  }

  const newStatus = action === "publish" ? "published" : "draft";
  let articlesUpdated = 0;
  let blocksUpdated = 0;

  if (articleIds && articleIds.length > 0) {
    const result = await db
      .update(articles)
      .set({ status: newStatus as any, updatedAt: new Date() })
      .where(inArray(articles.id, articleIds));
    articlesUpdated = articleIds.length;
  }

  if (blockIds && blockIds.length > 0) {
    const result = await db
      .update(contentBlocks)
      .set({ status: newStatus as any, updatedAt: new Date() })
      .where(inArray(contentBlocks.id, blockIds));
    blocksUpdated = blockIds.length;
  }

  res.json({ action, articlesUpdated, blocksUpdated });
});

export default router;
