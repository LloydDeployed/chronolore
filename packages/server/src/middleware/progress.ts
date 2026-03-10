import type { Request, Response, NextFunction } from "express";
import { db } from "../db/index.js";
import { entries, segments, revealPoints } from "../db/schema.js";
import { eq, and, lte } from "drizzle-orm";

export interface ProgressRequest extends Request {
  /** Resolved set of reveal point IDs the reader has access to */
  revealPointIds?: string[];
}

/**
 * Middleware that resolves the X-Chronolore-Progress header into a set of
 * reveal point IDs.
 *
 * Header format: JSON object mapping entry slugs to segment slugs or "complete".
 * Example: {"the-final-empire":"chapter-5","elantris":"complete"}
 *
 * A segment slug like "chapter-5" means "through chapter 5" — all segments
 * with sort_order <= that segment's sort_order are included.
 */
export async function resolveProgress(
  req: ProgressRequest,
  _res: Response,
  next: NextFunction,
) {
  const progressHeader = req.headers["x-chronolore-progress"] as
    | string
    | undefined;

  if (!progressHeader) {
    req.revealPointIds = [];
    return next();
  }

  try {
    const progress: Record<string, string> = JSON.parse(progressHeader);
    const allRevealPointIds: string[] = [];

    for (const [entrySlug, value] of Object.entries(progress)) {
      // Find the entry
      const [entry] = await db
        .select()
        .from(entries)
        .where(eq(entries.slug, entrySlug));
      if (!entry) continue;

      if (value === "complete") {
        // Include ALL reveal points for this entry (segments + entry-level)
        const rows = await db
          .select({ id: revealPoints.id })
          .from(revealPoints)
          .where(eq(revealPoints.entryId, entry.id));
        allRevealPointIds.push(...rows.map((r) => r.id));
      } else {
        // value is a segment slug — find its sort_order and include everything <= it
        const [targetSeg] = await db
          .select({ sortOrder: segments.sortOrder })
          .from(segments)
          .where(
            and(eq(segments.entryId, entry.id), eq(segments.slug, value)),
          );
        if (!targetSeg) continue;

        const rows = await db
          .select({ id: revealPoints.id })
          .from(revealPoints)
          .innerJoin(segments, eq(segments.id, revealPoints.segmentId))
          .where(
            and(
              eq(revealPoints.entryId, entry.id),
              lte(segments.sortOrder, targetSeg.sortOrder),
            ),
          );
        allRevealPointIds.push(...rows.map((r) => r.id));
      }
    }

    req.revealPointIds = allRevealPointIds;
  } catch {
    req.revealPointIds = [];
  }

  next();
}
