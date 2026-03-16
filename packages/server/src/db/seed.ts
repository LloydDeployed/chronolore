import { config } from "dotenv";
config();

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
  sections,
  passages,
  infoboxes,
  infoboxFields,
  users,
} from "./schema.js";
import bcrypt from "bcrypt";

/**
 * Seed the Cosmere universe with Mistborn Era 1 media hierarchy + v2 content.
 */

interface BookDef {
  slug: string;
  name: string;
  parts: { name: string; startCh: number; endCh: number }[];
  hasPrologue: boolean;
  hasEpilogue: boolean;
}

const MISTBORN_ERA_2: BookDef[] = [
  {
    slug: "the-alloy-of-law",
    name: "The Alloy of Law",
    hasPrologue: true,
    hasEpilogue: true,
    parts: [{ name: "Chapters", startCh: 1, endCh: 20 }],
  },
  {
    slug: "shadows-of-self",
    name: "Shadows of Self",
    hasPrologue: true,
    hasEpilogue: true,
    parts: [{ name: "Chapters", startCh: 1, endCh: 28 }],
  },
  {
    slug: "the-bands-of-mourning",
    name: "The Bands of Mourning",
    hasPrologue: true,
    hasEpilogue: true,
    parts: [{ name: "Chapters", startCh: 1, endCh: 30 }],
  },
  {
    slug: "the-lost-metal",
    name: "The Lost Metal",
    hasPrologue: true,
    hasEpilogue: true,
    parts: [
      { name: "Part 1", startCh: 1, endCh: 10 },
      { name: "Part 2", startCh: 11, endCh: 20 },
      { name: "Part 3", startCh: 21, endCh: 30 },
      { name: "Part 4", startCh: 31, endCh: 40 },
    ],
  },
];

const WARBREAKER: BookDef[] = [
  {
    slug: "warbreaker",
    name: "Warbreaker",
    hasPrologue: true,
    hasEpilogue: true,
    parts: [{ name: "Chapters", startCh: 1, endCh: 58 }],
  },
];

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
  console.log("Seeding Chronolore database (v2 schema)...\n");

  // ── Test User ──
  const passwordHash = await bcrypt.hash("chronolore", 12);
  const [testUser] = await db
    .insert(users)
    .values({
      username: "testadmin",
      email: "admin@chronolore.dev",
      passwordHash,
      role: "admin",
    })
    .returning();
  console.log(`  Created test user: testadmin / chronolore (${testUser.id})`);

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

    await db.insert(revealPoints).values({
      universeId: cosmere.id,
      entryId: entry.id,
      segmentId: null,
    });

    let segmentOrder = 0;

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

    for (const part of bookDef.parts) {
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

  // ── Helper ──
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

  // Get article types
  const [charType] = await db.select().from(articleTypes).where(eq(articleTypes.slug, "character"));
  const [locType] = await db.select().from(articleTypes).where(eq(articleTypes.slug, "location"));
  const [conceptType] = await db.select().from(articleTypes).where(eq(articleTypes.slug, "concept"));

  // ── Reveal points we'll use ──
  const rpPrologue = await findRevealPoint("the-final-empire", "prologue");
  const rpCh1 = await findRevealPoint("the-final-empire", "chapter-1");
  const rpCh3 = await findRevealPoint("the-final-empire", "chapter-3");
  const rpCh4 = await findRevealPoint("the-final-empire", "chapter-4");
  const rpCh5 = await findRevealPoint("the-final-empire", "chapter-5");
  const rpCh7 = await findRevealPoint("the-final-empire", "chapter-7");
  const rpCh38 = await findRevealPoint("the-final-empire", "chapter-38");
  const rpEpilogue = await findRevealPoint("the-final-empire", "epilogue");

  // ═══════════════════════════════════════════
  // KELSIER
  // ═══════════════════════════════════════════
  const [kelsier] = await db
    .insert(articles)
    .values({
      universeId: cosmere.id,
      articleTypeId: charType.id,
      slug: "kelsier",
      title: "Kelsier",
      introducedAt: rpCh1.id,
      status: "published",
    })
    .returning();

  // Infobox
  const [kInfobox] = await db
    .insert(infoboxes)
    .values({ articleId: kelsier.id })
    .returning();

  await db.insert(infoboxFields).values([
    { infoboxId: kInfobox.id, fieldKey: "status", fieldLabel: "Status", fieldValue: "Alive", mode: "replace", revealPointId: rpCh1.id, sortOrder: 0, status: "published" },
    { infoboxId: kInfobox.id, fieldKey: "aliases", fieldLabel: "Aliases", fieldValue: "Survivor of Hathsin", mode: "append", revealPointId: rpCh3.id, sortOrder: 1, status: "published" },
    { infoboxId: kInfobox.id, fieldKey: "species", fieldLabel: "Species", fieldValue: "Human (half-skaa)", mode: "replace", revealPointId: rpCh1.id, sortOrder: 2, status: "published" },
    { infoboxId: kInfobox.id, fieldKey: "affiliation", fieldLabel: "Affiliation", fieldValue: "Kelsier's crew", mode: "replace", revealPointId: rpCh1.id, sortOrder: 3, status: "published" },
    { infoboxId: kInfobox.id, fieldKey: "status", fieldLabel: "Status", fieldValue: "Deceased", mode: "replace", revealPointId: rpCh38.id, sortOrder: 4, status: "published" },
  ]);

  // Sections & passages
  const [kOverview] = await db.insert(sections).values({ articleId: kelsier.id, heading: "Overview", sortOrder: 0 }).returning();
  await db.insert(passages).values([
    { sectionId: kOverview.id, body: "Kelsier is a half-skaa Mistborn and the most infamous thief in the Final Empire. He is charismatic, bold, and driven by a deep hatred of the Lord Ruler and the nobility.", revealPointId: rpCh1.id, sortOrder: 0, status: "published", passageType: "prose" },
    { sectionId: kOverview.id, body: "Known as the Survivor of Hathsin, Kelsier is the only person known to have escaped the Pits of Hathsin alive. This feat has made him a legend among the skaa.", revealPointId: rpCh3.id, sortOrder: 1, status: "published", passageType: "prose" },
  ]);

  const [kAbilities] = await db.insert(sections).values({ articleId: kelsier.id, heading: "Abilities", sortOrder: 1 }).returning();
  await db.insert(passages).values([
    { sectionId: kAbilities.id, body: "Kelsier is a full Mistborn, capable of burning all known Allomantic metals. He Snapped while imprisoned in the Pits of Hathsin.", revealPointId: rpCh4.id, sortOrder: 0, status: "published", passageType: "prose" },
    { sectionId: kAbilities.id, body: "He is exceptionally skilled with iron and steel Pushing and Pulling, using coins as deadly projectiles and achieving fluid aerial movement through Steelpushing.", revealPointId: rpCh7.id, sortOrder: 1, status: "published", passageType: "prose" },
  ]);

  const [kLegacy] = await db.insert(sections).values({ articleId: kelsier.id, heading: "Legacy", sortOrder: 2 }).returning();
  await db.insert(passages).values([
    { sectionId: kLegacy.id, body: "After his death at the hands of the Lord Ruler, Kelsier becomes a martyr figure for the skaa rebellion. His sacrifice inspires the skaa uprising that ultimately topples the Final Empire. He is revered as the Survivor, and a religion forms around his memory.", revealPointId: rpEpilogue.id, sortOrder: 0, status: "published", passageType: "prose" },
  ]);

  console.log("  ✓ Article: Kelsier (3 sections, 5 passages, 5 infobox fields)");

  // ═══════════════════════════════════════════
  // VIN
  // ═══════════════════════════════════════════
  const [vin] = await db
    .insert(articles)
    .values({
      universeId: cosmere.id,
      articleTypeId: charType.id,
      slug: "vin",
      title: "Vin",
      introducedAt: rpPrologue.id,
      status: "published",
    })
    .returning();

  const [vInfobox] = await db.insert(infoboxes).values({ articleId: vin.id }).returning();
  await db.insert(infoboxFields).values([
    { infoboxId: vInfobox.id, fieldKey: "status", fieldLabel: "Status", fieldValue: "Alive", mode: "replace", revealPointId: rpPrologue.id, sortOrder: 0, status: "published" },
    { infoboxId: vInfobox.id, fieldKey: "aliases", fieldLabel: "Aliases", fieldValue: "Valette Renoux", mode: "append", revealPointId: rpCh7.id, sortOrder: 1, status: "published" },
    { infoboxId: vInfobox.id, fieldKey: "species", fieldLabel: "Species", fieldValue: "Human (skaa)", mode: "replace", revealPointId: rpPrologue.id, sortOrder: 2, status: "published" },
  ]);

  const [vOverview] = await db.insert(sections).values({ articleId: vin.id, heading: "Overview", sortOrder: 0 }).returning();
  await db.insert(passages).values([
    { sectionId: vOverview.id, body: "Vin is a young skaa street urchin living in Luthadel. She is small, wary, and distrustful — shaped by a harsh life on the streets and an abusive older brother, Reen.", revealPointId: rpPrologue.id, sortOrder: 0, status: "published", passageType: "prose" },
    { sectionId: vOverview.id, body: "Vin possesses a mysterious \"Luck\" that she uses unconsciously to influence people — which is actually Allomancy. She is recruited by Kelsier's crew after he recognizes her as a Mistborn.", revealPointId: rpCh1.id, sortOrder: 1, status: "published", passageType: "prose" },
    { sectionId: vOverview.id, body: "Under Kelsier's mentorship, Vin begins training in Allomancy, learning to burn tin, pewter, and eventually all the basic metals.", revealPointId: rpCh5.id, sortOrder: 2, status: "published", passageType: "prose" },
  ]);

  console.log("  ✓ Article: Vin (1 section, 3 passages, 3 infobox fields)");

  // ═══════════════════════════════════════════
  // LUTHADEL
  // ═══════════════════════════════════════════
  const [luth] = await db
    .insert(articles)
    .values({
      universeId: cosmere.id,
      articleTypeId: locType.id,
      slug: "luthadel",
      title: "Luthadel",
      introducedAt: rpPrologue.id,
      status: "published",
    })
    .returning();

  const [lOverview] = await db.insert(sections).values({ articleId: luth.id, heading: "Overview", sortOrder: 0 }).returning();
  await db.insert(passages).values([
    { sectionId: lOverview.id, body: "Luthadel is the capital city of the Final Empire and seat of the Lord Ruler's power. It is a sprawling city of ash-covered streets, noble keeps, and skaa slums. The city is dominated by Kredik Shaw, the Lord Ruler's palace.", revealPointId: rpPrologue.id, sortOrder: 0, status: "published", passageType: "prose" },
  ]);

  console.log("  ✓ Article: Luthadel (1 section, 1 passage)");

  // ═══════════════════════════════════════════
  // ALLOMANCY
  // ═══════════════════════════════════════════
  const [allomancy] = await db
    .insert(articles)
    .values({
      universeId: cosmere.id,
      articleTypeId: conceptType.id,
      slug: "allomancy",
      title: "Allomancy",
      introducedAt: rpCh1.id,
      status: "published",
    })
    .returning();

  const [aOverview] = await db.insert(sections).values({ articleId: allomancy.id, heading: "Overview", sortOrder: 0 }).returning();
  await db.insert(passages).values([
    { sectionId: aOverview.id, body: "Allomancy is a magic system on Scadrial that allows practitioners to gain supernatural abilities by ingesting and \"burning\" specific metals. It is genetic in nature, concentrated among the nobility but also found among skaa due to interbreeding.", revealPointId: rpCh1.id, sortOrder: 0, status: "published", passageType: "prose" },
    { sectionId: aOverview.id, body: "Most Allomancers can only burn one metal and are called Mistings. Rare individuals who can burn all metals are called Mistborn.", revealPointId: rpCh4.id, sortOrder: 1, status: "published", passageType: "prose" },
  ]);

  console.log("  ✓ Article: Allomancy (1 section, 2 passages)");

  // ═══════════════════════════════════════════════════
  // MISTBORN ERA 2
  // ═══════════════════════════════════════════════════
  const [mistbornEra2] = await db
    .insert(series)
    .values({
      universeId: cosmere.id,
      slug: "mistborn-era-2",
      name: "Mistborn Era 2",
      sortOrder: 1,
    })
    .returning();
  console.log(`\n✓ Series: ${mistbornEra2.name}`);

  // Helper to seed books for any series
  async function seedBooks(seriesRow: typeof mistbornEra1, bookDefs: BookDef[]) {
    for (let bookIdx = 0; bookIdx < bookDefs.length; bookIdx++) {
      const bookDef = bookDefs[bookIdx];
      const [entry] = await db
        .insert(entries)
        .values({
          universeId: cosmere.id,
          seriesId: seriesRow.id,
          slug: bookDef.slug,
          name: bookDef.name,
          entryType: "book",
          sortOrder: bookIdx,
        })
        .returning();
      console.log(`  ✓ Entry: ${entry.name}`);

      await db.insert(revealPoints).values({
        universeId: cosmere.id,
        entryId: entry.id,
        segmentId: null,
      });

      let segmentOrder = 0;

      if (bookDef.hasPrologue) {
        const [seg] = await db
          .insert(segments)
          .values({ entryId: entry.id, slug: "prologue", name: "Prologue", segmentType: "chapter", sortOrder: segmentOrder++ })
          .returning();
        await db.insert(revealPoints).values({ universeId: cosmere.id, entryId: entry.id, segmentId: seg.id });
      }

      for (const part of bookDef.parts) {
        // Only create a part segment if it's a real named part (not a "Chapters" wrapper)
        if (part.name !== "Chapters") {
          const [partSeg] = await db
            .insert(segments)
            .values({ entryId: entry.id, slug: part.name.toLowerCase().replace(/\s+/g, "-"), name: part.name, segmentType: "part", sortOrder: segmentOrder++ })
            .returning();
          await db.insert(revealPoints).values({ universeId: cosmere.id, entryId: entry.id, segmentId: partSeg.id });
        }

        for (let ch = part.startCh; ch <= part.endCh; ch++) {
          const [chSeg] = await db
            .insert(segments)
            .values({ entryId: entry.id, slug: `chapter-${ch}`, name: `Chapter ${ch}`, segmentType: "chapter", sortOrder: segmentOrder++ })
            .returning();
          await db.insert(revealPoints).values({ universeId: cosmere.id, entryId: entry.id, segmentId: chSeg.id });
        }
      }

      if (bookDef.hasEpilogue) {
        const [seg] = await db
          .insert(segments)
          .values({ entryId: entry.id, slug: "epilogue", name: "Epilogue", segmentType: "chapter", sortOrder: segmentOrder++ })
          .returning();
        await db.insert(revealPoints).values({ universeId: cosmere.id, entryId: entry.id, segmentId: seg.id });
      }

      console.log(`    → ${segmentOrder} segments + reveal points`);
    }
  }

  await seedBooks(mistbornEra2, MISTBORN_ERA_2);

  // ═══════════════════════════════════════════════════
  // WARBREAKER SERIES
  // ═══════════════════════════════════════════════════
  const [warbreakerSeries] = await db
    .insert(series)
    .values({
      universeId: cosmere.id,
      slug: "warbreaker",
      name: "Warbreaker",
      sortOrder: 2,
    })
    .returning();
  console.log(`\n✓ Series: ${warbreakerSeries.name}`);

  await seedBooks(warbreakerSeries, WARBREAKER);

  // ═══════════════════════════════════════════════════
  // MISTBORN ERA 2 CHARACTERS
  // ═══════════════════════════════════════════════════
  const rpAoL1 = await findRevealPoint("the-alloy-of-law", "chapter-1");
  const rpAoL2 = await findRevealPoint("the-alloy-of-law", "chapter-2");
  const rpAoL4 = await findRevealPoint("the-alloy-of-law", "chapter-4");
  const rpAoL5 = await findRevealPoint("the-alloy-of-law", "chapter-5");
  const rpAoLPrologue = await findRevealPoint("the-alloy-of-law", "prologue");
  const rpSoS1 = await findRevealPoint("shadows-of-self", "chapter-1");
  const rpSoS5 = await findRevealPoint("shadows-of-self", "chapter-5");
  const rpSoS15 = await findRevealPoint("shadows-of-self", "chapter-15");
  const rpBoM1 = await findRevealPoint("the-bands-of-mourning", "chapter-1");
  const rpBoM10 = await findRevealPoint("the-bands-of-mourning", "chapter-10");
  const rpBoM28 = await findRevealPoint("the-bands-of-mourning", "chapter-28");
  const rpTLM5 = await findRevealPoint("the-lost-metal", "chapter-5");

  // ── Waxillium Ladrian ──
  const [wax] = await db.insert(articles).values({
    universeId: cosmere.id, articleTypeId: charType.id, slug: "waxillium-ladrian",
    title: "Waxillium Ladrian", introducedAt: rpAoLPrologue.id, status: "published",
  }).returning();

  const [waxInfobox] = await db.insert(infoboxes).values({ articleId: wax.id }).returning();
  await db.insert(infoboxFields).values([
    { infoboxId: waxInfobox.id, fieldKey: "status", fieldLabel: "Status", fieldValue: "Alive", mode: "replace", revealPointId: rpAoLPrologue.id, sortOrder: 0, status: "published" },
    { infoboxId: waxInfobox.id, fieldKey: "aliases", fieldLabel: "Aliases", fieldValue: "Wax", mode: "append", revealPointId: rpAoLPrologue.id, sortOrder: 1, status: "published" },
    { infoboxId: waxInfobox.id, fieldKey: "species", fieldLabel: "Species", fieldValue: "Human", mode: "replace", revealPointId: rpAoLPrologue.id, sortOrder: 2, status: "published" },
    { infoboxId: waxInfobox.id, fieldKey: "abilities", fieldLabel: "Abilities", fieldValue: "Twinborn — Coinshot (steel Allomancy) + Skimmer (iron Feruchemy)", mode: "replace", revealPointId: rpAoL1.id, sortOrder: 3, status: "published" },
    { infoboxId: waxInfobox.id, fieldKey: "affiliation", fieldLabel: "Affiliation", fieldValue: "House Ladrian", mode: "replace", revealPointId: rpAoL1.id, sortOrder: 4, status: "published" },
  ]);

  const [waxOverview] = await db.insert(sections).values({ articleId: wax.id, heading: "Overview", sortOrder: 0 }).returning();
  await db.insert(passages).values([
    { sectionId: waxOverview.id, body: "Waxillium \"Wax\" Ladrian is a Twinborn who spent twenty years as a lawman in the Roughs before returning to Elendel to assume leadership of the declining House Ladrian.", revealPointId: rpAoLPrologue.id, sortOrder: 0, status: "published", passageType: "prose" },
    { sectionId: waxOverview.id, body: "As a Coinshot, Wax can Push on metals with Allomancy, and as a Skimmer he can store and tap weight using iron Feruchemy. The combination allows him remarkable aerial mobility — he can make himself nearly weightless then Push off metals to fly.", revealPointId: rpAoL1.id, sortOrder: 1, status: "published", passageType: "prose" },
  ]);

  const [waxEra2Life] = await db.insert(sections).values({ articleId: wax.id, heading: "Return to Elendel", sortOrder: 1 }).returning();
  await db.insert(passages).values([
    { sectionId: waxEra2Life.id, body: "After the death of his uncle, Wax reluctantly returns to Elendel to manage House Ladrian's finances and social obligations. He finds the transition from frontier lawman to nobleman deeply uncomfortable.", revealPointId: rpAoL1.id, sortOrder: 0, status: "published", passageType: "prose" },
    { sectionId: waxEra2Life.id, body: "Wax becomes embroiled in the investigation of the Vanishers, a gang using Allomantic abilities to rob cargo shipments and kidnap women. This pulls him back into the world of law enforcement.", revealPointId: rpAoL4.id, sortOrder: 1, status: "published", passageType: "prose" },
  ]);

  console.log("  ✓ Article: Waxillium Ladrian (2 sections, 4 passages, 5 infobox fields)");

  // ── Wayne ──
  const [wayne] = await db.insert(articles).values({
    universeId: cosmere.id, articleTypeId: charType.id, slug: "wayne",
    title: "Wayne", introducedAt: rpAoL2.id, status: "published",
  }).returning();

  const [wayneInfobox] = await db.insert(infoboxes).values({ articleId: wayne.id }).returning();
  await db.insert(infoboxFields).values([
    { infoboxId: wayneInfobox.id, fieldKey: "status", fieldLabel: "Status", fieldValue: "Alive", mode: "replace", revealPointId: rpAoL2.id, sortOrder: 0, status: "published" },
    { infoboxId: wayneInfobox.id, fieldKey: "species", fieldLabel: "Species", fieldValue: "Human", mode: "replace", revealPointId: rpAoL2.id, sortOrder: 1, status: "published" },
    { infoboxId: wayneInfobox.id, fieldKey: "abilities", fieldLabel: "Abilities", fieldValue: "Twinborn — Slider (bendalloy Allomancy) + Bloodmaker (gold Feruchemy)", mode: "replace", revealPointId: rpAoL2.id, sortOrder: 2, status: "published" },
  ]);

  const [wayneOverview] = await db.insert(sections).values({ articleId: wayne.id, heading: "Overview", sortOrder: 0 }).returning();
  await db.insert(passages).values([
    { sectionId: wayneOverview.id, body: "Wayne is Wax's closest friend and partner, a Twinborn with the ability to create speed bubbles (bendalloy Allomancy) and heal from injuries by tapping gold Feruchemy. He is known for his talent with disguises, accents, and his peculiar habit of \"trading\" for items he wants rather than stealing them.", revealPointId: rpAoL2.id, sortOrder: 0, status: "published", passageType: "prose" },
    { sectionId: wayneOverview.id, body: "Despite his humorous exterior, Wayne carries deep guilt over having accidentally killed a man in his youth. He regularly leaves money for the man's family as an act of penance.", revealPointId: rpAoL5.id, sortOrder: 1, status: "published", passageType: "prose" },
  ]);

  console.log("  ✓ Article: Wayne (1 section, 2 passages, 3 infobox fields)");

  // ── Marasi Colms ──
  const [marasi] = await db.insert(articles).values({
    universeId: cosmere.id, articleTypeId: charType.id, slug: "marasi-colms",
    title: "Marasi Colms", introducedAt: rpAoL4.id, status: "published",
  }).returning();

  const [marasiInfobox] = await db.insert(infoboxes).values({ articleId: marasi.id }).returning();
  await db.insert(infoboxFields).values([
    { infoboxId: marasiInfobox.id, fieldKey: "status", fieldLabel: "Status", fieldValue: "Alive", mode: "replace", revealPointId: rpAoL4.id, sortOrder: 0, status: "published" },
    { infoboxId: marasiInfobox.id, fieldKey: "abilities", fieldLabel: "Abilities", fieldValue: "Pulser (cadmium Allomancy — slows time in a bubble)", mode: "replace", revealPointId: rpAoL4.id, sortOrder: 1, status: "published" },
    { infoboxId: marasiInfobox.id, fieldKey: "affiliation", fieldLabel: "Affiliation", fieldValue: "Elendel constabulary", mode: "replace", revealPointId: rpSoS1.id, sortOrder: 2, status: "published" },
  ]);

  const [marasiOverview] = await db.insert(sections).values({ articleId: marasi.id, heading: "Overview", sortOrder: 0 }).returning();
  await db.insert(passages).values([
    { sectionId: marasiOverview.id, body: "Marasi Colms is the illegitimate daughter of Lord Harms and a university student specializing in criminal law and the heroics of the Roughs lawmen. She is a cadmium Misting, able to create time-slowing bubbles.", revealPointId: rpAoL4.id, sortOrder: 0, status: "published", passageType: "prose" },
    { sectionId: marasiOverview.id, body: "By the time of Shadows of Self, Marasi has joined the Elendel constabulary as a deputy and works alongside Wax on official investigations.", revealPointId: rpSoS1.id, sortOrder: 1, status: "published", passageType: "prose" },
  ]);

  console.log("  ✓ Article: Marasi Colms (1 section, 2 passages, 3 infobox fields)");

  // ── Steris Harms ──
  const [steris] = await db.insert(articles).values({
    universeId: cosmere.id, articleTypeId: charType.id, slug: "steris-harms",
    title: "Steris Harms", introducedAt: rpAoL4.id, status: "published",
  }).returning();

  const [sterisInfobox] = await db.insert(infoboxes).values({ articleId: steris.id }).returning();
  await db.insert(infoboxFields).values([
    { infoboxId: sterisInfobox.id, fieldKey: "status", fieldLabel: "Status", fieldValue: "Alive", mode: "replace", revealPointId: rpAoL4.id, sortOrder: 0, status: "published" },
    { infoboxId: sterisInfobox.id, fieldKey: "species", fieldLabel: "Species", fieldValue: "Human (not an Allomancer)", mode: "replace", revealPointId: rpAoL4.id, sortOrder: 1, status: "published" },
    { infoboxId: sterisInfobox.id, fieldKey: "affiliation", fieldLabel: "Affiliation", fieldValue: "House Harms → House Ladrian", mode: "replace", revealPointId: rpSoS5.id, sortOrder: 2, status: "published" },
  ]);

  const [sterisOverview] = await db.insert(sections).values({ articleId: steris.id, heading: "Overview", sortOrder: 0 }).returning();
  await db.insert(passages).values([
    { sectionId: sterisOverview.id, body: "Steris Harms is the eldest legitimate daughter of Lord Harms and half-sister to Marasi. She initially enters an arranged engagement with Wax to rescue House Ladrian's finances. She is meticulous, socially awkward, and prepares exhaustive lists and contingency plans for every situation.", revealPointId: rpAoL4.id, sortOrder: 0, status: "published", passageType: "prose" },
    { sectionId: sterisOverview.id, body: "Over the course of the series, Steris reveals hidden depths — her careful planning becomes an invaluable asset, and her relationship with Wax grows from contractual obligation into genuine love.", revealPointId: rpSoS5.id, sortOrder: 1, status: "published", passageType: "prose" },
  ]);

  console.log("  ✓ Article: Steris Harms (1 section, 2 passages, 3 infobox fields)");

  // ── MeLaan ──
  const [melaan] = await db.insert(articles).values({
    universeId: cosmere.id, articleTypeId: charType.id, slug: "melaan",
    title: "MeLaan", introducedAt: rpSoS15.id, status: "published",
  }).returning();

  const [melaanInfobox] = await db.insert(infoboxes).values({ articleId: melaan.id }).returning();
  await db.insert(infoboxFields).values([
    { infoboxId: melaanInfobox.id, fieldKey: "status", fieldLabel: "Status", fieldValue: "Alive", mode: "replace", revealPointId: rpSoS15.id, sortOrder: 0, status: "published" },
    { infoboxId: melaanInfobox.id, fieldKey: "species", fieldLabel: "Species", fieldValue: "Kandra (Third Generation)", mode: "replace", revealPointId: rpSoS15.id, sortOrder: 1, status: "published" },
    { infoboxId: melaanInfobox.id, fieldKey: "abilities", fieldLabel: "Abilities", fieldValue: "Shapeshifting via True Body and consumed bones", mode: "replace", revealPointId: rpSoS15.id, sortOrder: 2, status: "published" },
  ]);

  const [melaanOverview] = await db.insert(sections).values({ articleId: melaan.id, heading: "Overview", sortOrder: 0 }).returning();
  await db.insert(passages).values([
    { sectionId: melaanOverview.id, body: "MeLaan is a kandra of the Third Generation who serves as an agent for the kandra homeland. She is irreverent, enjoys taking on provocative human forms, and has a wry sense of humor. She assists Wax during the crisis in Shadows of Self.", revealPointId: rpSoS15.id, sortOrder: 0, status: "published", passageType: "prose" },
    { sectionId: melaanOverview.id, body: "In The Bands of Mourning, MeLaan becomes a more regular member of the team and develops a relationship with Wayne. She provides crucial intelligence about kandra history and the mythical Bands of Mourning.", revealPointId: rpBoM10.id, sortOrder: 1, status: "published", passageType: "prose" },
  ]);

  console.log("  ✓ Article: MeLaan (1 section, 2 passages, 3 infobox fields)");

  // ═══════════════════════════════════════════════════
  // WARBREAKER CHARACTERS
  // ═══════════════════════════════════════════════════
  const rpWB1 = await findRevealPoint("warbreaker", "chapter-1");
  const rpWB2 = await findRevealPoint("warbreaker", "chapter-2");
  const rpWB3 = await findRevealPoint("warbreaker", "chapter-3");
  const rpWB5 = await findRevealPoint("warbreaker", "chapter-5");
  const rpWB12 = await findRevealPoint("warbreaker", "chapter-12");
  const rpWB32 = await findRevealPoint("warbreaker", "chapter-32");
  const rpWB57 = await findRevealPoint("warbreaker", "chapter-57");
  const rpWBPrologue = await findRevealPoint("warbreaker", "prologue");
  const rpWBEpilogue = await findRevealPoint("warbreaker", "epilogue");

  // ── Vasher ──
  const [vasher] = await db.insert(articles).values({
    universeId: cosmere.id, articleTypeId: charType.id, slug: "vasher",
    title: "Vasher", introducedAt: rpWBPrologue.id, status: "published",
  }).returning();

  const [vasherInfobox] = await db.insert(infoboxes).values({ articleId: vasher.id }).returning();
  await db.insert(infoboxFields).values([
    { infoboxId: vasherInfobox.id, fieldKey: "status", fieldLabel: "Status", fieldValue: "Alive", mode: "replace", revealPointId: rpWBPrologue.id, sortOrder: 0, status: "published" },
    { infoboxId: vasherInfobox.id, fieldKey: "aliases", fieldLabel: "Aliases", fieldValue: "Talaxin", mode: "append", revealPointId: rpWB32.id, sortOrder: 1, status: "published" },
    { infoboxId: vasherInfobox.id, fieldKey: "aliases", fieldLabel: "Aliases", fieldValue: "Warbreaker the Peaceful", mode: "append", revealPointId: rpWB57.id, sortOrder: 2, status: "published" },
    { infoboxId: vasherInfobox.id, fieldKey: "species", fieldLabel: "Species", fieldValue: "Returned", mode: "replace", revealPointId: rpWB57.id, sortOrder: 3, status: "published" },
  ]);

  const [vasherOverview] = await db.insert(sections).values({ articleId: vasher.id, heading: "Overview", sortOrder: 0 }).returning();
  await db.insert(passages).values([
    { sectionId: vasherOverview.id, body: "Vasher is a mysterious and dangerous man who appears in the dungeons of Hallandren at the start of the novel. He possesses considerable skill with BioChromatic Breath and carries Nightblood, a sentient sword capable of destroying anything it touches.", revealPointId: rpWBPrologue.id, sortOrder: 0, status: "published", passageType: "prose" },
    { sectionId: vasherOverview.id, body: "Vasher is ultimately revealed to be one of the Five Scholars who discovered how to create sentient objects using Breath. His true name is Warbreaker the Peaceful — one of the original Returned from centuries past, who helped end the Manywar.", revealPointId: rpWB57.id, sortOrder: 1, status: "published", passageType: "prose" },
  ]);

  console.log("  ✓ Article: Vasher (1 section, 2 passages, 4 infobox fields)");

  // ── Vivenna ──
  const [vivenna] = await db.insert(articles).values({
    universeId: cosmere.id, articleTypeId: charType.id, slug: "vivenna",
    title: "Vivenna", introducedAt: rpWB1.id, status: "published",
  }).returning();

  const [vivennaInfobox] = await db.insert(infoboxes).values({ articleId: vivenna.id }).returning();
  await db.insert(infoboxFields).values([
    { infoboxId: vivennaInfobox.id, fieldKey: "status", fieldLabel: "Status", fieldValue: "Alive", mode: "replace", revealPointId: rpWB1.id, sortOrder: 0, status: "published" },
    { infoboxId: vivennaInfobox.id, fieldKey: "species", fieldLabel: "Species", fieldValue: "Human (Royal Idrian)", mode: "replace", revealPointId: rpWB1.id, sortOrder: 1, status: "published" },
    { infoboxId: vivennaInfobox.id, fieldKey: "affiliation", fieldLabel: "Affiliation", fieldValue: "Idris royal family", mode: "replace", revealPointId: rpWB1.id, sortOrder: 2, status: "published" },
  ]);

  const [vivennaOverview] = await db.insert(sections).values({ articleId: vivenna.id, heading: "Overview", sortOrder: 0 }).returning();
  await db.insert(passages).values([
    { sectionId: vivennaOverview.id, body: "Vivenna is the eldest princess of Idris, trained her entire life to marry the God King of Hallandren as part of a political treaty. When her younger sister Siri is sent in her place, Vivenna travels to Hallandren to rescue her.", revealPointId: rpWB1.id, sortOrder: 0, status: "published", passageType: "prose" },
    { sectionId: vivennaOverview.id, body: "In Hallandren, Vivenna's rigid Idrian worldview is challenged as she encounters the Breath-based culture firsthand. She is betrayed by Denth's mercenary crew and must learn to survive on her own, eventually mastering the use of BioChromatic Breath.", revealPointId: rpWB32.id, sortOrder: 1, status: "published", passageType: "prose" },
  ]);

  console.log("  ✓ Article: Vivenna (1 section, 2 passages, 3 infobox fields)");

  // ── Siri ──
  const [siri] = await db.insert(articles).values({
    universeId: cosmere.id, articleTypeId: charType.id, slug: "siri",
    title: "Siri", introducedAt: rpWB2.id, status: "published",
  }).returning();

  const [siriInfobox] = await db.insert(infoboxes).values({ articleId: siri.id }).returning();
  await db.insert(infoboxFields).values([
    { infoboxId: siriInfobox.id, fieldKey: "status", fieldLabel: "Status", fieldValue: "Alive", mode: "replace", revealPointId: rpWB2.id, sortOrder: 0, status: "published" },
    { infoboxId: siriInfobox.id, fieldKey: "species", fieldLabel: "Species", fieldValue: "Human (Royal Idrian)", mode: "replace", revealPointId: rpWB2.id, sortOrder: 1, status: "published" },
    { infoboxId: siriInfobox.id, fieldKey: "affiliation", fieldLabel: "Affiliation", fieldValue: "God King's wife", mode: "replace", revealPointId: rpWB5.id, sortOrder: 2, status: "published" },
  ]);

  const [siriOverview] = await db.insert(sections).values({ articleId: siri.id, heading: "Overview", sortOrder: 0 }).returning();
  await db.insert(passages).values([
    { sectionId: siriOverview.id, body: "Siri is the youngest princess of Idris, known for her rebellious and free-spirited nature. She is unexpectedly sent to marry the God King Susebron in place of her older sister Vivenna, a decision that shocks the entire royal family.", revealPointId: rpWB2.id, sortOrder: 0, status: "published", passageType: "prose" },
    { sectionId: siriOverview.id, body: "In the Court of Gods, Siri discovers that the God King is not the tyrant she expected but a sheltered, gentle man whose tongue was cut out as a child to prevent him from using his immense BioChromatic Breath. She works to protect him from the scheming priests.", revealPointId: rpWB12.id, sortOrder: 1, status: "published", passageType: "prose" },
  ]);

  console.log("  ✓ Article: Siri (1 section, 2 passages, 3 infobox fields)");

  // ── Lightsong ──
  const [lightsong] = await db.insert(articles).values({
    universeId: cosmere.id, articleTypeId: charType.id, slug: "lightsong",
    title: "Lightsong", introducedAt: rpWB3.id, status: "published",
  }).returning();

  const [lightsongInfobox] = await db.insert(infoboxes).values({ articleId: lightsong.id }).returning();
  await db.insert(infoboxFields).values([
    { infoboxId: lightsongInfobox.id, fieldKey: "status", fieldLabel: "Status", fieldValue: "Alive (Returned)", mode: "replace", revealPointId: rpWB3.id, sortOrder: 0, status: "published" },
    { infoboxId: lightsongInfobox.id, fieldKey: "aliases", fieldLabel: "Aliases", fieldValue: "Lightsong the Bold", mode: "append", revealPointId: rpWB3.id, sortOrder: 1, status: "published" },
    { infoboxId: lightsongInfobox.id, fieldKey: "species", fieldLabel: "Species", fieldValue: "Returned god", mode: "replace", revealPointId: rpWB3.id, sortOrder: 2, status: "published" },
    { infoboxId: lightsongInfobox.id, fieldKey: "status", fieldLabel: "Status", fieldValue: "Deceased (gave Breath to save Susebron)", mode: "replace", revealPointId: rpWB57.id, sortOrder: 3, status: "published" },
  ]);

  const [lightsongOverview] = await db.insert(sections).values({ articleId: lightsong.id, heading: "Overview", sortOrder: 0 }).returning();
  await db.insert(passages).values([
    { sectionId: lightsongOverview.id, body: "Lightsong the Bold is one of the Returned gods of Hallandren, residing in the Court of Gods. Unlike most Returned, Lightsong is deeply skeptical of his own divinity and spends his days engaging in witty banter, avoiding responsibility, and playing games of chance.", revealPointId: rpWB3.id, sortOrder: 0, status: "published", passageType: "prose" },
    { sectionId: lightsongOverview.id, body: "Despite his irreverent exterior, Lightsong investigates a series of mysteries within the Court and proves to be far more perceptive than he lets on. In the climax, he sacrifices his divine Breath to heal the God King, ending his existence.", revealPointId: rpWB57.id, sortOrder: 1, status: "published", passageType: "prose" },
  ]);

  console.log("  ✓ Article: Lightsong (1 section, 2 passages, 4 infobox fields)");

  // ── Nightblood ──
  const [itemType] = await db.select().from(articleTypes).where(eq(articleTypes.slug, "item"));

  const [nightblood] = await db.insert(articles).values({
    universeId: cosmere.id, articleTypeId: itemType.id, slug: "nightblood",
    title: "Nightblood", introducedAt: rpWBPrologue.id, status: "published",
  }).returning();

  const [nightbloodInfobox] = await db.insert(infoboxes).values({ articleId: nightblood.id }).returning();
  await db.insert(infoboxFields).values([
    { infoboxId: nightbloodInfobox.id, fieldKey: "type", fieldLabel: "Type", fieldValue: "Sentient Awakened sword", mode: "replace", revealPointId: rpWBPrologue.id, sortOrder: 0, status: "published" },
    { infoboxId: nightbloodInfobox.id, fieldKey: "command", fieldLabel: "Command", fieldValue: "\"Destroy evil\"", mode: "replace", revealPointId: rpWBPrologue.id, sortOrder: 1, status: "published" },
    { infoboxId: nightbloodInfobox.id, fieldKey: "creator", fieldLabel: "Creator", fieldValue: "Shashara (one of the Five Scholars)", mode: "replace", revealPointId: rpWB57.id, sortOrder: 2, status: "published" },
  ]);

  const [nightbloodOverview] = await db.insert(sections).values({ articleId: nightblood.id, heading: "Overview", sortOrder: 0 }).returning();
  await db.insert(passages).values([
    { sectionId: nightbloodOverview.id, body: "Nightblood is a sentient sword Awakened with a thousand Breaths and the Command to \"destroy evil.\" The sword cannot truly comprehend evil and tends to influence those around it to draw and use it, consuming their Investiture. It communicates telepathically with its wielder.", revealPointId: rpWBPrologue.id, sortOrder: 0, status: "published", passageType: "prose" },
    { sectionId: nightbloodOverview.id, body: "Nightblood was created by Shashara, one of the Five Scholars, as an experiment in Awakening metal. When drawn, the blade appears as a void of blackness that destroys anything it touches, consuming BioChromatic Breath from its wielder in the process.", revealPointId: rpWB57.id, sortOrder: 1, status: "published", passageType: "prose" },
  ]);

  console.log("  ✓ Article: Nightblood (1 section, 2 passages, 3 infobox fields)");

  // ═══════════════════════════════════════════════════
  // HOID — Cross-series character
  // ═══════════════════════════════════════════════════
  const rpTFECh19 = await findRevealPoint("the-final-empire", "chapter-19");
  const rpBoMEpilogue = await findRevealPoint("the-bands-of-mourning", "epilogue");

  const [hoid] = await db.insert(articles).values({
    universeId: cosmere.id, articleTypeId: charType.id, slug: "hoid",
    title: "Hoid", introducedAt: rpTFECh19.id, status: "published",
  }).returning();

  const [hoidInfobox] = await db.insert(infoboxes).values({ articleId: hoid.id }).returning();
  await db.insert(infoboxFields).values([
    { infoboxId: hoidInfobox.id, fieldKey: "status", fieldLabel: "Status", fieldValue: "Alive", mode: "replace", revealPointId: rpTFECh19.id, sortOrder: 0, status: "published" },
    { infoboxId: hoidInfobox.id, fieldKey: "aliases", fieldLabel: "Aliases", fieldValue: "Hoid", mode: "append", revealPointId: rpTFECh19.id, sortOrder: 1, status: "published" },
    { infoboxId: hoidInfobox.id, fieldKey: "species", fieldLabel: "Species", fieldValue: "Unknown", mode: "replace", revealPointId: rpTFECh19.id, sortOrder: 2, status: "published" },
    { infoboxId: hoidInfobox.id, fieldKey: "aliases", fieldLabel: "Aliases", fieldValue: "Dust", mode: "append", revealPointId: rpWBEpilogue.id, sortOrder: 3, status: "published" },
    { infoboxId: hoidInfobox.id, fieldKey: "species", fieldLabel: "Species", fieldValue: "Worldhopper", mode: "replace", revealPointId: rpWBEpilogue.id, sortOrder: 4, status: "published" },
    { infoboxId: hoidInfobox.id, fieldKey: "aliases", fieldLabel: "Aliases", fieldValue: "Topaz", mode: "append", revealPointId: rpBoMEpilogue.id, sortOrder: 5, status: "published" },
  ]);

  // Section: In Mistborn Era 1
  const [hoidEra1] = await db.insert(sections).values({ articleId: hoid.id, heading: "In Mistborn Era 1", sortOrder: 0 }).returning();
  await db.insert(passages).values([
    { sectionId: hoidEra1.id, body: "Hoid appears briefly in The Final Empire as an informant whom Kelsier contacts for information. He is described as a scruffy, unassuming man who seems to know far more than he lets on. Kelsier finds him at a crossroads outside Luthadel.", revealPointId: rpTFECh19.id, sortOrder: 0, status: "published", passageType: "prose" },
    { sectionId: hoidEra1.id, body: "His role in Era 1 is minor but notable — he provides Kelsier with intelligence about the Lord Ruler's movements. Readers familiar with other Cosmere works may recognize this as part of Hoid's pattern of inserting himself into pivotal events across worlds.", revealPointId: rpTFECh19.id, sortOrder: 1, status: "published", passageType: "prose" },
  ]);

  // Section: In Warbreaker
  const [hoidWB] = await db.insert(sections).values({ articleId: hoid.id, heading: "In Warbreaker", sortOrder: 1 }).returning();
  await db.insert(passages).values([
    { sectionId: hoidWB.id, body: "In Warbreaker, a character matching Hoid's description appears in the story's epilogue. He is seen telling stories and acquiring Breaths, fitting his established pattern of collecting different forms of Investiture from the worlds he visits.", revealPointId: rpWBEpilogue.id, sortOrder: 0, status: "published", passageType: "prose" },
    { sectionId: hoidWB.id, body: "His appearance in Warbreaker provides evidence that he is a worldhopper — an individual capable of traveling between the different planets of the Cosmere. He uses the alias \"Dust\" in this context.", revealPointId: rpWBEpilogue.id, sortOrder: 1, status: "published", passageType: "prose" },
  ]);

  // Section: In Mistborn Era 2
  const [hoidEra2] = await db.insert(sections).values({ articleId: hoid.id, heading: "In Mistborn Era 2", sortOrder: 2 }).returning();
  await db.insert(passages).values([
    { sectionId: hoidEra2.id, body: "Hoid makes a brief appearance in The Bands of Mourning, encountered by Wax during the events in New Seran. He continues his pattern of appearing at critical junctures in Scadrial's history, now centuries after the Catacendre reshaped the world.", revealPointId: rpBoM28.id, sortOrder: 0, status: "published", passageType: "prose" },
    { sectionId: hoidEra2.id, body: "In the epilogue of Bands of Mourning, additional context about Hoid's activities is hinted at, along with the alias \"Topaz.\" His long-term goals on Scadrial remain unclear, but his continued presence suggests the planet holds something of great importance to him.", revealPointId: rpBoMEpilogue.id, sortOrder: 1, status: "published", passageType: "prose" },
  ]);

  console.log("  ✓ Article: Hoid (3 sections, 6 passages, 6 infobox fields) — CROSS-SERIES");

  console.log("\n✅ Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
