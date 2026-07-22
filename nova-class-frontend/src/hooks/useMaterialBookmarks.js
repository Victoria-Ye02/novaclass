import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import API from "../services/api";
import { retryRequest } from "../utils/retryRequest";

function normalizePages(pages) {
  return [...new Set((Array.isArray(pages) ? pages : [])
    .map(Number)
    .filter((page) => Number.isInteger(page) && page > 0))]
    .sort((a, b) => a - b);
}

export function useMaterialBookmarks({ materialId, enabled }) {
  const [loadedState, setLoadedState] = useState({
    materialId: null,
    bookmarks: [],
    error: null,
  });
  const [syncingOperation, setSyncingOperation] = useState(null);
  const [mutationError, setMutationError] = useState(null);
  const lifecycleControllerRef = useRef(null);
  const syncingRef = useRef(null);

  const stateIsCurrent = enabled && String(loadedState.materialId) === String(materialId);
  const bookmarks = useMemo(
    () => stateIsCurrent ? loadedState.bookmarks : [],
    [loadedState.bookmarks, stateIsCurrent]
  );
  const loading = Boolean(enabled && materialId && !stateIsCurrent);
  const syncingPage = syncingOperation?.materialId === materialId
    ? syncingOperation.page
    : null;
  const error = mutationError?.materialId === materialId
    ? mutationError.message
    : stateIsCurrent ? loadedState.error : null;

  useEffect(() => {
    lifecycleControllerRef.current?.abort();
    const controller = new AbortController();
    lifecycleControllerRef.current = controller;
    syncingRef.current = null;

    if (!enabled || !materialId) {
      return () => controller.abort();
    }

    API.get(`/classroom/materials/${materialId}/bookmarks`, { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setLoadedState({
            materialId,
            bookmarks: normalizePages(data?.pages),
            error: null,
          });
        }
      })
      .catch((requestError) => {
        if (requestError?.code !== "ERR_CANCELED" && !controller.signal.aborted) {
          setLoadedState({
            materialId,
            bookmarks: [],
            error: "저장한 페이지 목록을 불러오지 못했습니다.",
          });
        }
      });

    return () => controller.abort();
  }, [enabled, materialId]);

  const toggleBookmark = useCallback(async (pageNumber) => {
    const page = Number(pageNumber);
    if (!enabled || !materialId || !Number.isInteger(page) || page <= 0) return false;
    if (syncingRef.current !== null) return false;

    const previous = bookmarks;
    const wasSaved = previous.includes(page);
    const optimistic = wasSaved
      ? previous.filter((savedPage) => savedPage !== page)
      : normalizePages([...previous, page]);

    syncingRef.current = page;
    setSyncingOperation({ materialId, page });
    setMutationError(null);
    setLoadedState({ materialId, bookmarks: optimistic, error: null });

    const controller = lifecycleControllerRef.current;
    const signal = controller?.signal;

    try {
      await retryRequest(
        () => wasSaved
          ? API.delete(`/classroom/materials/${materialId}/bookmarks/${page}`, { signal })
          : API.post(
            `/classroom/materials/${materialId}/bookmarks`,
            { pageNumber: page },
            { signal }
          ),
        { signal }
      );
      return true;
    } catch (requestError) {
      if (!signal?.aborted && requestError?.code !== "ERR_CANCELED") {
        setLoadedState({ materialId, bookmarks: previous, error: null });
        setMutationError({
          materialId,
          message: "페이지 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        });
      }
      return false;
    } finally {
      syncingRef.current = null;
      if (!signal?.aborted) setSyncingOperation(null);
    }
  }, [bookmarks, enabled, materialId]);

  const clearError = useCallback(() => setMutationError(null), []);

  return { bookmarks, loading, syncingPage, error, toggleBookmark, clearError };
}
