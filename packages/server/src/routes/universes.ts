import { Router, type Request, type Response } from "express";
import { db } from "../db/index.js";
import { universes, series, entries, segments } from "../db/schema.js";
import { eq, asc, inArray } from "drizzle-orm";

const router: Router = Router();

// GET /api/universes
router.get("/", async (_req: Request, res: Response) => {
  console.log("GET /api/universes - starting query");
  try {
    const rows = await db.select().from(universes).orderBy(asc(universes.name));
    console.log("GET /api/universes - got", rows.length, "rows");
    res.json(rows);
  } catch (err) {
    console.error("GET /api/universes - error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/universes/:universeSlug
router.get("/:universeSlug", async (req: Request, res: Response) => {
  const slug = req.params.universeSlug as string;
  const [row] = await db
    .select()
    .from(universes)
    .where(eq(universes.slug, slug));

  if (!row) return res.status(404).json({ error: "Universe not found" });
  res.json(row);
});

// GET /api/universes/:universeSlug/media — full media tree for progress picker
router.get("/:universeSlug/media", async (req: Request, res: Response) => {
  const slug = req.params.universeSlug as string;

  const [universe] = await db
    .select()
    .from(universes)
    .where(eq(universes.slug, slug));

  if (!universe) return res.status(404).json({ error: "Universe not found" });

  const allSeries = await db
    .select()
    .from(series)
    .where(eq(series.universeId, universe.id))
    .orderBy(asc(series.sortOrder));

  const allEntries = await db
    .select()
    .from(entries)
    .where(eq(entries.universeId, universe.id))
    .orderBy(asc(entries.sortOrder));

  const entryIds = allEntries.map((e) => e.id);
  const allSegments =
    entryIds.length > 0
      ? await db
          .select()
          .from(segments)
          .where(inArray(segments.entryId, entryIds))
          .orderBy(asc(segments.sortOrder))
      : [];

  // Group segments by entry
  const segsByEntry = new Map<string, (typeof allSegments)>();
  for (const seg of allSegments) {
    if (!segsByEntry.has(seg.entryId)) segsByEntry.set(seg.entryId, []);
    segsByEntry.get(seg.entryId)!.push(seg);
  }

  const enrichEntry = (e: (typeof allEntries)[0]) => ({
    ...e,
    segments: segsByEntry.get(e.id) ?? [],
  });

  res.json({
    universe,
    series: allSeries.map((s) => ({
      ...s,
      entries: allEntries.filter((e) => e.seriesId === s.id).map(enrichEntry),
    })),
    ungrouped: allEntries.filter((e) => !e.seriesId).map(enrichEntry),
  });
});

export default router;
