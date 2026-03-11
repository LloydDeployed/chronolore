import { useEffect } from "react";

export function useTitle(title: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = title ? `${title} — Chronolore` : "Chronolore";
    return () => {
      document.title = prev;
    };
  }, [title]);
}
