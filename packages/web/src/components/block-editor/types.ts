import type { Section, Passage, Infobox, InfoboxField, PassageType, InfoboxFieldMode } from "@chronolore/shared";

export interface SectionWithPassages extends Section {
  passages: Passage[];
  children?: SectionWithPassages[];
}

export interface InfoboxWithFields extends Infobox {
  fields: InfoboxField[];
}

export interface BookColor {
  name: string;
  color: string;
  bg: string;
}

// Warm, distinct, non-garish palette for books
export const BOOK_COLORS: string[] = [
  "#b45309", // amber
  "#0f766e", // teal
  "#9f1239", // rose
  "#1d4ed8", // blue
  "#65a30d", // lime
  "#7c3aed", // violet (muted)
  "#c2410c", // orange
  "#0369a1", // sky
  "#4d7c0f", // green
  "#a21caf", // fuchsia
  "#dc2626", // red
  "#0891b2", // cyan
];

export const BOOK_BG_COLORS: string[] = [
  "#fef3c7",
  "#ccfbf1",
  "#fce7f3",
  "#dbeafe",
  "#ecfccb",
  "#ede9fe",
  "#ffedd5",
  "#e0f2fe",
  "#dcfce7",
  "#fae8ff",
  "#fee2e2",
  "#cffafe",
];

export const STATUS_COLORS: Record<string, string> = {
  draft: "#57534e",      // stone — clearly muted/inactive
  review: "#0369a1",     // sky blue — awaiting action, distinct from book colors
  published: "#15803d",  // green — good to go
  rejected: "#b91c1c",   // red — needs attention
};

export const STATUS_BG: Record<string, string> = {
  draft: "#e7e5e4",      // stone light
  review: "#e0f2fe",     // sky blue light
  published: "#dcfce7",  // green light
  rejected: "#fee2e2",   // red light
};
