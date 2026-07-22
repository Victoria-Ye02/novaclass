import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import API from "../services/api";
import { useMaterialBookmarks } from "./useMaterialBookmarks";

vi.mock("../services/api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../utils/retryRequest", () => ({
  retryRequest: vi.fn((operation) => operation()),
}));

describe("useMaterialBookmarks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    API.get.mockResolvedValue({ data: { pages: [] } });
  });

  it("loads unique positive pages in ascending order", async () => {
    API.get.mockResolvedValue({ data: { pages: [7, 2, 2, 0, -1] } });

    const { result } = renderHook(() =>
      useMaterialBookmarks({ materialId: "9", enabled: true })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.bookmarks).toEqual([2, 7]);
    expect(API.get).toHaveBeenCalledWith(
      "/classroom/materials/9/bookmarks",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("optimistically saves a page and keeps it after synchronization", async () => {
    API.get.mockResolvedValue({ data: { pages: [2, 7] } });
    API.post.mockResolvedValue({ data: { pageNumber: 4, saved: true } });
    const { result } = renderHook(() =>
      useMaterialBookmarks({ materialId: "9", enabled: true })
    );
    await waitFor(() => expect(result.current.bookmarks).toEqual([2, 7]));

    await act(() => result.current.toggleBookmark(4));

    expect(result.current.bookmarks).toEqual([2, 4, 7]);
    expect(API.post).toHaveBeenCalledWith(
      "/classroom/materials/9/bookmarks",
      { pageNumber: 4 },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(result.current.syncingPage).toBeNull();
  });

  it("optimistically removes an existing page", async () => {
    API.get.mockResolvedValue({ data: { pages: [2, 7] } });
    API.delete.mockResolvedValue({ data: { pageNumber: 7, saved: false } });
    const { result } = renderHook(() =>
      useMaterialBookmarks({ materialId: "9", enabled: true })
    );
    await waitFor(() => expect(result.current.bookmarks).toEqual([2, 7]));

    await act(() => result.current.toggleBookmark(7));

    expect(result.current.bookmarks).toEqual([2]);
    expect(API.delete).toHaveBeenCalledWith(
      "/classroom/materials/9/bookmarks/7",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("rolls back the optimistic state after synchronization exhausts retries", async () => {
    API.get.mockResolvedValue({ data: { pages: [2] } });
    API.post.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() =>
      useMaterialBookmarks({ materialId: "9", enabled: true })
    );
    await waitFor(() => expect(result.current.bookmarks).toEqual([2]));

    await act(() => result.current.toggleBookmark(4));

    expect(result.current.bookmarks).toEqual([2]);
    expect(result.current.error).toBe("페이지 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    expect(result.current.syncingPage).toBeNull();
  });

  it("does not load or mutate when disabled", async () => {
    const { result } = renderHook(() =>
      useMaterialBookmarks({ materialId: "9", enabled: false })
    );

    expect(result.current.loading).toBe(false);
    await act(() => result.current.toggleBookmark(2));
    expect(API.get).not.toHaveBeenCalled();
    expect(API.post).not.toHaveBeenCalled();
  });
});
