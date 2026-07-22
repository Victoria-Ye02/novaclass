import { useCallback, useEffect, useRef, useState } from "react";
import API from "../services/api";
import { extractPdfPage } from "../services/pdfHighlightExtraction";
import { retryRequest } from "../utils/retryRequest";

const POLL_INTERVAL_MS = 2000;
const HIGHLIGHT_FAILURE_MESSAGE = "하이라이트 분석에 실패했습니다. 잠시 후 다시 시도해 주세요.";

const INITIAL_STATE = {
  materialId: null,
  status: "idle",
  progress: { completedPages: 0, totalPages: 0 },
  highlights: {},
  error: null,
};

function isCanceled(error) {
  return error?.code === "ERR_CANCELED" || error?.name === "AbortError" || error?.name === "CanceledError";
}

function mapStatus(status) {
  return status === "missing" ? "idle" : status;
}

function buildPageFormData(analysisId, pageNumber, extracted) {
  const formData = new FormData();
  formData.append("analysisId", String(analysisId));
  formData.append("pageNumber", String(pageNumber));
  formData.append("sourceType", extracted.sourceType);
  if (extracted.sourceType === "ocr") {
    formData.append("image", extracted.image, `page-${pageNumber}.png`);
  } else {
    formData.append("candidates", JSON.stringify(extracted.candidates || []));
  }
  return formData;
}

function shouldPoll(status, preparation) {
  if (status === "processing") return true;
  if (status === "pending" && !preparation.started) return true;
  return false;
}

function createAwaitedPipelinePromise(preparation) {
  if (!preparation.awaitedPipelinePromise) {
    preparation.awaitedPipelinePromise = new Promise((resolve) => {
      preparation.resolveAwaitedPipelinePromise = resolve;
    });
  }
  return preparation.awaitedPipelinePromise;
}

function resolveAwaitedPipelinePromise(preparation) {
  if (preparation.resolveAwaitedPipelinePromise) {
    const resolve = preparation.resolveAwaitedPipelinePromise;
    preparation.resolveAwaitedPipelinePromise = null;
    resolve();
  }
}

export function useMaterialHighlights({ materialId, enabled }) {
  const [state, setState] = useState(INITIAL_STATE);
  const [visible, setVisible] = useState(true);
  const lifecycleControllerRef = useRef(null);
  const preparationRef = useRef(null);
  const pollTimerRef = useRef(null);

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current !== null) {
      globalThis.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const setStateIfCurrent = useCallback((preparation, updater) => {
    if (preparationRef.current !== preparation) return;
    setState((previous) => (typeof updater === "function" ? updater(previous) : updater));
  }, []);

  const applyServerStateRef = useRef(null);

  const refreshStatus = useCallback(async (preparation, controller) => {
    const { data } = await API.get(
      `/classroom/materials/${preparation.materialId}/highlights`,
      { signal: controller.signal }
    );
    if (controller.signal.aborted || preparationRef.current !== preparation) return;
    applyServerStateRef.current(preparation, controller, data);
  }, []);

  const applyServerState = useCallback((preparation, controller, data) => {
    if (preparationRef.current !== preparation) return;
    const status = mapStatus(data?.status);
    preparation.cacheStatus = data?.status;
    preparation.cacheChecked = true;
    if (Number.isFinite(Number(data?.progress?.totalPages)) && Number(data?.progress?.totalPages) > 0) {
      preparation.totalPages = Number(data.progress.totalPages);
    }
    if (Array.isArray(data?.submittedPages)) {
      preparation.submittedPageNumbers = new Set(data.submittedPages);
    }
    setStateIfCurrent(preparation, {
      materialId: preparation.materialId,
      status,
      progress: data?.progress || { completedPages: 0, totalPages: 0 },
      highlights: data?.highlights || {},
      error: status === "failed" ? HIGHLIGHT_FAILURE_MESSAGE : null,
    });

    clearPollTimer();
    if (shouldPoll(status, preparation)) {
      pollTimerRef.current = globalThis.setInterval(() => {
        refreshStatus(preparation, controller).catch(() => {});
      }, POLL_INTERVAL_MS);
    }
  }, [clearPollTimer, refreshStatus, setStateIfCurrent]);

  useEffect(() => {
    applyServerStateRef.current = applyServerState;
  }, [applyServerState]);

  const runPreparationPipeline = useCallback(async (preparation, pdf, controller) => {
    const signal = controller.signal;
    const materialIdValue = preparation.materialId;

    try {
      setStateIfCurrent(preparation, (previous) => ({ ...previous, status: "preparing", error: null }));

      const totalPages = Number(pdf?.numPages) || 0;
      const { data: startData } = await retryRequest(
        () => API.post(
          `/classroom/materials/${materialIdValue}/highlights/start`,
          { totalPages },
          { signal }
        ),
        { signal }
      );
      if (signal.aborted || preparationRef.current !== preparation) return;

      const analysisId = startData.analysisId;
      const alreadySubmitted = new Set(startData.submittedPages || []);
      preparation.totalPages = totalPages;
      preparation.submittedPageNumbers = new Set(alreadySubmitted);
      let submittedCount = alreadySubmitted.size;
      setStateIfCurrent(preparation, (previous) => ({
        ...previous,
        progress: { completedPages: submittedCount, totalPages },
      }));

      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
        if (alreadySubmitted.has(pageNumber)) continue;
        if (signal.aborted || preparationRef.current !== preparation) return;

        const extracted = await extractPdfPage(pdf, pageNumber);
        if (signal.aborted || preparationRef.current !== preparation) return;

        const formData = buildPageFormData(analysisId, pageNumber, extracted);
        await retryRequest(
          () => API.post(
            `/classroom/materials/${materialIdValue}/highlights/pages`,
            formData,
            { signal }
          ),
          { signal }
        );

        submittedCount += 1;
        preparation.submittedPageNumbers.add(pageNumber);
        setStateIfCurrent(preparation, (previous) => ({
          ...previous,
          progress: { completedPages: submittedCount, totalPages },
        }));
      }

      if (signal.aborted || preparationRef.current !== preparation) return;
      await retryRequest(
        () => API.post(
          `/classroom/materials/${materialIdValue}/highlights/complete`,
          { analysisId },
          { signal }
        ),
        { signal }
      );

      if (signal.aborted || preparationRef.current !== preparation) return;
      await refreshStatus(preparation, controller);
    } catch (error) {
      if (isCanceled(error) || signal.aborted || preparationRef.current !== preparation) return;
      clearPollTimer();
      setStateIfCurrent(preparation, (previous) => ({
        ...previous,
        status: "failed",
        error: HIGHLIGHT_FAILURE_MESSAGE,
      }));
    }
  }, [clearPollTimer, refreshStatus, setStateIfCurrent]);

  const maybeStartPreparation = useCallback((preparation, controller) => {
    if (!preparation.cacheChecked) return;
    if (preparation.started) return;
    if (!preparation.pendingPdf) return;
    if (!["missing", "pending"].includes(preparation.cacheStatus)) {
      resolveAwaitedPipelinePromise(preparation);
      return;
    }

    preparation.started = true;
    clearPollTimer();
    const pipelinePromise = runPreparationPipeline(preparation, preparation.pendingPdf, controller);
    preparation.pipelinePromise = pipelinePromise;
    pipelinePromise.then(
      () => resolveAwaitedPipelinePromise(preparation),
      () => resolveAwaitedPipelinePromise(preparation)
    );
  }, [clearPollTimer, runPreparationPipeline]);

  useEffect(() => {
    lifecycleControllerRef.current?.abort();
    clearPollTimer();
    const controller = new AbortController();
    lifecycleControllerRef.current = controller;

    if (!enabled || !materialId) {
      preparationRef.current = null;
      return () => controller.abort();
    }

    const preparation = {
      materialId: String(materialId),
      cacheChecked: false,
      cacheStatus: null,
      started: false,
      pendingPdf: null,
      pipelinePromise: null,
      totalPages: 0,
      submittedPageNumbers: new Set(),
      awaitedPipelinePromise: null,
      resolveAwaitedPipelinePromise: null,
    };
    preparationRef.current = preparation;

    API.get(`/classroom/materials/${materialId}/highlights`, { signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted || preparationRef.current !== preparation) return;
        applyServerState(preparation, controller, data);
        maybeStartPreparation(preparation, controller);
      })
      .catch((error) => {
        if (isCanceled(error) || controller.signal.aborted || preparationRef.current !== preparation) return;
        preparation.cacheChecked = true;
        preparation.cacheStatus = "failed";
        setStateIfCurrent(preparation, {
          ...INITIAL_STATE,
          materialId: preparation.materialId,
          status: "failed",
          error: HIGHLIGHT_FAILURE_MESSAGE,
        });
      });

    return () => {
      controller.abort();
      clearPollTimer();
    };
  }, [materialId, enabled, applyServerState, maybeStartPreparation, clearPollTimer, setStateIfCurrent]);

  const preparePdf = useCallback((pdf) => {
    const preparation = preparationRef.current;
    const controller = lifecycleControllerRef.current;
    if (!preparation || !controller || controller.signal.aborted || !pdf) {
      return Promise.resolve();
    }

    if (!preparation.pendingPdf) {
      preparation.pendingPdf = pdf;
      maybeStartPreparation(preparation, controller);
    }

    // If the pipeline has already started, its own promise tracks completion.
    if (preparation.pipelinePromise) return preparation.pipelinePromise;
    // If the cache check has already resolved (synchronously, within the call
    // above, or from an earlier call), the "start or not" decision is final —
    // nothing further will ever run, so there is nothing left to await.
    if (preparation.cacheChecked) return Promise.resolve();
    // The cache check is still in flight: return a promise that settles once
    // the pipeline this call triggers (started later, from the cache-check
    // GET's continuation) actually finishes — not an immediately-resolved one.
    return createAwaitedPipelinePromise(preparation);
  }, [maybeStartPreparation]);

  const retry = useCallback(async () => {
    const preparation = preparationRef.current;
    const controller = lifecycleControllerRef.current;
    if (!preparation || !controller || controller.signal.aborted) return;

    const totalPages = preparation.totalPages || 0;
    const submittedCount = preparation.submittedPageNumbers ? preparation.submittedPageNumbers.size : 0;
    const pagesIncomplete = totalPages > 0 && submittedCount < totalPages;

    // If pages were never fully submitted (a local page-submission call failed
    // permanently before the pipeline finished), the backend /retry endpoint
    // will 409 ("All PDF pages must be submitted before analysis"). The
    // pipeline itself (start -> submit missing pages -> complete) is
    // idempotent server-side, so simply re-running it resumes correctly. Only
    // take this path when we still have the pdf needed to extract pages.
    if (pagesIncomplete && preparation.pendingPdf) {
      clearPollTimer();
      const pipelinePromise = runPreparationPipeline(preparation, preparation.pendingPdf, controller);
      preparation.pipelinePromise = pipelinePromise;
      await pipelinePromise;
      return;
    }

    clearPollTimer();
    setStateIfCurrent(preparation, (previous) => ({ ...previous, status: "processing", error: null }));

    try {
      await retryRequest(
        () => API.post(
          `/classroom/materials/${preparation.materialId}/highlights/retry`,
          {},
          { signal: controller.signal }
        ),
        { signal: controller.signal }
      );
      if (controller.signal.aborted || preparationRef.current !== preparation) return;
      await refreshStatus(preparation, controller);
    } catch (error) {
      if (isCanceled(error) || controller.signal.aborted || preparationRef.current !== preparation) return;
      setStateIfCurrent(preparation, (previous) => ({
        ...previous,
        status: "failed",
        error: HIGHLIGHT_FAILURE_MESSAGE,
      }));
    }
  }, [clearPollTimer, refreshStatus, runPreparationPipeline, setStateIfCurrent]);

  const isActive = Boolean(enabled && materialId);
  const stateIsCurrent = isActive && String(state.materialId) === String(materialId);

  return {
    status: !isActive ? "idle" : stateIsCurrent ? state.status : "checking",
    progress: stateIsCurrent ? state.progress : INITIAL_STATE.progress,
    highlights: stateIsCurrent ? state.highlights : INITIAL_STATE.highlights,
    error: stateIsCurrent ? state.error : null,
    visible,
    setVisible,
    preparePdf,
    retry,
  };
}
