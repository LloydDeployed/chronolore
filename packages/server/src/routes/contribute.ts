import { Router, type Request, type Response } from "express";
import { db } from "../db/index.js";
import {
  articles,
  contentBlocks,
  articleTypes,
  universes,
  revealPoints,
  entries,
  segments,
} from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";

const router: Router = Router({ mergeParams: true });

router.use(requireAuth);

/**
 * Resolve a reveal point from entry slug + optional segment slug.
 * Returns the reveal point ID or null.
 */
async function resolveRevealPoint(
  entrySlug: string,
  segmentSlug?: string,
): Promise<string | null> {
  const [entry] = await db
    .select()
    .from(entries)
    .where(eq(entries.slug, entrySlug));
  if (!entry) return null;

  if (!segmentSlug) {
    // Entry-level reveal point
    const [rp] = await db
      .select()
      .from(revealPoints)
      .where(
        and(
          eq(revealPoints.entryId, entry.id),
          // segment_id IS NULL — drizzle doesn't have isNull in where easily,
          // so we use the unique constraint: entry + null segment
        ),
      );
    // Filter for null segmentId manually
    const rows = await db
      .select()
      .from(revealPoints)
      .where(eq(revealPoints.entryId, entry.id));
    const entryLevel = rows.find((r) => r.segmentId === null);
    return entryLevel?.id ?? null;
  }

  const [seg] = await db
    .select()
    .from(segments)
    .where(and(eq(segments.entryId, entry.id), eq(segments.slug, segmentSlug)));
  if (!seg) return null;

  const [rp] = await db
    .select()
    .from(revealPoints)
    .where(
      and(
        eq(revealPoints.entryId, entry.id),
        eq(revealPoints.segmentId, seg.id),
      ),
    );
  return rp?.id ?? null;
}

// POST /api/universes/:universeSlug/articles
router.post("/", async (req: AuthRequest, res: Response) => {
  const universeSlug = req.params.universeSlug as string;

  const { title, slug, articleTypeSlug, introducedAtEntry, introducedAtSegment } =
    req.body;

  if (!title || !slug || !articleTypeSlug || !introducedAtEntry) {
    return res.status(400).json({
      error:
        "title, slug, articleTypeSlug, and introducedAtEntry are required",
    });
  }

  // Find universe
  const [universe] = await db
    .select()
    .from(universes)
    .where(eq(universes.slug, universeSlug));
  if (!universe)
    return res.status(404).json({ error: "Universe not found" });

  // Find article type (check both global and universe-specific)
  const allTypes = await db.select().from(articleTypes);
  const type = allTypes.find(
    (t) =>
      t.slug === articleTypeSlug &&
      (t.universeId === null || t.universeId === universe.id),
  );
  if (!type)
    return res.status(400).json({ error: "Invalid article type" });

  // Resolve reveal point
  const rpId = await resolveRevealPoint(
    introducedAtEntry,
    introducedAtSegment,
  );
  if (!rpId)
    return res.status(400).json({ error: "Invalid introduction point" });

  // Check slug uniqueness
  const [existing] = await db
    .select()
    .from(articles)
    .where(
      and(eq(articles.universeId, universe.id), eq(articles.slug, slug)),
    );
  if (existing)
    return res.status(409).json({ error: "Article slug already exists" });

  const [article] = await db
    .insert(articles)
    .values({
      universeId: universe.id,
      articleTypeId: type.id,
      slug,
      title,
      introducedAt: rpId,
      status: "draft",
      createdBy: req.userId,
    })
    .returning();

  res.status(201).json(article);
});

// POST /api/universes/:universeSlug/articles/:articleSlug/blocks
router.post(
  "/:articleSlug/blocks",
  async (req: AuthRequest, res: Response) => {
    const universeSlug = req.params.universeSlug as string;
    const articleSlug = req.params.articleSlug as string;

    const {
      blockType,
      heading,
      body,
      metadata,
      parentId,
      sortOrder,
      revealAtEntry,
      revealAtSegment,
    } = req.body;

    if (!blockType || !revealAtEntry) {
      return res.status(400).json({
        error: "blockType and revealAtEntry are required",
      });
    }

    // Find universe + article
    const [universe] = await db
      .select()
      .from(universes)
      .where(eq(universes.slug, universeSlug));
    if (!universe)
      return res.status(404).json({ error: "Universe not found" });

    const [article] = await db
      .select()
      .from(articles)
      .where(
        and(
          eq(articles.universeId, universe.id),
          eq(articles.slug, articleSlug),
        ),
      );
    if (!article)
      return res.status(404).json({ error: "Article not found" });

    // Resolve reveal point
    const rpId = await resolveRevealPoint(revealAtEntry, revealAtSegment);
    if (!rpId)
      return res.status(400).json({ error: "Invalid reveal point" });

    const [block] = await db
      .insert(contentBlocks)
      .values({
        articleId: article.id,
        parentId: parentId ?? null,
        blockType,
        revealPointId: rpId,
        sortOrder: sortOrder ?? 0,
        heading: heading ?? null,
        body: body ?? null,
        metadata: metadata ?? {},
        status: "draft",
        createdBy: req.userId,
      })
      .returning();

    res.status(201).json(block);
  },
);

// PUT /api/universes/:universeSlug/articles/:articleSlug/blocks/:blockId
router.put(
  "/:articleSlug/blocks/:blockId",
  async (req: AuthRequest, res: Response) => {
    const blockId = req.params.blockId as string;

    const { heading, body, metadata, sortOrder, revealAtEntry, revealAtSegment } =
      req.body;

    // Find the block
    const [block] = await db
      .select()
      .from(contentBlocks)
      .where(eq(contentBlocks.id, blockId));
    if (!block)
      return res.status(404).json({ error: "Block not found" });

    // Build update payload
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (heading !== undefined) updates.heading = heading;
    if (body !== undefined) updates.body = body;
    if (metadata !== undefined) updates.metadata = metadata;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;

    if (revealAtEntry) {
      const rpId = await resolveRevealPoint(revealAtEntry, revealAtSegment);
      if (!rpId)
        return res.status(400).json({ error: "Invalid reveal point" });
      updates.revealPointId = rpId;
    }

    // Reset to draft on edit
    updates.status = "draft";

    const [updated] = await db
      .update(contentBlocks)
      .set(updates)
      .where(eq(contentBlocks.id, blockId))
      .returning();

    res.json(updated);
  },
);

// POST /api/universes/:universeSlug/articles/:articleSlug/blocks/:blockId/review
router.post(
  "/:articleSlug/blocks/:blockId/review",
  async (req: AuthRequest, res: Response) => {
    const blockId = req.params.blockId as string;

    const [updated] = await db
      .update(contentBlocks)
      .set({ status: "review", updatedAt: new Date() })
      .where(eq(contentBlocks.id, blockId))
      .returning();

    if (!updated)
      return res.status(404).json({ error: "Block not found" });

    res.json(updated);
  },
);

export default router;
