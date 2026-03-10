import { db } from "./index.js";
import {
  universes,
  series,
  entries,
  segments,
  revealPoints,
  articleTypes,
} from "./schema.js";

/**
 * Seed the Cosmere universe with Mistborn Era 1 media hierarchy.
 *
 * Chapter breakdowns per book (by Part):
 *
 * The Final Empire: Prologue + 38 chapters + Epilogue
 *   Part 1 (Ch 1–6), Part 2 (Ch 7–11), Part 3 (Ch 12–21),
 *   Part 4 (Ch 22–29), Part 5 (Ch 30–38), Epilogue
 *
 * The Well of Ascension: Prologue + 58 chapters + Epilogue
 *   Part 1 (Ch 1–8), Part 2 (Ch 9–16), Part 3 (Ch 17–25),
 *   Part 4 (Ch 26–35), Part 5 (Ch 36–46), Part 6 (Ch 47–58), Epilogue
 *
 * The Hero of Ages: Prologue + 82 chapters + Epilogue
 *   Part 1 (Ch 1–15), Part 2 (Ch 16–28), Part 3 (Ch 29–43),
 *   Part 4 (Ch 44–62), Part 5 (Ch 63–82), Epilogue
 */

interface BookDef {
  slug: string;
  name: string;
  parts: { name: string; startCh: number; endCh: number }[];
  hasPrologue: boolean;
  hasEpilogue: boolean;
}

const MISTBORN_ERA_1: BookDef[] = [
  {
    slug: "the-final-empire",
    name: "The Final Empire",
    hasPrologue: true,
    hasEpilogue: true,
    parts: [
      { name: "Part 1", startCh: 1, endCh: 6 },
      { name: "Part 2", startCh: 7, endCh: 11 },
      { name: "Part 3", startCh: 12, endCh: 21 },
      { name: "Part 4", startCh: 22, endCh: 29 },
      { name: "Part 5", startCh: 30, endCh: 38 },
    ],
  },
  {
    slug: "the-well-of-ascension",
    name: "The Well of Ascension",
    hasPrologue: true,
    hasEpilogue: true,
    parts: [
      { name: "Part 1", startCh: 1, endCh: 8 },
      { name: "Part 2", startCh: 9, endCh: 16 },
      { name: "Part 3", startCh: 17, endCh: 25 },
      { name: "Part 4", startCh: 26, endCh: 35 },
      { name: "Part 5", startCh: 36, endCh: 46 },
      { name: "Part 6", startCh: 47, endCh: 58 },
    ],
  },
  {
    slug: "the-hero-of-ages",
    name: "The Hero of Ages",
    hasPrologue: true,
    hasEpilogue: true,
    parts: [
      { name: "Part 1", startCh: 1, endCh: 15 },
      { name: "Part 2", startCh: 16, endCh: 28 },
      { name: "Part 3", startCh: 29, endCh: 43 },
      { name: "Part 4", startCh: 44, endCh: 62 },
      { name: "Part 5", startCh: 63, endCh: 82 },
    ],
  },
];

const BUILT_IN_ARTICLE_TYPES = [
  { slug: "character", name: "Character", icon: "👤" },
  { slug: "location", name: "Location", icon: "📍" },
  { slug: "event", name: "Event", icon: "⚡" },
  { slug: "organization", name: "Organization", icon: "🏛️" },
  { slug: "item", name: "Item", icon: "🔮" },
  { slug: "concept", name: "Concept", icon: "💡" },
];

async function seed() {
  console.log("Seeding Chronolore database...\n");

  // ── Universe ──
  const [cosmere] = await db
    .insert(universes)
    .values({
      slug: "cosmere",
      name: "The Cosmere",
      description:
        "Brandon Sanderson's interconnected universe of fantasy worlds, including Scadrial, Roshar, Sel, and more.",
    })
    .returning();
  console.log(`✓ Universe: ${cosmere.name}`);

  // ── Series ──
  const [mistbornEra1] = await db
    .insert(series)
    .values({
      universeId: cosmere.id,
      slug: "mistborn-era-1",
      name: "Mistborn Era 1",
      sortOrder: 0,
    })
    .returning();
  console.log(`✓ Series: ${mistbornEra1.name}`);

  // ── Entries, Segments, and Reveal Points ──
  for (let bookIdx = 0; bookIdx < MISTBORN_ERA_1.length; bookIdx++) {
    const bookDef = MISTBORN_ERA_1[bookIdx];

    const [entry] = await db
      .insert(entries)
      .values({
        universeId: cosmere.id,
        seriesId: mistbornEra1.id,
        slug: bookDef.slug,
        name: bookDef.name,
        entryType: "book",
        sortOrder: bookIdx,
      })
      .returning();
    console.log(`  ✓ Entry: ${entry.name}`);

    // Entry-level reveal point (for movies or "finished the book" tagging)
    await db.insert(revealPoints).values({
      universeId: cosmere.id,
      entryId: entry.id,
      segmentId: null,
    });

    let segmentOrder = 0;

    // Prologue
    if (bookDef.hasPrologue) {
      const [seg] = await db
        .insert(segments)
        .values({
          entryId: entry.id,
          slug: "prologue",
          name: "Prologue",
          segmentType: "chapter",
          sortOrder: segmentOrder++,
        })
        .returning();

      await db.insert(revealPoints).values({
        universeId: cosmere.id,
        entryId: entry.id,
        segmentId: seg.id,
      });
    }

    // Parts and chapters
    for (const part of bookDef.parts) {
      // Part as a segment (type: part)
      const [partSeg] = await db
        .insert(segments)
        .values({
          entryId: entry.id,
          slug: part.name.toLowerCase().replace(/\s+/g, "-"),
          name: part.name,
          segmentType: "part",
          sortOrder: segmentOrder++,
        })
        .returning();

      await db.insert(revealPoints).values({
        universeId: cosmere.id,
        entryId: entry.id,
        segmentId: partSeg.id,
      });

      // Individual chapters within the part
      for (let ch = part.startCh; ch <= part.endCh; ch++) {
        const [chSeg] = await db
          .insert(segments)
          .values({
            entryId: entry.id,
            slug: `chapter-${ch}`,
            name: `Chapter ${ch}`,
            segmentType: "chapter",
            sortOrder: segmentOrder++,
          })
          .returning();

        await db.insert(revealPoints).values({
          universeId: cosmere.id,
          entryId: entry.id,
          segmentId: chSeg.id,
        });
      }
    }

    // Epilogue
    if (bookDef.hasEpilogue) {
      const [seg] = await db
        .insert(segments)
        .values({
          entryId: entry.id,
          slug: "epilogue",
          name: "Epilogue",
          segmentType: "chapter",
          sortOrder: segmentOrder++,
        })
        .returning();

      await db.insert(revealPoints).values({
        universeId: cosmere.id,
        entryId: entry.id,
        segmentId: seg.id,
      });
    }

    console.log(`    → ${segmentOrder} segments + reveal points`);
  }

  // ── Built-in Article Types ──
  for (const at of BUILT_IN_ARTICLE_TYPES) {
    await db.insert(articleTypes).values({
      universeId: null,
      slug: at.slug,
      name: at.name,
      icon: at.icon,
    });
  }
  console.log(`\n✓ ${BUILT_IN_ARTICLE_TYPES.length} built-in article types`);

  console.log("\n✅ Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
