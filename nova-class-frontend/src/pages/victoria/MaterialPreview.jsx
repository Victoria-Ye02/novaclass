import { useCallback, useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../../services/api";
import PdfLessonViewer from "../../components/PdfLessonViewer";
import { useMaterialBookmarks } from "../../hooks/useMaterialBookmarks";

const API_ORIGIN = "http://localhost:5001";

const FILE_TYPE_LABEL = {
  pdf: "PDF", docx: "Word", pptx: "PowerPoint",
  png: "Image", jpg: "Image", jpeg: "Image", webp: "Image", gif: "Image",
  mp4: "Video", webm: "Video",
};

async function fetchMaterial(materialId) {
  const { data } = await API.get(`/classroom/materials/${materialId}`);
  return data;
}

export default function MaterialPreview({ isOverlay = false }) {
  const { id, materialId } = useParams();
  const navigate = useNavigate();
  const [material, setMaterial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setMaterial(await fetchMaterial(materialId));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [materialId]);

  useEffect(() => {
    let active = true;
    fetchMaterial(materialId)
      .then((data) => {
        if (active) {
          setMaterial(data);
          setError(false);
        }
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [materialId]);

  // Overlay mode: closing goes back to whatever pushed this route (the classroom
  // page underneath). Standalone mode (direct URL / refresh — no history to return
  // to within the app) goes to the classroom page explicitly instead.
  function goBack() {
    if (isOverlay) navigate(-1);
    else navigate(`/classroom/${id}`);
  }

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") goBack();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOverlay, id]);

  useEffect(() => {
    if (!isOverlay) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prevOverflow; };
  }, [isOverlay]);

  const token = localStorage.getItem("nova_token");
  const fileUrl = material?.file_url
    ? `${API_ORIGIN}/api${material.file_url}?token=${encodeURIComponent(token)}`
    : null;
  const ext = material?.file_ext;
  const typeLabel = FILE_TYPE_LABEL[ext] || "File";
  const isImage = ["png", "jpg", "jpeg", "webp", "gif"].includes(ext);
  const isVideo = ["mp4", "webm"].includes(ext);
  const isPdf = ext === "pdf";
  const {
    bookmarks,
    syncingPage,
    error: bookmarkError,
    toggleBookmark,
  } = useMaterialBookmarks({
    materialId,
    enabled: isPdf && Boolean(fileUrl),
  });

  const content = (
    <>
      {/* Top bar */}
      <div style={topBar}>
        <button onClick={goBack} style={backBtn} aria-label="Back to classroom">←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={fileNameStyle}>{loading ? "Loading…" : material?.title || "Untitled"}</div>
        </div>
        {!loading && !error && (
          <span style={badge}>{typeLabel}</span>
        )}
        {fileUrl && (
          <a href={fileUrl} download={material?.title} style={downloadBtn}>
            ⬇ Download
          </a>
        )}
      </div>

      {/* Body */}
      <div style={body}>
        {loading ? (
          <div style={skeleton}>
            <div style={skeletonBar} />
            <div style={{ ...skeletonBar, width: "60%" }} />
          </div>
        ) : error ? (
          <div style={centerMsg}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>⚠️</div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "#1a1a2e", marginBottom: "16px" }}>
              Couldn't load this material.
            </div>
            <button onClick={load} style={retryBtn}>Retry</button>
          </div>
        ) : !fileUrl ? (
          <div style={centerMsg}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>📄</div>
            <div style={{ fontSize: "15px", color: "#6b7280" }}>No file attached to this lesson.</div>
          </div>
        ) : isPdf ? (
          <PdfLessonViewer
            fileUrl={fileUrl}
            title={material.title}
            bookmarks={bookmarks}
            syncingPage={syncingPage}
            bookmarkError={bookmarkError}
            onToggleBookmark={toggleBookmark}
            onDismissEmptySpace={isOverlay ? goBack : undefined}
          />
        ) : isImage ? (
          <div style={centerMsg}>
            <img src={fileUrl} alt={material.title} style={imgStyle} />
          </div>
        ) : isVideo ? (
          <div style={centerMsg}>
            <video src={fileUrl} controls style={videoStyle} />
          </div>
        ) : (
          <div style={centerMsg}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>📎</div>
            <div style={{ fontSize: "15px", color: "#6b7280", marginBottom: "16px" }}>
              Preview isn't available for this file type.
            </div>
            <a href={fileUrl} download={material.title} style={retryBtn}>Download</a>
          </div>
        )}
      </div>
    </>
  );

  if (isOverlay) {
    return (
      <div className="material-overlay-backdrop" style={backdrop} onClick={goBack}>
        <div className="material-overlay-card" style={overlayCard} onClick={e => e.stopPropagation()}>
          {content}
        </div>
      </div>
    );
  }

  return (
    <div style={page}>
      {content}
    </div>
  );
}

const page = {
  height: "100vh", width: "100vw", display: "flex", flexDirection: "column",
  background: "#1a1a2e", position: "fixed", inset: 0,
};

const backdrop = {
  position: "fixed", inset: 0, zIndex: 50,
  background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
  display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer",
};

const overlayCard = {
  width: "100%", maxWidth: "1100px", height: "100%",
  background: "#1a1a2e", borderRadius: "16px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
  overflow: "hidden", cursor: "default",
  display: "flex", flexDirection: "column",
};

const topBar = {
  height: "60px", flexShrink: 0, display: "flex", alignItems: "center", gap: "14px",
  padding: "0 20px", background: "#fff", borderBottom: "1px solid #e5e7eb",
};

const backBtn = {
  background: "none", border: "none", fontSize: "22px", color: "#6b7280",
  cursor: "pointer", lineHeight: 1, flexShrink: 0,
};

const fileNameStyle = {
  fontSize: "15px", fontWeight: 700, color: "#1a1a2e",
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};

const badge = {
  fontSize: "11px", fontWeight: 700, color: "#3B37CC", background: "#f0f4ff",
  padding: "4px 10px", borderRadius: "20px", flexShrink: 0,
};

const downloadBtn = {
  display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 700,
  color: "#fff", background: "#3B37CC", padding: "8px 16px", borderRadius: "8px",
  flexShrink: 0, whiteSpace: "nowrap",
};

const body = {
  flex: 1, minHeight: 0, display: "flex", alignItems: "stretch", justifyContent: "center",
  background: "#525659",
};

const centerMsg = {
  flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
  justifyContent: "center", textAlign: "center", padding: "40px",
};

const imgStyle = { maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: "6px" };

const videoStyle = { maxWidth: "100%", maxHeight: "100%" };

const retryBtn = {
  background: "#3B37CC", color: "#fff", border: "none", borderRadius: "8px",
  padding: "10px 20px", fontSize: "13px", fontWeight: 700, cursor: "pointer",
  textDecoration: "none", display: "inline-block",
};

const skeleton = {
  flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
  justifyContent: "center", gap: "12px", padding: "40px",
};

const skeletonBar = {
  width: "80%", maxWidth: "480px", height: "16px", borderRadius: "6px",
  background: "linear-gradient(90deg, #3a3a52 25%, #4a4a68 50%, #3a3a52 75%)",
  backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite",
};
