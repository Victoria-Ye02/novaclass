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
    if (!["missing", "pending"].includes(preparation.cacheStatus)) return;

    preparation.started = true;
    clearPollTimer();
    preparation.pipelinePromise = runPreparationPipeline(preparation, preparation.pendingPdf, controller);
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
    if (preparation.pendingPdf) {
      return preparation.pipelinePromise || Promise.resolve();
    }
    preparation.pendingPdf = pdf;
    maybeStartPreparation(preparation, controller);
    return preparation.pipelinePromise || Promise.resolve();
  }, [maybeStartPreparation]);

  const retry = useCallback(async () => {
    const preparation = preparationRef.current;
    const controller = lifecycleControllerRef.current;
    if (!preparation || !controller || controller.signal.aborted) return;

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
  }, [clearPollTimer, refreshStatus, setStateIfCurrent]);

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
