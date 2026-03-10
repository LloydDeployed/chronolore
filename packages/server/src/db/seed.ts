import { db } from "./index.js";
import { eq, and, isNull } from "drizzle-orm";
import {
  universes,
  series,
  entries,
  segments,
  revealPoints,
  articleTypes,
  articles,
  contentBlocks,
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

  // ── Sample Articles ──
  // Helper to find a reveal point by entry slug + chapter slug
  async function findRevealPoint(entrySlug: string, segSlug?: string) {
    const [entry] = await db
      .select()
      .from(entries)
      .where(eq(entries.slug, entrySlug));
    if (!entry) throw new Error(`Entry not found: ${entrySlug}`);

    if (!segSlug) {
      const [rp] = await db
        .select()
        .from(revealPoints)
        .where(
          and(
            eq(revealPoints.entryId, entry.id),
            isNull(revealPoints.segmentId),
          ),
        );
      return rp;
    }

    const [seg] = await db
      .select()
      .from(segments)
      .where(and(eq(segments.entryId, entry.id), eq(segments.slug, segSlug)));
    if (!seg) throw new Error(`Segment not found: ${segSlug}`);

    const [rp] = await db
      .select()
      .from(revealPoints)
      .where(
        and(
          eq(revealPoints.entryId, entry.id),
          eq(revealPoints.segmentId, seg.id),
        ),
      );
    return rp;
  }

  // Get character article type
  const [charType] = await db
    .select()
    .from(articleTypes)
    .where(eq(articleTypes.slug, "character"));
  const [locType] = await db
    .select()
    .from(articleTypes)
    .where(eq(articleTypes.slug, "location"));
  const [conceptType] = await db
    .select()
    .from(articleTypes)
    .where(eq(articleTypes.slug, "concept"));

  // ── Kelsier ──
  const kelsierIntro = await findRevealPoint("the-final-empire", "chapter-1");
  const [kelsier] = await db
    .insert(articles)
    .values({
      universeId: cosmere.id,
      articleTypeId: charType.id,
      slug: "kelsier",
      title: "Kelsier",
      introducedAt: kelsierIntro.id,
      status: "published",
    })
    .returning();

  const rpCh1 = await findRevealPoint("the-final-empire", "chapter-1");
  const rpCh3 = await findRevealPoint("the-final-empire", "chapter-3");
  const rpCh4 = await findRevealPoint("the-final-empire", "chapter-4");
  const rpCh7 = await findRevealPoint("the-final-empire", "chapter-7");
  const rpEpilogue = await findRevealPoint("the-final-empire", "epilogue");

  // Overview section
  const [kOverview] = await db
    .insert(contentBlocks)
    .values({
      articleId: kelsier.id,
      blockType: "section",
      revealPointId: rpCh1.id,
      sortOrder: 0,
      heading: "Overview",
      status: "published",
    })
    .returning();

  await db.insert(contentBlocks).values([
    {
      articleId: kelsier.id,
      parentId: kOverview.id,
      blockType: "fact",
      revealPointId: rpCh1.id,
      sortOrder: 1,
      body: "Kelsier is a half-skaa Mistborn and the most infamous thief in the Final Empire. He is charismatic, bold, and driven by a deep hatred of the Lord Ruler and the nobility.",
      status: "published",
    },
    {
      articleId: kelsier.id,
      parentId: kOverview.id,
      blockType: "fact",
      revealPointId: rpCh3.id,
      sortOrder: 2,
      body: "Known as the Survivor of Hathsin, Kelsier is the only person known to have escaped the Pits of Hathsin alive. This feat has made him a legend among the skaa.",
      status: "published",
    },
  ]);

  // Abilities section
  const [kAbilities] = await db
    .insert(contentBlocks)
    .values({
      articleId: kelsier.id,
      blockType: "section",
      revealPointId: rpCh4.id,
      sortOrder: 10,
      heading: "Abilities",
      status: "published",
    })
    .returning();

  await db.insert(contentBlocks).values([
    {
      articleId: kelsier.id,
      parentId: kAbilities.id,
      blockType: "fact",
      revealPointId: rpCh4.id,
      sortOrder: 11,
      body: "Kelsier is a full Mistborn, capable of burning all known Allomantic metals. He Snapped while imprisoned in the Pits of Hathsin.",
      status: "published",
    },
    {
      articleId: kelsier.id,
      parentId: kAbilities.id,
      blockType: "fact",
      revealPointId: rpCh7.id,
      sortOrder: 12,
      body: "He is exceptionally skilled with iron and steel Pushing and Pulling, using coins as deadly projectiles and achieving fluid aerial movement through Steelpushing.",
      status: "published",
    },
  ]);

  // Late-book spoiler section
  await db.insert(contentBlocks).values({
    articleId: kelsier.id,
    blockType: "section",
    revealPointId: rpEpilogue.id,
    sortOrder: 20,
    heading: "Legacy",
    body: "After his death at the hands of the Lord Ruler, Kelsier becomes a martyr figure for the skaa rebellion. His sacrifice inspires the skaa uprising that ultimately topples the Final Empire. He is revered as the Survivor, and a religion forms around his memory.",
    status: "published",
  });

  console.log("  ✓ Article: Kelsier (6 content blocks)");

  // ── Vin ──
  const vinIntro = await findRevealPoint("the-final-empire", "prologue");
  const [vin] = await db
    .insert(articles)
    .values({
      universeId: cosmere.id,
      articleTypeId: charType.id,
      slug: "vin",
      title: "Vin",
      introducedAt: vinIntro.id,
      status: "published",
    })
    .returning();

  const rpPrologue = await findRevealPoint("the-final-empire", "prologue");
  const rpCh5 = await findRevealPoint("the-final-empire", "chapter-5");

  const [vOverview] = await db
    .insert(contentBlocks)
    .values({
      articleId: vin.id,
      blockType: "section",
      revealPointId: rpPrologue.id,
      sortOrder: 0,
      heading: "Overview",
      status: "published",
    })
    .returning();

  await db.insert(contentBlocks).values([
    {
      articleId: vin.id,
      parentId: vOverview.id,
      blockType: "fact",
      revealPointId: rpPrologue.id,
      sortOrder: 1,
      body: "Vin is a young skaa street urchin living in Luthadel. She is small, wary, and distrustful — shaped by a harsh life on the streets and an abusive older brother, Reen.",
      status: "published",
    },
    {
      articleId: vin.id,
      parentId: vOverview.id,
      blockType: "fact",
      revealPointId: rpCh1.id,
      sortOrder: 2,
      body: "Vin possesses a mysterious \"Luck\" that she uses unconsciously to influence people — which is actually Allomancy. She is recruited by Kelsier's crew after he recognizes her as a Mistborn.",
      status: "published",
    },
    {
      articleId: vin.id,
      parentId: vOverview.id,
      blockType: "fact",
      revealPointId: rpCh5.id,
      sortOrder: 3,
      body: "Under Kelsier's mentorship, Vin begins training in Allomancy, learning to burn tin, pewter, and eventually all the basic metals.",
      status: "published",
    },
  ]);

  console.log("  ✓ Article: Vin (4 content blocks)");

  // ── Luthadel ──
  const luthadel = await findRevealPoint("the-final-empire", "prologue");
  const [luth] = await db
    .insert(articles)
    .values({
      universeId: cosmere.id,
      articleTypeId: locType.id,
      slug: "luthadel",
      title: "Luthadel",
      introducedAt: luthadel.id,
      status: "published",
    })
    .returning();

  await db.insert(contentBlocks).values({
    articleId: luth.id,
    blockType: "section",
    revealPointId: rpPrologue.id,
    sortOrder: 0,
    heading: "Overview",
    body: "Luthadel is the capital city of the Final Empire and seat of the Lord Ruler's power. It is a sprawling city of ash-covered streets, noble keeps, and skaa slums. The city is dominated by Kredik Shaw, the Lord Ruler's palace.",
    status: "published",
  });

  console.log("  ✓ Article: Luthadel (1 content block)");

  // ── Allomancy ──
  const allocIntro = await findRevealPoint("the-final-empire", "chapter-1");
  const [allomancy] = await db
    .insert(articles)
    .values({
      universeId: cosmere.id,
      articleTypeId: conceptType.id,
      slug: "allomancy",
      title: "Allomancy",
      introducedAt: allocIntro.id,
      status: "published",
    })
    .returning();

  await db.insert(contentBlocks).values([
    {
      articleId: allomancy.id,
      blockType: "section",
      revealPointId: rpCh1.id,
      sortOrder: 0,
      heading: "Overview",
      body: "Allomancy is a magic system on Scadrial that allows practitioners to gain supernatural abilities by ingesting and \"burning\" specific metals. It is genetic in nature, concentrated among the nobility but also found among skaa due to interbreeding.",
      status: "published",
    },
    {
      articleId: allomancy.id,
      blockType: "fact",
      revealPointId: rpCh4.id,
      sortOrder: 1,
      body: "Most Allomancers can only burn one metal and are called Mistings. Rare individuals who can burn all metals are called Mistborn.",
      status: "published",
    },
  ]);

  console.log("  ✓ Article: Allomancy (2 content blocks)");

  console.log("\n✅ Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
