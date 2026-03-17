import { Router, type Request, type Response } from "express";
import { db } from "../db/index.js";
import {
  articles,
  sections,
  passages,
  passageRevisions,
  passageContainers,
  infoboxes,
  infoboxFields,
  articleTypes,
  universes,
  revealPoints,
  entries,
  segments,
  series,
} from "../db/schema.js";
import { eq, and, inArray, asc, isNull, or, isNotNull } from "drizzle-orm";
import {
  resolveProgress,
  type ProgressRequest,
} from "../middleware/progress.js";
import { optionalAuth, type AuthRequest } from "../middleware/auth.js";

const router: Router = Router({ mergeParams: true });

router.use(resolveProgress);

// GET /api/universes/:universeSlug/articles/:articleSlug/reveal-points
// Returns distinct reveal points used by this article's passages + infobox fields
router.get("/:articleSlug/reveal-points", optionalAuth, async (req: AuthRequest, res: Response) => {
  const universeSlug = req.params.universeSlug as string;
  const articleSlug = req.params.articleSlug as string;

  // Require authentication (contributor/moderator/admin)
  if (!req.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const [universe] = await db
    .select()
    .from(universes)
    .where(eq(universes.slug, universeSlug));
  if (!universe) return res.status(404).json({ error: "Universe not found" });

  const [article] = await db
    .select()
    .from(articles)
    .where(
      and(
        eq(articles.universeId, universe.id),
        eq(articles.slug, articleSlug),
      ),
    );
  if (!article) return res.status(404).json({ error: "Article not found" });

  // Collect distinct reveal_point_ids from passages
  const articleSections = await db
    .select({ id: sections.id })
    .from(sections)
    .where(eq(sections.articleId, article.id));

  const sectionIds = articleSections.map((s) => s.id);
  const rpIdSet = new Set<string>();

  if (sectionIds.length > 0) {
    const passageRps = await db
      .select({ revealPointId: passages.revealPointId })
      .from(passages)
      .where(
        and(
          inArray(passages.sectionId, sectionIds),
          isNotNull(passages.revealPointId),
        ),
      );
    for (const p of passageRps) {
      if (p.revealPointId) rpIdSet.add(p.revealPointId);
    }
  }

  // Collect from infobox fields
  const [infobox] = await db
    .select()
    .from(infoboxes)
    .where(eq(infoboxes.articleId, article.id));

  if (infobox) {
    const fieldRps = await db
      .select({ revealPointId: infoboxFields.revealPointId })
      .from(infoboxFields)
      .where(
        and(
          eq(infoboxFields.infoboxId, infobox.id),
          isNotNull(infoboxFields.revealPointId),
        ),
      );
    for (const f of fieldRps) {
      if (f.revealPointId) rpIdSet.add(f.revealPointId);
    }
  }

  if (rpIdSet.size === 0) {
    return res.json([]);
  }

  // Resolve reveal points to human-readable names
  const rpRows = await db
    .select({
      revealPointId: revealPoints.id,
      entryId: entries.id,
      entryName: entries.name,
      entrySortOrder: entries.sortOrder,
      seriesId: series.id,
      seriesName: series.name,
      seriesSortOrder: series.sortOrder,
      segmentId: segments.id,
      segmentName: segments.name,
      segmentSortOrder: segments.sortOrder,
    })
    .from(revealPoints)
    .innerJoin(entries, eq(entries.id, revealPoints.entryId))
    .leftJoin(series, eq(series.id, entries.seriesId))
    .leftJoin(segments, eq(segments.id, revealPoints.segmentId))
    .where(inArray(revealPoints.id, [...rpIdSet]));

  // Sort by series → entry → segment sort_order
  rpRows.sort((a, b) => {
    const sa = a.seriesSortOrder ?? 0;
    const sb = b.seriesSortOrder ?? 0;
    if (sa !== sb) return sa - sb;
    if (a.entrySortOrder !== b.entrySortOrder) return a.entrySortOrder - b.entrySortOrder;
    const sga = a.segmentSortOrder ?? 0;
    const sgb = b.segmentSortOrder ?? 0;
    return sga - sgb;
  });

  const result = rpRows.map((r) => ({
    revealPointId: r.revealPointId,
    seriesName: r.seriesName ?? undefined,
    entryName: r.entryName,
    segmentName: r.segmentName ?? undefined,
    sortKey: `${r.seriesSortOrder ?? 0}-${r.entrySortOrder}-${r.segmentSortOrder ?? 0}`,
  }));

  res.json(result);
});

// GET /api/universes/:universeSlug/articles
router.get("/", async (req: Request, res: Response) => {
  const universeSlug = req.params.universeSlug as string;
  const rpIds = (req as ProgressRequest).revealPointIds ?? [];

  const [universe] = await db
    .select()
    .from(universes)
    .where(eq(universes.slug, universeSlug));

  if (!universe) return res.status(404).json({ error: "Universe not found" });

  // Articles are visible if introducedAt is null (evergreen) or in reader's progress
  const conditions = [
    eq(articles.universeId, universe.id),
    eq(articles.status, "published"),
  ];

  // If reader has progress, show evergreen + matching articles
  // If no progress, only show evergreen articles
  if (rpIds.length > 0) {
    conditions.push(
      or(isNull(articles.introducedAt), inArray(articles.introducedAt, rpIds))!,
    );
  } else {
    conditions.push(isNull(articles.introducedAt));
  }

  const rows = await db
    .select({
      id: articles.id,
      slug: articles.slug,
      title: articles.title,
      status: articles.status,
      articleType: {
        slug: articleTypes.slug,
        name: articleTypes.name,
        icon: articleTypes.icon,
      },
    })
    .from(articles)
    .innerJoin(articleTypes, eq(articleTypes.id, articles.articleTypeId))
    .where(
      and(
        ...conditions,
        or(
          isNull(articles.introducedAt),
          inArray(articles.introducedAt, rpIds),
        ),
      ),
    )
    .orderBy(asc(articles.title));

  res.json(rows);
});

// GET /api/universes/:universeSlug/articles/:articleSlug
router.get("/:articleSlug", optionalAuth, async (req: AuthRequest & ProgressRequest, res: Response) => {
  const universeSlug = req.params.universeSlug as string;
  const articleSlug = req.params.articleSlug as string;

  // Preview progress override: authenticated contributors/moderators/admins can
  // pass X-Preview-Progress header with comma-separated reveal point IDs
  const previewProgressHeader = req.headers["x-preview-progress"] as string | undefined;
  let rpIds: string[];
  if (previewProgressHeader && req.userId) {
    rpIds = previewProgressHeader.split(",").map((s) => s.trim()).filter(Boolean);
  } else {
    rpIds = (req as ProgressRequest).revealPointIds ?? [];
  }

  const [universe] = await db
    .select()
    .from(universes)
    .where(eq(universes.slug, universeSlug));

  if (!universe) return res.status(404).json({ error: "Universe not found" });

  // In preview mode (authenticated + X-Preview-Progress), allow any status
  // Normal readers only see published articles
  const isPreview = !!previewProgressHeader && !!req.userId;
  const articleConditions = [
    eq(articles.universeId, universe.id),
    eq(articles.slug, articleSlug),
  ];
  if (!isPreview) {
    articleConditions.push(eq(articles.status, "published"));
  }

  const [article] = await db
    .select()
    .from(articles)
    .where(and(...articleConditions));

  if (!article) return res.status(404).json({ error: "Article not found" });

  // Check article is within reader's progress (null introducedAt = always visible)
  // Skip this check for preview progress (authenticated users simulating progress)
  const isPreviewMode = !!previewProgressHeader && !!req.userId;
  if (article.introducedAt && !isPreviewMode) {
    if (rpIds.length === 0 || !rpIds.includes(article.introducedAt)) {
      return res.status(404).json({ error: "Article not found at your current progress" });
    }
  }

  const [type] = await db
    .select()
    .from(articleTypes)
    .where(eq(articleTypes.id, article.articleTypeId));

  // Get sections for this article
  const articleSections = await db
    .select()
    .from(sections)
    .where(eq(sections.articleId, article.id))
    .orderBy(asc(sections.sortOrder));

  // Get containers for all sections
  const sectionIds = articleSections.map((s) => s.id);

  const allContainers = sectionIds.length > 0
    ? await db
        .select()
        .from(passageContainers)
        .where(inArray(passageContainers.sectionId, sectionIds))
        .orderBy(asc(passageContainers.sortOrder))
    : [];

  // Get passages filtered by progress
  let visiblePassages: typeof passages.$inferSelect[] = [];
  if (sectionIds.length > 0) {
    const passageConditions = [
      inArray(passages.sectionId, sectionIds),
      eq(passages.status, "published"),
    ];
    // If reader has progress, show evergreen + matching passages
    // If no progress, only show evergreen passages
    if (rpIds.length > 0) {
      passageConditions.push(
        or(isNull(passages.revealPointId), inArray(passages.revealPointId, rpIds))!,
      );
    } else {
      passageConditions.push(isNull(passages.revealPointId));
    }
    visiblePassages = await db
      .select()
      .from(passages)
      .where(and(...passageConditions))
      .orderBy(asc(passages.sortOrder));
  }

  // Get infobox + fields
  const [infobox] = await db
    .select()
    .from(infoboxes)
    .where(
      and(
        eq(infoboxes.articleId, article.id),
        eq(infoboxes.status, "published"),
      ),
    );

  let visibleFields: typeof infoboxFields.$inferSelect[] = [];
  if (infobox) {
    const fieldConditions = [
      eq(infoboxFields.infoboxId, infobox.id),
      eq(infoboxFields.status, "published"),
    ];
    if (rpIds.length > 0) {
      fieldConditions.push(
        or(isNull(infoboxFields.revealPointId), inArray(infoboxFields.revealPointId, rpIds))!,
      );
    } else {
      fieldConditions.push(isNull(infoboxFields.revealPointId));
    }
    visibleFields = await db
      .select()
      .from(infoboxFields)
      .where(and(...fieldConditions))
      .orderBy(asc(infoboxFields.sortOrder));
  }

  // For passages with a publishedRevisionId, use the revision's body
  // (the passage.body may have been updated by a contributor with a new draft)
  const publishedRevisionIds = visiblePassages
    .filter((p) => p.publishedRevisionId)
    .map((p) => p.publishedRevisionId!);

  const revisionBodyMap = new Map<string, string>();
  if (publishedRevisionIds.length > 0) {
    const revRows = await db
      .select({ id: passageRevisions.id, body: passageRevisions.body })
      .from(passageRevisions)
      .where(inArray(passageRevisions.id, publishedRevisionIds));
    for (const r of revRows) revisionBodyMap.set(r.id, r.body);
  }

  // Override passage body with published revision body when available
  const resolvedPassages = visiblePassages.map((p) => {
    if (p.publishedRevisionId && revisionBodyMap.has(p.publishedRevisionId)) {
      return { ...p, body: revisionBodyMap.get(p.publishedRevisionId)! };
    }
    return p;
  });

  // Group passages by section, filter out empty sections
  const passagesBySection = new Map<string, typeof resolvedPassages>();
  for (const p of resolvedPassages) {
    if (!passagesBySection.has(p.sectionId)) passagesBySection.set(p.sectionId, []);
    passagesBySection.get(p.sectionId)!.push(p);
  }

  const containersBySection = new Map<string, typeof allContainers>();
  for (const c of allContainers) {
    if (!containersBySection.has(c.sectionId)) containersBySection.set(c.sectionId, []);
    containersBySection.get(c.sectionId)!.push(c);
  }

  const enrichedSections = articleSections
    .map((s) => ({
      ...s,
      passages: passagesBySection.get(s.id) ?? [],
      containers: containersBySection.get(s.id) ?? [],
    }))
    .filter((s) => s.passages.length > 0); // Section visible only if it has visible passages

  res.json({
    ...article,
    articleType: type,
    sections: enrichedSections,
    infobox: infobox
      ? { ...infobox, fields: visibleFields }
      : null,
  });
});

export default router;
