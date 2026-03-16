import { Router, type Request, type Response } from "express";
import { db } from "../db/index.js";
import {
  articles,
  sections,
  passages,
  passageRevisions,
  articleTypes,
  universes,
  revealPoints,
  entries,
  segments,
  infoboxes,
  infoboxFields,
} from "../db/schema.js";
import { eq, and, asc, desc, inArray } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";

const router: Router = Router({ mergeParams: true });

router.use(requireAuth);

// GET /api/universes/:universeSlug/contribute/drafts — user's own drafts
router.get("/drafts", async (req: AuthRequest, res: Response) => {
  const universeSlug = req.params.universeSlug as string;

  const [universe] = await db
    .select()
    .from(universes)
    .where(eq(universes.slug, universeSlug));
  if (!universe)
    return res.status(404).json({ error: "Universe not found" });

  // Get all articles created by this user in this universe
  const userArticles = await db
    .select()
    .from(articles)
    .where(
      and(
        eq(articles.universeId, universe.id),
        eq(articles.createdBy, req.userId!),
      ),
    )
    .orderBy(asc(articles.updatedAt));

  // Get all passages created by this user across articles in this universe
  const userPassages = await db
    .select({
      passage: passages,
      articleId: sections.articleId,
    })
    .from(passages)
    .innerJoin(sections, eq(passages.sectionId, sections.id))
    .innerJoin(articles, eq(sections.articleId, articles.id))
    .where(
      and(
        eq(articles.universeId, universe.id),
        eq(passages.createdBy, req.userId!),
      ),
    )
    .orderBy(asc(passages.updatedAt));

  res.json({
    articles: userArticles,
    passages: userPassages.map((row) => ({ ...row.passage, articleId: row.articleId })),
  });
});

/**
 * Resolve a reveal point from entry slug + optional segment slug.
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

// GET /api/universes/:universeSlug/contribute/:articleSlug — full article for editing (all statuses)
router.get("/:articleSlug", async (req: AuthRequest, res: Response) => {
  const article = await resolveArticle(
    req.params.universeSlug as string,
    req.params.articleSlug as string,
  );
  if (!article) return res.status(404).json({ error: "Article not found" });

  const [type] = await db
    .select()
    .from(articleTypes)
    .where(eq(articleTypes.id, article.articleTypeId));

  const articleSections = await db
    .select()
    .from(sections)
    .where(eq(sections.articleId, article.id))
    .orderBy(asc(sections.sortOrder));

  const sectionIds = articleSections.map((s) => s.id);
  const allPassages = sectionIds.length > 0
    ? await db
        .select()
        .from(passages)
        .where(inArray(passages.sectionId, sectionIds))
        .orderBy(asc(passages.sortOrder))
    : [];

  // Collect all reveal point IDs to enrich with entry/segment names
  const rpIdsToResolve = new Set<string>();
  for (const p of allPassages) {
    if (p.revealPointId) rpIdsToResolve.add(p.revealPointId);
  }

  const [infobox] = await db
    .select()
    .from(infoboxes)
    .where(eq(infoboxes.articleId, article.id));

  let allFields: typeof infoboxFields.$inferSelect[] = [];
  if (infobox) {
    allFields = await db
      .select()
      .from(infoboxFields)
      .where(eq(infoboxFields.infoboxId, infobox.id))
      .orderBy(asc(infoboxFields.sortOrder));
    for (const f of allFields) {
      if (f.revealPointId) rpIdsToResolve.add(f.revealPointId);
    }
  }

  // Build reveal point details lookup
  const rpDetails = new Map<string, { entrySlug: string; entryName: string; segmentSlug?: string; segmentName?: string }>();
  if (rpIdsToResolve.size > 0) {
    const rpRows = await db
      .select({
        rpId: revealPoints.id,
        entrySlug: entries.slug,
        entryName: entries.name,
        segmentId: revealPoints.segmentId,
      })
      .from(revealPoints)
      .innerJoin(entries, eq(entries.id, revealPoints.entryId))
      .where(inArray(revealPoints.id, [...rpIdsToResolve]));

    const segmentIds = rpRows.filter((r) => r.segmentId).map((r) => r.segmentId!);
    const segmentMap = new Map<string, { slug: string; name: string }>();
    if (segmentIds.length > 0) {
      const segRows = await db
        .select({ id: segments.id, slug: segments.slug, name: segments.name })
        .from(segments)
        .where(inArray(segments.id, segmentIds));
      for (const s of segRows) segmentMap.set(s.id, { slug: s.slug, name: s.name });
    }

    for (const r of rpRows) {
      const seg = r.segmentId ? segmentMap.get(r.segmentId) : undefined;
      rpDetails.set(r.rpId, {
        entrySlug: r.entrySlug,
        entryName: r.entryName,
        segmentSlug: seg?.slug,
        segmentName: seg?.name,
      });
    }
  }

  // Get latest revisions for all passages + published revision bodies
  const allPassageIds = allPassages.map((p) => p.id);
  const latestRevisionMap = new Map<string, typeof passageRevisions.$inferSelect>();
  const publishedBodyMap = new Map<string, string>();

  if (allPassageIds.length > 0) {
    // Get all revisions for these passages
    const allRevisions = await db
      .select()
      .from(passageRevisions)
      .where(inArray(passageRevisions.passageId, allPassageIds))
      .orderBy(desc(passageRevisions.createdAt));

    for (const rev of allRevisions) {
      // Track latest revision per passage (first one due to desc order)
      if (!latestRevisionMap.has(rev.passageId)) {
        latestRevisionMap.set(rev.passageId, rev);
      }
      // Track published revision body
      if (rev.status === "published" && !publishedBodyMap.has(rev.passageId)) {
        publishedBodyMap.set(rev.passageId, rev.body);
      }
    }
  }

  const enrichPassage = (p: typeof allPassages[number]) => {
    const latestRev = latestRevisionMap.get(p.id);
    const publishedBody = publishedBodyMap.get(p.id);
    return {
      ...p,
      revealPoint: p.revealPointId ? rpDetails.get(p.revealPointId) ?? null : null,
      latestRevision: latestRev ?? null,
      publishedBody: publishedBody ?? null,
    };
  };

  const enrichField = (f: typeof allFields[number]) => ({
    ...f,
    revealPoint: f.revealPointId ? rpDetails.get(f.revealPointId) ?? null : null,
  });

  const passagesBySection = new Map<string, ReturnType<typeof enrichPassage>[]>();
  for (const p of allPassages) {
    const ep = enrichPassage(p);
    if (!passagesBySection.has(p.sectionId)) passagesBySection.set(p.sectionId, []);
    passagesBySection.get(p.sectionId)!.push(ep);
  }

  const enrichedSections = articleSections.map((s) => ({
    ...s,
    passages: passagesBySection.get(s.id) ?? [],
  }));

  res.json({
    ...article,
    articleType: type,
    sections: enrichedSections,
    infobox: infobox ? { ...infobox, fields: allFields.map(enrichField) } : null,
  });
});

// POST /api/universes/:universeSlug/articles
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const universeSlug = req.params.universeSlug as string;

    const { title, slug, articleTypeSlug, introducedAtEntry, introducedAtSegment } =
      req.body;

    if (!title || !slug || !articleTypeSlug) {
      return res.status(400).json({
        error: "title, slug, and articleTypeSlug are required",
      });
    }

    const [universe] = await db
      .select()
      .from(universes)
      .where(eq(universes.slug, universeSlug));
    if (!universe)
      return res.status(404).json({ error: "Universe not found" });

    const allTypes = await db.select().from(articleTypes);
    const type = allTypes.find(
      (t) =>
        t.slug === articleTypeSlug &&
        (t.universeId === null || t.universeId === universe.id),
    );
    if (!type)
      return res.status(400).json({ error: "Invalid article type" });

    // Resolve reveal point (nullable — omit for evergreen)
    let rpId: string | null = null;
    if (introducedAtEntry) {
      rpId = await resolveRevealPoint(introducedAtEntry, introducedAtSegment);
      if (!rpId)
        return res.status(400).json({ error: "Invalid introduction point" });
    }

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
  } catch (err: any) {
    console.error("Error creating article:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/universes/:universeSlug/articles/:articleSlug/sections
router.post(
  "/:articleSlug/sections",
  async (req: AuthRequest, res: Response) => {
    const universeSlug = req.params.universeSlug as string;
    const articleSlug = req.params.articleSlug as string;
    const { heading, sortOrder } = req.body;

    if (!heading) {
      return res.status(400).json({ error: "heading is required" });
    }

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

    const [section] = await db
      .insert(sections)
      .values({
        articleId: article.id,
        heading,
        sortOrder: sortOrder ?? 0,
      })
      .returning();

    res.status(201).json(section);
  },
);

// POST /api/universes/:universeSlug/articles/:articleSlug/sections/:sectionId/passages
router.post(
  "/:articleSlug/sections/:sectionId/passages",
  async (req: AuthRequest, res: Response) => {
    const sectionId = req.params.sectionId as string;
    const {
      body,
      sortOrder,
      revealAtEntry,
      revealAtSegment,
      passageType,
    } = req.body;

    if (!body) {
      return res.status(400).json({ error: "body is required" });
    }

    // Resolve reveal point (nullable for evergreen)
    let rpId: string | null = null;
    if (revealAtEntry) {
      rpId = await resolveRevealPoint(revealAtEntry, revealAtSegment);
      if (!rpId)
        return res.status(400).json({ error: "Invalid reveal point" });
    }

    const [passage] = await db
      .insert(passages)
      .values({
        sectionId,
        body,
        revealPointId: rpId,
        sortOrder: sortOrder ?? 0,
        passageType: passageType ?? "prose",
        status: "draft",
        createdBy: req.userId,
      })
      .returning();

    // Create initial revision
    await db.insert(passageRevisions).values({
      passageId: passage.id,
      body,
      passageType: passageType ?? "prose",
      status: "draft",
      createdBy: req.userId,
    });

    res.status(201).json(passage);
  },
);

// PUT /api/universes/:universeSlug/articles/:articleSlug — rename/edit article
router.put(
  "/:articleSlug",
  async (req: AuthRequest, res: Response) => {
    const universeSlug = req.params.universeSlug as string;
    const articleSlug = req.params.articleSlug as string;
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ error: "title is required" });
    }

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

    if (article.createdBy !== req.userId) {
      return res.status(403).json({ error: "You can only edit your own articles" });
    }

    const newSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const [updated] = await db
      .update(articles)
      .set({ title, slug: newSlug, updatedAt: new Date() })
      .where(eq(articles.id, article.id))
      .returning();

    res.json(updated);
  },
);

// DELETE /api/universes/:universeSlug/articles/:articleSlug
router.delete(
  "/:articleSlug",
  async (req: AuthRequest, res: Response) => {
    const universeSlug = req.params.universeSlug as string;
    const articleSlug = req.params.articleSlug as string;

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

    if (article.createdBy !== req.userId) {
      return res.status(403).json({ error: "You can only delete your own articles" });
    }
    if (article.status === "published") {
      return res.status(400).json({ error: "Cannot delete published articles — contact a moderator" });
    }

    // Cascade handles sections → passages deletion
    await db
      .delete(articles)
      .where(eq(articles.id, article.id));

    res.json({ deleted: true, slug: articleSlug });
  },
);

// PUT /api/universes/:universeSlug/articles/:articleSlug/passages/:passageId
router.put(
  "/:articleSlug/passages/:passageId",
  async (req: AuthRequest, res: Response) => {
    const passageId = req.params.passageId as string;
    const { body, sortOrder, revealAtEntry, revealAtSegment } = req.body;

    const [passage] = await db
      .select()
      .from(passages)
      .where(eq(passages.id, passageId));
    if (!passage)
      return res.status(404).json({ error: "Passage not found" });

    // Handle reveal point and sortOrder updates on the passage itself
    const passageUpdates: Record<string, any> = { updatedAt: new Date() };
    if (sortOrder !== undefined) passageUpdates.sortOrder = sortOrder;

    if (revealAtEntry) {
      const rpId = await resolveRevealPoint(revealAtEntry, revealAtSegment);
      if (!rpId)
        return res.status(400).json({ error: "Invalid reveal point" });
      passageUpdates.revealPointId = rpId;
    }

    if (passage.status === "published" && body !== undefined) {
      // Published passage: create a new draft revision, keep passage status as published
      const [newRevision] = await db.insert(passageRevisions).values({
        passageId: passage.id,
        body,
        passageType: passage.passageType,
        status: "draft",
        createdBy: req.userId,
      }).returning();

      // Update passage body to latest (denormalized) but do NOT change status
      passageUpdates.body = body;

      const [updated] = await db
        .update(passages)
        .set(passageUpdates)
        .where(eq(passages.id, passageId))
        .returning();

      res.json({ ...updated, latestRevision: newRevision });
    } else {
      // Draft/rejected/review: update existing draft revision
      if (body !== undefined) {
        passageUpdates.body = body;
        passageUpdates.status = "draft";

        // Find existing draft revision and update it, or create one
        const [existingDraft] = await db
          .select()
          .from(passageRevisions)
          .where(and(
            eq(passageRevisions.passageId, passageId),
            eq(passageRevisions.status, "draft"),
          ))
          .orderBy(desc(passageRevisions.createdAt))
          .limit(1);

        if (existingDraft) {
          await db.update(passageRevisions)
            .set({ body, passageType: passage.passageType })
            .where(eq(passageRevisions.id, existingDraft.id));
        } else {
          await db.insert(passageRevisions).values({
            passageId: passage.id,
            body,
            passageType: passage.passageType,
            status: "draft",
            createdBy: req.userId,
          });
        }
      } else {
        passageUpdates.status = "draft";
      }

      const [updated] = await db
        .update(passages)
        .set(passageUpdates)
        .where(eq(passages.id, passageId))
        .returning();

      res.json(updated);
    }
  },
);

// PUT /api/universes/:universeSlug/articles/:articleSlug/sections/:sectionId
router.put(
  "/:articleSlug/sections/:sectionId",
  async (req: AuthRequest, res: Response) => {
    const sectionId = req.params.sectionId as string;
    const { heading, sortOrder } = req.body;

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (heading !== undefined) updates.heading = heading;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;

    const [updated] = await db
      .update(sections)
      .set(updates)
      .where(eq(sections.id, sectionId))
      .returning();

    if (!updated)
      return res.status(404).json({ error: "Section not found" });

    res.json(updated);
  },
);

// DELETE /api/universes/:universeSlug/articles/:articleSlug/sections/:sectionId
router.delete(
  "/:articleSlug/sections/:sectionId",
  async (req: AuthRequest, res: Response) => {
    const sectionId = req.params.sectionId as string;

    const [section] = await db
      .select()
      .from(sections)
      .where(eq(sections.id, sectionId));
    if (!section)
      return res.status(404).json({ error: "Section not found" });

    // Cascade handles passage deletion
    await db.delete(sections).where(eq(sections.id, sectionId));

    res.json({ deleted: true, id: sectionId });
  },
);

// PUT /api/universes/:universeSlug/articles/:articleSlug/reorder — batch reorder sections and/or passages
router.put(
  "/:articleSlug/reorder",
  async (req: AuthRequest, res: Response) => {
    const { sectionOrder, passageOrder } = req.body as {
      sectionOrder?: { id: string; sortOrder: number }[];
      passageOrder?: { id: string; sortOrder: number; sectionId?: string }[];
    };

    try {
      if (sectionOrder) {
        for (const item of sectionOrder) {
          await db
            .update(sections)
            .set({ sortOrder: item.sortOrder, updatedAt: new Date() })
            .where(eq(sections.id, item.id));
        }
      }
      if (passageOrder) {
        for (const item of passageOrder) {
          const updates: Record<string, any> = { sortOrder: item.sortOrder, updatedAt: new Date() };
          if (item.sectionId) updates.sectionId = item.sectionId;
          await db
            .update(passages)
            .set(updates)
            .where(eq(passages.id, item.id));
        }
      }
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// DELETE /api/universes/:universeSlug/articles/:articleSlug/passages/:passageId
router.delete(
  "/:articleSlug/passages/:passageId",
  async (req: AuthRequest, res: Response) => {
    const passageId = req.params.passageId as string;

    const [passage] = await db
      .select()
      .from(passages)
      .where(eq(passages.id, passageId));
    if (!passage)
      return res.status(404).json({ error: "Passage not found" });

    await db.delete(passages).where(eq(passages.id, passageId));

    res.json({ deleted: true, id: passageId });
  },
);

// POST /api/universes/:universeSlug/articles/:articleSlug/review — submit article for review
router.post(
  "/:articleSlug/review",
  async (req: AuthRequest, res: Response) => {
    const universeSlug = req.params.universeSlug as string;
    const articleSlug = req.params.articleSlug as string;

    const [universe] = await db
      .select()
      .from(universes)
      .where(eq(universes.slug, universeSlug));
    if (!universe)
      return res.status(404).json({ error: "Universe not found" });

    const [updated] = await db
      .update(articles)
      .set({ status: "review", updatedAt: new Date() })
      .where(
        and(eq(articles.universeId, universe.id), eq(articles.slug, articleSlug)),
      )
      .returning();

    if (!updated)
      return res.status(404).json({ error: "Article not found" });

    res.json(updated);
  },
);

// POST /api/universes/:universeSlug/articles/:articleSlug/passages/:passageId/review
router.post(
  "/:articleSlug/passages/:passageId/review",
  async (req: AuthRequest, res: Response) => {
    const passageId = req.params.passageId as string;

    // Check if passage is published with a pending draft revision
    const [passage] = await db
      .select()
      .from(passages)
      .where(eq(passages.id, passageId));
    if (!passage)
      return res.status(404).json({ error: "Passage not found" });

    // Find the latest draft revision and set it to review
    const [draftRevision] = await db
      .select()
      .from(passageRevisions)
      .where(and(
        eq(passageRevisions.passageId, passageId),
        eq(passageRevisions.status, "draft"),
      ))
      .orderBy(desc(passageRevisions.createdAt))
      .limit(1);

    if (draftRevision) {
      await db.update(passageRevisions)
        .set({ status: "review" })
        .where(eq(passageRevisions.id, draftRevision.id));
    }

    // If passage is published (has a published revision), don't change passage status
    // Only change passage status if it's currently draft/rejected
    if (passage.status !== "published") {
      const [updated] = await db
        .update(passages)
        .set({ status: "review", updatedAt: new Date() })
        .where(eq(passages.id, passageId))
        .returning();
      res.json(updated);
    } else {
      // Passage stays published, but revision is now in review
      res.json({ ...passage, latestRevision: draftRevision ? { ...draftRevision, status: "review" } : null });
    }
  },
);

// ── Infobox CRUD ──

async function resolveArticle(universeSlug: string, articleSlug: string) {
  const [universe] = await db
    .select()
    .from(universes)
    .where(eq(universes.slug, universeSlug));
  if (!universe) return null;
  const [article] = await db
    .select()
    .from(articles)
    .where(
      and(eq(articles.universeId, universe.id), eq(articles.slug, articleSlug)),
    );
  if (!article) return null;
  return article;
}

// POST /:articleSlug/infobox — create infobox
router.post(
  "/:articleSlug/infobox",
  async (req: AuthRequest, res: Response) => {
    const article = await resolveArticle(
      req.params.universeSlug as string,
      req.params.articleSlug as string,
    );
    if (!article) return res.status(404).json({ error: "Article not found" });

    const { imageUrl } = req.body;

    // Check if infobox already exists
    const [existing] = await db
      .select()
      .from(infoboxes)
      .where(eq(infoboxes.articleId, article.id));
    if (existing)
      return res.status(409).json({ error: "Article already has an infobox" });

    const [infobox] = await db
      .insert(infoboxes)
      .values({
        articleId: article.id,
        imageUrl: imageUrl || null,
        status: "draft",
        createdBy: req.userId!,
      })
      .returning();

    res.status(201).json(infobox);
  },
);

// PUT /:articleSlug/infobox — update infobox
router.put(
  "/:articleSlug/infobox",
  async (req: AuthRequest, res: Response) => {
    const article = await resolveArticle(
      req.params.universeSlug as string,
      req.params.articleSlug as string,
    );
    if (!article) return res.status(404).json({ error: "Article not found" });

    const { imageUrl } = req.body;

    const [updated] = await db
      .update(infoboxes)
      .set({ imageUrl: imageUrl ?? null, status: "review", updatedAt: new Date() })
      .where(eq(infoboxes.articleId, article.id))
      .returning();

    if (!updated)
      return res.status(404).json({ error: "Infobox not found" });

    res.json(updated);
  },
);

// DELETE /:articleSlug/infobox — delete infobox (cascades to fields)
router.delete(
  "/:articleSlug/infobox",
  async (req: AuthRequest, res: Response) => {
    const article = await resolveArticle(
      req.params.universeSlug as string,
      req.params.articleSlug as string,
    );
    if (!article) return res.status(404).json({ error: "Article not found" });

    const [deleted] = await db
      .delete(infoboxes)
      .where(eq(infoboxes.articleId, article.id))
      .returning();

    if (!deleted)
      return res.status(404).json({ error: "Infobox not found" });

    res.json({ deleted: true });
  },
);

// POST /:articleSlug/infobox/fields — add field
router.post(
  "/:articleSlug/infobox/fields",
  async (req: AuthRequest, res: Response) => {
    const article = await resolveArticle(
      req.params.universeSlug as string,
      req.params.articleSlug as string,
    );
    if (!article) return res.status(404).json({ error: "Article not found" });

    const [infobox] = await db
      .select()
      .from(infoboxes)
      .where(eq(infoboxes.articleId, article.id));
    if (!infobox)
      return res.status(404).json({ error: "Infobox not found" });

    const { fieldKey, fieldLabel, fieldValue, mode, revealAtEntry, revealAtSegment, sortOrder } =
      req.body;

    if (!fieldKey || !fieldLabel || !fieldValue) {
      return res
        .status(400)
        .json({ error: "fieldKey, fieldLabel, and fieldValue are required" });
    }

    let rpId: string | null = null;
    if (revealAtEntry) {
      rpId = await resolveRevealPoint(revealAtEntry, revealAtSegment);
      if (!rpId)
        return res.status(400).json({ error: "Invalid reveal point" });
    }

    const [field] = await db
      .insert(infoboxFields)
      .values({
        infoboxId: infobox.id,
        fieldKey,
        fieldLabel,
        fieldValue,
        mode: mode ?? "replace",
        revealPointId: rpId,
        sortOrder: sortOrder ?? 0,
        createdBy: req.userId,
      })
      .returning();

    res.status(201).json(field);
  },
);

// PUT /:articleSlug/infobox/fields/:fieldId — update field
router.put(
  "/:articleSlug/infobox/fields/:fieldId",
  async (req: AuthRequest, res: Response) => {
    const fieldId = req.params.fieldId as string;
    const { fieldKey, fieldLabel, fieldValue, mode, sortOrder, revealAtEntry, revealAtSegment } =
      req.body;

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (fieldKey !== undefined) updates.fieldKey = fieldKey;
    if (fieldLabel !== undefined) updates.fieldLabel = fieldLabel;
    if (fieldValue !== undefined) updates.fieldValue = fieldValue;
    if (mode !== undefined) updates.mode = mode;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;

    if (revealAtEntry) {
      const rpId = await resolveRevealPoint(revealAtEntry, revealAtSegment);
      if (!rpId)
        return res.status(400).json({ error: "Invalid reveal point" });
      updates.revealPointId = rpId;
    }

    const [updated] = await db
      .update(infoboxFields)
      .set(updates)
      .where(eq(infoboxFields.id, fieldId))
      .returning();

    if (!updated)
      return res.status(404).json({ error: "Field not found" });

    res.json(updated);
  },
);

// POST /:articleSlug/infobox/fields/:fieldId/review — submit field for review
router.post(
  "/:articleSlug/infobox/fields/:fieldId/review",
  async (req: AuthRequest, res: Response) => {
    const fieldId = req.params.fieldId as string;

    const [updated] = await db
      .update(infoboxFields)
      .set({ status: "review", updatedAt: new Date() })
      .where(eq(infoboxFields.id, fieldId))
      .returning();

    if (!updated)
      return res.status(404).json({ error: "Field not found" });

    res.json(updated);
  },
);

// DELETE /:articleSlug/infobox/fields/:fieldId — delete field
router.delete(
  "/:articleSlug/infobox/fields/:fieldId",
  async (req: AuthRequest, res: Response) => {
    const fieldId = req.params.fieldId as string;

    const [deleted] = await db
      .delete(infoboxFields)
      .where(eq(infoboxFields.id, fieldId))
      .returning();

    if (!deleted)
      return res.status(404).json({ error: "Field not found" });

    res.json({ deleted: true, id: fieldId });
  },
);

export default router;
