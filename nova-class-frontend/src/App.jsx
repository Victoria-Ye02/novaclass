import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { LanguageProvider } from "./LanguageContext";
// --- Victoria's pages ---
import Login from "./pages/victoria/Login";
import Dashboard from "./pages/victoria/Dashboard";
import KMate from "./pages/victoria/KMate";
import Classroom from "./pages/victoria/Classroom";
import ClassDetail from "./pages/victoria/ClassDetail";
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

export default function App() {
  return (
    <LanguageProvider>
    <BrowserRouter>
      <NovaAssistantWrapper />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/kmate" element={<ProtectedRoute><KMate /></ProtectedRoute>} />
        <Route path="/classroom" element={<ProtectedRoute><Classroom /></ProtectedRoute>} />
        <Route path="/classroom/:id" element={<ProtectedRoute><ClassDetail /></ProtectedRoute>} />
        <Route path="/exam"     element={<ProtectedRoute><Exam /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
    </LanguageProvider>
  );
}
