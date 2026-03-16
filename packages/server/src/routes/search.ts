import { Router, type Request, type Response } from "express";
import { db } from "../db/index.js";
import { articles, articleTypes, universes } from "../db/schema.js";
import { eq, and, inArray, asc, ilike, isNull, or } from "drizzle-orm";
import {
  resolveProgress,
  type ProgressRequest,
} from "../middleware/progress.js";

const router: Router = Router({ mergeParams: true });

router.use(resolveProgress);

// GET /api/universes/:universeSlug/search?q=
router.get("/", async (req: Request, res: Response) => {
  const universeSlug = req.params.universeSlug as string;
  const query = (req.query.q as string)?.trim();
  const rpIds = (req as ProgressRequest).revealPointIds ?? [];

  if (!query) return res.json([]);

  const [universe] = await db
    .select()
    .from(universes)
    .where(eq(universes.slug, universeSlug));

  if (!universe) return res.status(404).json({ error: "Universe not found" });
  if (rpIds.length === 0) return res.json([]);

  const pattern = `%${query}%`;

  const rows = await db
    .select({
      id: articles.id,
      slug: articles.slug,
      title: articles.title,
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
        eq(articles.universeId, universe.id),
        eq(articles.status, "published"),
        or(isNull(articles.introducedAt), inArray(articles.introducedAt, rpIds)),
        ilike(articles.title, pattern),
      ),
    )
    .orderBy(asc(articles.title))
    .limit(20);

  res.json(rows);
});

export default router;
