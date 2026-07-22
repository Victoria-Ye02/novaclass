import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { LanguageProvider } from "./LanguageContext";
// --- Victoria's pages ---
import Login from "./pages/victoria/Login";
import Dashboard from "./pages/victoria/Dashboard";
import KMate from "./pages/victoria/KMate";
import Classroom from "./pages/victoria/Classroom";
import ClassDetail from "./pages/victoria/ClassDetail";
import MaterialPreview from "./pages/victoria/MaterialPreview";
import Settings from "./pages/victoria/Settings";
import Exam from "./pages/victoria/Exam";
// --- Thine's pages (add as they land in pages/thine/) ---
// import XXX from "./pages/thine/XXX";
import NovaAssistant from "./components/NovaAssistant";

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("nova_token");
  return token ? children : <Navigate to="/login" />;
}

function NovaAssistantWrapper() {
  const loc = useLocation();
  const token = localStorage.getItem("nova_token");
  if (loc.pathname === "/login" || !token) return null;
  return <NovaAssistant />;
}

// Modal-route pattern: when navigated to with { state: { backgroundLocation } },
// the main <Routes> keeps rendering the page underneath (background) while a
// second <Routes> renders the material preview on top, as an overlay.
// Direct URL entry / refresh has no backgroundLocation in state, so it falls
// through to the normal (non-overlay) route below and renders standalone.
function AppRoutes() {
  const location = useLocation();
  const backgroundLocation = location.state?.backgroundLocation;

  return (
    <>
      <Routes location={backgroundLocation || location}>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/kmate" element={<ProtectedRoute><KMate /></ProtectedRoute>} />
        <Route path="/classroom" element={<ProtectedRoute><Classroom /></ProtectedRoute>} />
        <Route path="/classroom/:id" element={<ProtectedRoute><ClassDetail /></ProtectedRoute>} />
        <Route path="/classroom/:id/material/:materialId" element={<ProtectedRoute><MaterialPreview /></ProtectedRoute>} />
        <Route path="/exam"     element={<ProtectedRoute><Exam /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>

      {backgroundLocation && (
        <Routes>
          <Route path="/classroom/:id/material/:materialId" element={<ProtectedRoute><MaterialPreview isOverlay /></ProtectedRoute>} />
        </Routes>
      )}
    </>
  );
}

export default function App() {
  return (
    <LanguageProvider>
    <BrowserRouter>
      <NovaAssistantWrapper />
      <AppRoutes />
    </BrowserRouter>
    </LanguageProvider>
  );
}
