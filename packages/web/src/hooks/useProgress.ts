import { useState, useCallback, useEffect } from "react";
import type { EntryProgress, ProgressState } from "@chronolore/shared";

const STORAGE_KEY = "chronolore-progress";

function loadProgress(): ProgressState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveProgress(state: ProgressState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function useProgress(universeSlug: string) {
  const [progress, setProgressState] = useState<EntryProgress>(() => {
    return loadProgress()[universeSlug] ?? {};
  });

  useEffect(() => {
    const all = loadProgress();
    all[universeSlug] = progress;
    saveProgress(all);
  }, [progress, universeSlug]);

  const setEntryProgress = useCallback(
    (entrySlug: string, value: string | null) => {
      setProgressState((prev) => {
        const next = { ...prev };
        if (value === null) {
          delete next[entrySlug];
        } else {
          next[entrySlug] = value;
        }
        return next;
      });
    },
    [],
  );

  const clearProgress = useCallback(() => {
    setProgressState({});
  }, []);

  const hasAnyProgress = Object.keys(progress).length > 0;

  return { progress, setEntryProgress, clearProgress, hasAnyProgress };
}
