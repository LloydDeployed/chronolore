import { generateHTML } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { useMemo } from "react";

const extensions = [
  StarterKit.configure({ heading: false }),
  Underline,
  Link.configure({ openOnClick: true }),
];

function parseContent(content: string) {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    if (parsed && parsed.type === "doc") return parsed;
  } catch {
    // plain text
  }
  return {
    type: "doc",
    content: content.split("\n").map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : [],
    })),
  };
}

/** Extract plain text from Tiptap JSON (for truncation/preview). */
export function extractText(content: string, maxLen?: number): string {
  if (!content) return "";
  try {
    const parsed = JSON.parse(content);
    if (parsed && parsed.type === "doc") {
      const texts: string[] = [];
      const walk = (node: any) => {
        if (node.text) texts.push(node.text);
        if (node.content) node.content.forEach(walk);
      };
      walk(parsed);
      const full = texts.join(" ");
      if (maxLen && full.length > maxLen) return full.slice(0, maxLen) + "…";
      return full;
    }
  } catch {
    // plain text
  }
  if (maxLen && content.length > maxLen) return content.slice(0, maxLen) + "…";
  return content;
}

interface Props {
  content: string;
}

export function TiptapRenderer({ content }: Props) {
  const html = useMemo(() => {
    const doc = parseContent(content);
    if (!doc) return "";
    return generateHTML(doc, extensions);
  }, [content]);

  return <div className="tiptap-renderer" dangerouslySetInnerHTML={{ __html: html }} />;
}
