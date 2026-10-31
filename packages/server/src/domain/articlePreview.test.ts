import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectArticleRevealPointIds,
  orderArticleRevealPoints,
  resolvePreviewProgress,
} from "./articlePreview.js";

describe("article preview reveal points", () => {
  it("collects only distinct non-null reveal points referenced by article content", () => {
    assert.deepEqual(
      collectArticleRevealPointIds(
        [{ revealPointId: "chapter-3" }, { revealPointId: null }, { revealPointId: "chapter-1" }],
        [{ revealPointId: "chapter-1" }, { revealPointId: "chapter-38" }],
      ),
      ["chapter-3", "chapter-1", "chapter-38"],
    );
  });

  it("orders checkpoints by series, entry, then segment position", () => {
    const rows = [
      // Equal series positions still keep each series grouped before comparing entries.
      point("b-2", "series-b", 10, "entry-b", 0, 2),
      point("a2-1", "series-a", 10, "entry-a2", 2, 1),
      point("a1-3", "series-a", 10, "entry-a1", 1, 3),
      point("a1-1", "series-a", 10, "entry-a1", 1, 1),
    ];

    assert.deepEqual(
      orderArticleRevealPoints(rows).map((row) => row.revealPointId),
      ["a1-1", "a1-3", "a2-1", "b-2"],
    );
  });
});

describe("preview progress override", () => {
  it("treats an explicitly empty selection as preview mode with no revealed checkpoints", () => {
    assert.deepEqual(resolvePreviewProgress("", true, ["persisted-reader-progress"]), {
      isPreview: true,
      revealPointIds: [],
    });
  });

  it("preserves actual reader progress outside authenticated preview simulation", () => {
    assert.deepEqual(resolvePreviewProgress(undefined, true, ["persisted-reader-progress"]), {
      isPreview: false,
      revealPointIds: ["persisted-reader-progress"],
    });
    assert.deepEqual(resolvePreviewProgress("preview-only", false, ["persisted-reader-progress"]), {
      isPreview: false,
      revealPointIds: ["persisted-reader-progress"],
    });
  });
});

function point(
  revealPointId: string,
  seriesId: string,
  seriesSortOrder: number,
  entryId: string,
  entrySortOrder: number,
  segmentSortOrder: number,
) {
  return {
    revealPointId,
    seriesId,
    seriesName: seriesId,
    seriesSortOrder,
    entryId,
    entryName: entryId,
    entrySortOrder,
    segmentId: `${entryId}-${segmentSortOrder}`,
    segmentName: `Segment ${segmentSortOrder}`,
    segmentSortOrder,
  };
}
