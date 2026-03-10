import { Router, type Request, type Response } from "express";
import { db } from "../db/index.js";
import {
  articles,
  contentBlocks,
  articleTypes,
  universes,
} from "../db/schema.js";
import { eq, and, inArray, asc } from "drizzle-orm";
import {
  resolveProgress,
  type ProgressRequest,
} from "../middleware/progress.js";

const router: Router = Router({ mergeParams: true });

router.use(resolveProgress);

// GET /api/universes/:universeSlug/articles
router.get("/", async (req: Request, res: Response) => {
  const universeSlug = req.params.universeSlug as string;
  const rpIds = (req as ProgressRequest).revealPointIds ?? [];

  const [universe] = await db
    .select()
    .from(universes)
    .where(eq(universes.slug, universeSlug));

  if (!universe) return res.status(404).json({ error: "Universe not found" });
  if (rpIds.length === 0) return res.json([]);

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
        eq(articles.universeId, universe.id),
        eq(articles.status, "published"),
        inArray(articles.introducedAt, rpIds),
      ),
    )
    .orderBy(asc(articles.title));

  res.json(rows);
});

// GET /api/universes/:universeSlug/articles/:articleSlug
router.get("/:articleSlug", async (req: Request, res: Response) => {
  const universeSlug = req.params.universeSlug as string;
  const articleSlug = req.params.articleSlug as string;
  const rpIds = (req as ProgressRequest).revealPointIds ?? [];

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
        eq(articles.status, "published"),
      ),
    );

  if (!article) return res.status(404).json({ error: "Article not found" });

  // Check article is within reader's progress
  if (rpIds.length > 0 && !rpIds.includes(article.introducedAt)) {
    return res.status(404).json({ error: "Article not found" });
  }

  const [type] = await db
    .select()
    .from(articleTypes)
    .where(eq(articleTypes.id, article.articleTypeId));

  // Get content blocks filtered by progress
  const blocks =
    rpIds.length > 0
      ? await db
          .select()
          .from(contentBlocks)
          .where(
            and(
              eq(contentBlocks.articleId, article.id),
              eq(contentBlocks.status, "published"),
              inArray(contentBlocks.revealPointId, rpIds),
            ),
          )
          .orderBy(asc(contentBlocks.sortOrder))
      : [];

  // Build block tree
  const blockMap = new Map(
    blocks.map((b) => [b.id, { ...b, children: [] as any[] }]),
  );
  const rootBlocks: any[] = [];

  for (const block of blockMap.values()) {
    if (block.parentId && blockMap.has(block.parentId)) {
      blockMap.get(block.parentId)!.children.push(block);
    } else {
      rootBlocks.push(block);
    }
  }

  res.json({
    ...article,
    articleType: type,
    blocks: rootBlocks,
  });
});

export default router;
