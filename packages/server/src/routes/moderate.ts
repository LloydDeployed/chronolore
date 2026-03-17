import { Router, type Request, type Response } from "express";
import { db } from "../db/index.js";
import {
  articles,
  passages,
  passageRevisions,
  sections,
  infoboxes,
  infoboxFields,
  universes,
  users,
  universeRoles,
  revealPoints,
  entries,
  segments,
} from "../db/schema.js";
import { eq, and, not, inArray, asc, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";

const router: Router = Router({ mergeParams: true });

router.use(requireAuth);

/**
 * Build a nested section tree from a flat list of sections.
 */
function buildSectionTree<T extends { id: string; parentId?: string | null; sortOrder: number }>(
  flatSections: T[],
): (T & { children: (T & { children: any[] })[] })[] {
  const map = new Map<string, T & { children: any[] }>();
  const roots: (T & { children: any[] })[] = [];

  for (const s of flatSections) {
    map.set(s.id, { ...s, children: [] });
  }

  for (const s of flatSections) {
    const node = map.get(s.id)!;
    if (s.parentId && map.has(s.parentId)) {
      map.get(s.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortChildren = (nodes: (T & { children: any[] })[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    for (const node of nodes) sortChildren(node.children);
  };
  sortChildren(roots);

  return roots;
}

/** Check if user is a moderator or admin for the given universe (or globally) */
async function isModerator(
  userId: string,
  universeId: string,
): Promise<boolean> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId));
  if (!user) return false;
  if (user.role === "admin" || user.role === "moderator") return true;

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

  // Articles in review — include reveal point context
  const pendingArticlesRaw = await db
    .select({
      article: articles,
      entryName: entries.name,
      segmentName: segments.name,
    })
    .from(articles)
    .leftJoin(revealPoints, eq(articles.introducedAt, revealPoints.id))
    .leftJoin(entries, eq(revealPoints.entryId, entries.id))
    .leftJoin(segments, eq(revealPoints.segmentId, segments.id))
    .where(
      and(
        eq(articles.universeId, universe.id),
        eq(articles.status, "review"),
      ),
    )
    .orderBy(asc(articles.updatedAt));

  const pendingArticles = pendingArticlesRaw.map((r) => ({
    ...r.article,
    revealPoint: r.entryName
      ? { entryName: r.entryName, segmentName: r.segmentName }
      : null,
  }));

  // Passages in review — include article, section, and reveal point context
  const allArticleRows = await db
    .select({ id: articles.id })
    .from(articles)
    .where(eq(articles.universeId, universe.id));
  const allArticleIds = allArticleRows.map((a) => a.id);

  let pendingPassages: any[] = [];
  if (allArticleIds.length > 0) {
    const allSections = await db
      .select()
      .from(sections)
      .where(inArray(sections.articleId, allArticleIds));
    const sectionIds = allSections.map((s) => s.id);
    const sectionMap = new Map(allSections.map((s) => [s.id, s]));

    // Build article lookup
    const articleRows = await db
      .select()
      .from(articles)
      .where(inArray(articles.id, allArticleIds));
    const articleMap = new Map(articleRows.map((a) => [a.id, a]));

    if (sectionIds.length > 0) {
      // Find passages directly in review status
      const rawPassages = await db
        .select({
          passage: passages,
          entryName: entries.name,
          segmentName: segments.name,
        })
        .from(passages)
        .leftJoin(revealPoints, eq(passages.revealPointId, revealPoints.id))
        .leftJoin(entries, eq(revealPoints.entryId, entries.id))
        .leftJoin(segments, eq(revealPoints.segmentId, segments.id))
        .where(
          and(
            inArray(passages.sectionId, sectionIds),
            eq(passages.status, "review"),
          ),
        )
        .orderBy(asc(passages.updatedAt));

      // Also find published passages that have revisions in review
      const revisionsInReview = await db
        .select({
          revision: passageRevisions,
          passageId: passageRevisions.passageId,
        })
        .from(passageRevisions)
        .innerJoin(passages, eq(passages.id, passageRevisions.passageId))
        .where(
          and(
            inArray(passages.sectionId, sectionIds),
            eq(passageRevisions.status, "review"),
            eq(passages.status, "published"),
          ),
        );

      const revisionPassageIds = new Set(revisionsInReview.map((r) => r.passageId));
      // Exclude passages already found above
      const directPassageIds = new Set(rawPassages.map((r) => r.passage.id));
      const additionalIds = [...revisionPassageIds].filter((id) => !directPassageIds.has(id));

      let additionalPassages: typeof rawPassages = [];
      if (additionalIds.length > 0) {
        additionalPassages = await db
          .select({
            passage: passages,
            entryName: entries.name,
            segmentName: segments.name,
          })
          .from(passages)
          .leftJoin(revealPoints, eq(passages.revealPointId, revealPoints.id))
          .leftJoin(entries, eq(revealPoints.entryId, entries.id))
          .leftJoin(segments, eq(revealPoints.segmentId, segments.id))
          .where(inArray(passages.id, additionalIds));
      }

      const allRawPassages = [...rawPassages, ...additionalPassages];

      // Build a map of revision bodies for passages with revisions in review
      const revisionBodyMap = new Map<string, string>();
      for (const r of revisionsInReview) {
        revisionBodyMap.set(r.passageId, r.revision.body);
      }

      pendingPassages = allRawPassages.map((r) => {
        const section = sectionMap.get(r.passage.sectionId);
        const article = section ? articleMap.get(section.articleId) : null;
        const hasRevisionInReview = revisionPassageIds.has(r.passage.id);
        return {
          ...r.passage,
          // If this is a published passage with a revision in review, show the revision body
          ...(hasRevisionInReview ? { pendingBody: revisionBodyMap.get(r.passage.id) } : {}),
          articleTitle: article?.title ?? null,
          articleSlug: article?.slug ?? null,
          sectionHeading: section?.heading ?? null,
          revealPoint: r.entryName
            ? { entryName: r.entryName, segmentName: r.segmentName }
            : null,
        };
      });
    }
  }

  // Infobox fields in review — include article and reveal point context
  let pendingFields: any[] = [];
  if (allArticleIds.length > 0) {
    const allInfoboxes = await db
      .select()
      .from(infoboxes)
      .where(inArray(infoboxes.articleId, allArticleIds));
    const infoboxIds = allInfoboxes.map((ib) => ib.id);
    const infoboxArticleMap = new Map(allInfoboxes.map((ib) => [ib.id, ib.articleId]));

    const articleRows = await db
      .select()
      .from(articles)
      .where(inArray(articles.id, allArticleIds));
    const articleMap = new Map(articleRows.map((a) => [a.id, a]));

    if (infoboxIds.length > 0) {
      const rawFields = await db
        .select({
          field: infoboxFields,
          entryName: entries.name,
          segmentName: segments.name,
        })
        .from(infoboxFields)
        .leftJoin(revealPoints, eq(infoboxFields.revealPointId, revealPoints.id))
        .leftJoin(entries, eq(revealPoints.entryId, entries.id))
        .leftJoin(segments, eq(revealPoints.segmentId, segments.id))
        .where(
          and(
            inArray(infoboxFields.infoboxId, infoboxIds),
            eq(infoboxFields.status, "review"),
          ),
        )
        .orderBy(asc(infoboxFields.updatedAt));

      pendingFields = rawFields.map((r) => {
        const articleId = infoboxArticleMap.get(r.field.infoboxId);
        const article = articleId ? articleMap.get(articleId) : null;
        return {
          ...r.field,
          articleTitle: article?.title ?? null,
          articleSlug: article?.slug ?? null,
          revealPoint: r.entryName
            ? { entryName: r.entryName, segmentName: r.segmentName }
            : null,
        };
      });
    }
  }

  // Group everything by article for the queue view
  // Build a map: articleId → { article info, pending counts, items }
  const articleMap = new Map<string, {
    id: string;
    slug: string;
    title: string;
    status: string;
    articlePending: boolean; // is the article itself in review?
    revealPoint: { entryName: string; segmentName: string | null } | null;
    pendingPassages: number;
    pendingFields: number;
  }>();

  // Add articles that are themselves in review
  for (const a of pendingArticles) {
    articleMap.set(a.id, {
      id: a.id,
      slug: a.slug,
      title: a.title,
      status: a.status,
      articlePending: true,
      revealPoint: a.revealPoint,
      pendingPassages: 0,
      pendingFields: 0,
    });
  }

  // Count pending passages per article (all articles, not just published)
  for (const p of pendingPassages) {
    if (!p.articleSlug) continue;
    const allArticleRows2 = await db
      .select()
      .from(articles)
      .where(eq(articles.slug, p.articleSlug));
    const art = allArticleRows2[0];
    if (!art) continue;

    const existing = articleMap.get(art.id);
    if (existing) {
      existing.pendingPassages++;
    } else {
      articleMap.set(art.id, {
        id: art.id,
        slug: art.slug,
        title: art.title,
        status: art.status,
        articlePending: false,
        revealPoint: null,
        pendingPassages: 1,
        pendingFields: 0,
      });
    }
  }

  // Count pending fields per article (all articles, not just published)
  for (const f of pendingFields) {
    if (!f.articleSlug) continue;
    const allArticleRows3 = await db
      .select()
      .from(articles)
      .where(eq(articles.slug, f.articleSlug));
    const art = allArticleRows3[0];
    if (!art) continue;

    const existing = articleMap.get(art.id);
    if (existing) {
      existing.pendingFields++;
    } else {
      articleMap.set(art.id, {
        id: art.id,
        slug: art.slug,
        title: art.title,
        status: art.status,
        articlePending: false,
        revealPoint: null,
        pendingPassages: 0,
        pendingFields: 1,
      });
    }
  }

  const grouped = Array.from(articleMap.values());

  res.json({
    // Grouped view for the queue list
    grouped,
    // Flat data still available for the detail view
    articles: pendingArticles,
    passages: pendingPassages,
    infoboxFields: pendingFields,
  });
});

// GET /api/universes/:universeSlug/moderate/articles/:articleSlug — full article review detail
router.get("/articles/:articleSlug", async (req: AuthRequest, res: Response) => {
  try {
    const universeSlug = req.params.universeSlug as string;
    const articleSlug = req.params.articleSlug as string;

    const [universe] = await db
      .select()
      .from(universes)
      .where(eq(universes.slug, universeSlug));
    if (!universe) return res.status(404).json({ error: "Universe not found" });

    if (!(await isModerator(req.userId!, universe.id)))
      return res.status(403).json({ error: "Moderator access required" });

    // Get article with reveal point
    const articleRows = await db
      .select({
        article: articles,
        entryName: entries.name,
        segmentName: segments.name,
      })
      .from(articles)
      .leftJoin(revealPoints, eq(articles.introducedAt, revealPoints.id))
      .leftJoin(entries, eq(revealPoints.entryId, entries.id))
      .leftJoin(segments, eq(revealPoints.segmentId, segments.id))
      .where(and(eq(articles.universeId, universe.id), eq(articles.slug, articleSlug)));

    if (articleRows.length === 0) return res.status(404).json({ error: "Article not found" });
    const { article, entryName, segmentName } = articleRows[0];

    // Get all sections with their passages (all statuses for context, flag pending)
    const allSections = await db
      .select()
      .from(sections)
      .where(eq(sections.articleId, article.id))
      .orderBy(asc(sections.sortOrder));

    const sectionIds = allSections.map(s => s.id);
    let allPassages: any[] = [];
    if (sectionIds.length > 0) {
      allPassages = await db
        .select({
          passage: passages,
          entryName: entries.name,
          segmentName: segments.name,
        })
        .from(passages)
        .leftJoin(revealPoints, eq(passages.revealPointId, revealPoints.id))
        .leftJoin(entries, eq(revealPoints.entryId, entries.id))
        .leftJoin(segments, eq(revealPoints.segmentId, segments.id))
        .where(inArray(passages.sectionId, sectionIds))
        .orderBy(asc(passages.sortOrder));
    }

    // Get infobox and fields
    const [infobox] = await db
      .select()
      .from(infoboxes)
      .where(eq(infoboxes.articleId, article.id));

    let allFields: any[] = [];
    if (infobox) {
      allFields = await db
        .select({
          field: infoboxFields,
          entryName: entries.name,
          segmentName: segments.name,
        })
        .from(infoboxFields)
        .leftJoin(revealPoints, eq(infoboxFields.revealPointId, revealPoints.id))
        .leftJoin(entries, eq(revealPoints.entryId, entries.id))
        .leftJoin(segments, eq(revealPoints.segmentId, segments.id))
        .where(eq(infoboxFields.infoboxId, infobox.id))
        .orderBy(asc(infoboxFields.sortOrder));
    }

    // Build structured response with nested sections
    const flatSectionsWithPassages = allSections.map(s => ({
      ...s,
      passages: allPassages
        .filter(p => p.passage.sectionId === s.id)
        .map(p => ({
          ...p.passage,
          revealPoint: p.entryName
            ? { entryName: p.entryName, segmentName: p.segmentName }
            : null,
        })),
    }));

    const sectionsWithPassages = buildSectionTree(flatSectionsWithPassages);

    const fieldsWithReveal = allFields.map(f => ({
      ...f.field,
      revealPoint: f.entryName
        ? { entryName: f.entryName, segmentName: f.segmentName }
        : null,
    }));

    res.json({
      article: {
        ...article,
        revealPoint: entryName ? { entryName, segmentName } : null,
      },
      sections: sectionsWithPassages,
      infobox: infobox ? { ...infobox, fields: fieldsWithReveal } : null,
    });
  } catch (err: any) {
    console.error("Error fetching article for review:", err);
    res.status(500).json({ error: err.message });
  }
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
    const { reason } = req.body;

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
      .set({
        status: "rejected",
        rejectionReason: reason || null,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, articleId))
      .returning();

    if (!updated)
      return res.status(404).json({ error: "Article not found" });

    res.json(updated);
  },
);

// POST /api/universes/:universeSlug/moderate/passages/:passageId/publish
router.post(
  "/passages/:passageId/publish",
  async (req: AuthRequest, res: Response) => {
    const universeSlug = req.params.universeSlug as string;
    const passageId = req.params.passageId as string;

    const [universe] = await db
      .select()
      .from(universes)
      .where(eq(universes.slug, universeSlug));
    if (!universe)
      return res.status(404).json({ error: "Universe not found" });

    if (!(await isModerator(req.userId!, universe.id))) {
      return res.status(403).json({ error: "Moderator access required" });
    }

    // Find the latest review revision for this passage
    const [reviewRevision] = await db
      .select()
      .from(passageRevisions)
      .where(and(
        eq(passageRevisions.passageId, passageId),
        eq(passageRevisions.status, "review"),
      ))
      .orderBy(desc(passageRevisions.createdAt))
      .limit(1);

    if (reviewRevision) {
      // Mark previous published revision as superseded (if any)
      const [passage] = await db.select().from(passages).where(eq(passages.id, passageId));
      if (passage?.publishedRevisionId) {
        await db.update(passageRevisions)
          .set({ status: "published" }) // keep as published (historical)
          .where(eq(passageRevisions.id, passage.publishedRevisionId));
      }

      // Publish the revision
      await db.update(passageRevisions)
        .set({ status: "published", publishedAt: new Date() })
        .where(eq(passageRevisions.id, reviewRevision.id));

      // Update passage with revision's body and set publishedRevisionId
      const [updated] = await db
        .update(passages)
        .set({
          status: "published",
          body: reviewRevision.body,
          passageType: reviewRevision.passageType,
          publishedRevisionId: reviewRevision.id,
          updatedAt: new Date(),
        })
        .where(eq(passages.id, passageId))
        .returning();

      res.json(updated);
    } else {
      // No revision in review — fall back to legacy behavior
      const [updated] = await db
        .update(passages)
        .set({ status: "published", updatedAt: new Date() })
        .where(eq(passages.id, passageId))
        .returning();

      if (!updated)
        return res.status(404).json({ error: "Passage not found" });

      res.json(updated);
    }
  },
);

// POST /api/universes/:universeSlug/moderate/passages/:passageId/reject
router.post(
  "/passages/:passageId/reject",
  async (req: AuthRequest, res: Response) => {
    const universeSlug = req.params.universeSlug as string;
    const passageId = req.params.passageId as string;
    const { reason } = req.body;

    const [universe] = await db
      .select()
      .from(universes)
      .where(eq(universes.slug, universeSlug));
    if (!universe)
      return res.status(404).json({ error: "Universe not found" });

    if (!(await isModerator(req.userId!, universe.id))) {
      return res.status(403).json({ error: "Moderator access required" });
    }

    // Reject the review revision
    const [reviewRevision] = await db
      .select()
      .from(passageRevisions)
      .where(and(
        eq(passageRevisions.passageId, passageId),
        eq(passageRevisions.status, "review"),
      ))
      .orderBy(desc(passageRevisions.createdAt))
      .limit(1);

    if (reviewRevision) {
      await db.update(passageRevisions)
        .set({ status: "rejected", rejectionReason: reason || null })
        .where(eq(passageRevisions.id, reviewRevision.id));
    }

    // Check if passage has a published revision — if so, keep it published
    const [passage] = await db.select().from(passages).where(eq(passages.id, passageId));
    if (passage?.publishedRevisionId) {
      // Passage stays published; only the revision is rejected
      // Revert passage body to the published revision's body
      const [pubRev] = await db.select().from(passageRevisions)
        .where(eq(passageRevisions.id, passage.publishedRevisionId));
      if (pubRev) {
        await db.update(passages)
          .set({ body: pubRev.body, updatedAt: new Date() })
          .where(eq(passages.id, passageId));
      }
      res.json({ ...passage, rejectedRevisionId: reviewRevision?.id });
    } else {
      // No published revision — reject the passage itself
      const [updated] = await db
        .update(passages)
        .set({
          status: "rejected",
          rejectionReason: reason || null,
          updatedAt: new Date(),
        })
        .where(eq(passages.id, passageId))
        .returning();

      if (!updated)
        return res.status(404).json({ error: "Passage not found" });

      res.json(updated);
    }
  },
);

// POST /api/universes/:universeSlug/moderate/bulk — bulk publish/reject
router.post("/bulk", async (req: AuthRequest, res: Response) => {
  const universeSlug = req.params.universeSlug as string;
  const { action, articleIds, passageIds, reason } = req.body as {
    action: "publish" | "reject";
    articleIds?: string[];
    passageIds?: string[];
    reason?: string;
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

  const newStatus = action === "publish" ? "published" : "rejected";
  let articlesUpdated = 0;
  let passagesUpdated = 0;

  if (articleIds && articleIds.length > 0) {
    const updateData: any = { status: newStatus, updatedAt: new Date() };
    if (action === "reject") updateData.rejectionReason = reason || null;
    await db
      .update(articles)
      .set(updateData)
      .where(inArray(articles.id, articleIds));
    articlesUpdated = articleIds.length;
  }

  if (passageIds && passageIds.length > 0) {
    // Update revisions in review for these passages
    for (const pid of passageIds) {
      const [reviewRev] = await db
        .select()
        .from(passageRevisions)
        .where(and(
          eq(passageRevisions.passageId, pid),
          eq(passageRevisions.status, "review"),
        ))
        .orderBy(desc(passageRevisions.createdAt))
        .limit(1);

      if (reviewRev) {
        if (action === "publish") {
          await db.update(passageRevisions)
            .set({ status: "published", publishedAt: new Date() })
            .where(eq(passageRevisions.id, reviewRev.id));
          await db.update(passages)
            .set({
              status: "published",
              body: reviewRev.body,
              passageType: reviewRev.passageType,
              publishedRevisionId: reviewRev.id,
              updatedAt: new Date(),
            })
            .where(eq(passages.id, pid));
        } else {
          await db.update(passageRevisions)
            .set({ status: "rejected", rejectionReason: reason || null })
            .where(eq(passageRevisions.id, reviewRev.id));
          // Check if passage has published revision
          const [p] = await db.select().from(passages).where(eq(passages.id, pid));
          if (!p?.publishedRevisionId) {
            await db.update(passages)
              .set({ status: "rejected", rejectionReason: reason || null, updatedAt: new Date() })
              .where(eq(passages.id, pid));
          }
        }
      } else {
        // No revision — legacy behavior
        const updateData: any = { status: newStatus, updatedAt: new Date() };
        if (action === "reject") updateData.rejectionReason = reason || null;
        await db.update(passages).set(updateData).where(eq(passages.id, pid));
      }
    }
    passagesUpdated = passageIds.length;
  }

  res.json({ action, articlesUpdated, passagesUpdated });
});

// POST /api/universes/:universeSlug/moderate/infoboxes/:infoboxId/publish
router.post(
  "/infoboxes/:infoboxId/publish",
  async (req: AuthRequest, res: Response) => {
    const universeSlug = req.params.universeSlug as string;
    const infoboxId = req.params.infoboxId as string;

    const [universe] = await db
      .select()
      .from(universes)
      .where(eq(universes.slug, universeSlug));
    if (!universe)
      return res.status(404).json({ error: "Universe not found" });
    if (!(await isModerator(req.userId!, universe.id)))
      return res.status(403).json({ error: "Moderator access required" });

    const [updated] = await db
      .update(infoboxes)
      .set({ status: "published", updatedAt: new Date() })
      .where(eq(infoboxes.id, infoboxId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Infobox not found" });
    res.json(updated);
  },
);

// POST /api/universes/:universeSlug/moderate/infoboxes/:infoboxId/reject
router.post(
  "/infoboxes/:infoboxId/reject",
  async (req: AuthRequest, res: Response) => {
    const universeSlug = req.params.universeSlug as string;
    const infoboxId = req.params.infoboxId as string;

    const [universe] = await db
      .select()
      .from(universes)
      .where(eq(universes.slug, universeSlug));
    if (!universe)
      return res.status(404).json({ error: "Universe not found" });
    if (!(await isModerator(req.userId!, universe.id)))
      return res.status(403).json({ error: "Moderator access required" });

    const { reason } = req.body;
    const [updated] = await db
      .update(infoboxes)
      .set({
        status: "rejected",
        rejectionReason: reason || null,
        updatedAt: new Date(),
      })
      .where(eq(infoboxes.id, infoboxId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Infobox not found" });
    res.json(updated);
  },
);

// POST /api/universes/:universeSlug/moderate/infobox-fields/:fieldId/publish
router.post(
  "/infobox-fields/:fieldId/publish",
  async (req: AuthRequest, res: Response) => {
    const universeSlug = req.params.universeSlug as string;
    const fieldId = req.params.fieldId as string;

    const [universe] = await db
      .select()
      .from(universes)
      .where(eq(universes.slug, universeSlug));
    if (!universe)
      return res.status(404).json({ error: "Universe not found" });
    if (!(await isModerator(req.userId!, universe.id)))
      return res.status(403).json({ error: "Moderator access required" });

    const [updated] = await db
      .update(infoboxFields)
      .set({ status: "published", updatedAt: new Date() })
      .where(eq(infoboxFields.id, fieldId))
      .returning();

    if (!updated)
      return res.status(404).json({ error: "Field not found" });

    // Auto-publish the parent infobox if it isn't already published.
    // The infobox is a container — it must be published for its fields
    // to appear in the article view.
    await db
      .update(infoboxes)
      .set({ status: "published", updatedAt: new Date() })
      .where(
        and(
          eq(infoboxes.id, updated.infoboxId),
          not(eq(infoboxes.status, "published")),
        ),
      );

    res.json(updated);
  },
);

// POST /api/universes/:universeSlug/moderate/infobox-fields/:fieldId/reject
router.post(
  "/infobox-fields/:fieldId/reject",
  async (req: AuthRequest, res: Response) => {
    const universeSlug = req.params.universeSlug as string;
    const fieldId = req.params.fieldId as string;
    const { reason } = req.body;

    const [universe] = await db
      .select()
      .from(universes)
      .where(eq(universes.slug, universeSlug));
    if (!universe)
      return res.status(404).json({ error: "Universe not found" });
    if (!(await isModerator(req.userId!, universe.id)))
      return res.status(403).json({ error: "Moderator access required" });

    const [updated] = await db
      .update(infoboxFields)
      .set({
        status: "rejected",
        rejectionReason: reason || null,
        updatedAt: new Date(),
      })
      .where(eq(infoboxFields.id, fieldId))
      .returning();

    if (!updated)
      return res.status(404).json({ error: "Field not found" });
    res.json(updated);
  },
);

export default router;
