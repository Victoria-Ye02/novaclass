import { useCallback, useEffect, useRef, useState } from "react";
import API from "../services/api";
import { retryRequest } from "../utils/retryRequest";

function normalizePages(pages) {
  return [...new Set((Array.isArray(pages) ? pages : [])
    .map(Number)
    .filter((page) => Number.isInteger(page) && page > 0))]
    .sort((a, b) => a - b);
}

export function useMaterialBookmarks({ materialId, enabled }) {
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [syncingPage, setSyncingPage] = useState(null);
  const [error, setError] = useState(null);
  const lifecycleControllerRef = useRef(null);
  const syncingRef = useRef(null);

  useEffect(() => {
    lifecycleControllerRef.current?.abort();
    const controller = new AbortController();
    lifecycleControllerRef.current = controller;
    syncingRef.current = null;
    setSyncingPage(null);
    setError(null);

    if (!enabled || !materialId) {
      setBookmarks([]);
      setLoading(false);
      return () => controller.abort();
    }

    setLoading(true);
    API.get(`/classroom/materials/${materialId}/bookmarks`, { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) setBookmarks(normalizePages(data?.pages));
      })
      .catch((requestError) => {
        if (requestError?.code !== "ERR_CANCELED" && !controller.signal.aborted) {
          setError("저장한 페이지 목록을 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
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
    setSyncingPage(page);
    setError(null);
    setBookmarks(optimistic);

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
        setBookmarks(previous);
        setError("페이지 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      }
      return false;
    } finally {
      syncingRef.current = null;
      if (!signal?.aborted) setSyncingPage(null);
    }
  }, [bookmarks, enabled, materialId]);

  const clearError = useCallback(() => setError(null), []);

  return { bookmarks, loading, syncingPage, error, toggleBookmark, clearError };
}
