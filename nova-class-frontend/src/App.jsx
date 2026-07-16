import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { LanguageProvider } from "./LanguageContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import KMate from "./pages/KMate";
import Classroom from "./pages/Classroom";
import ClassDetail from "./pages/ClassDetail";
import Settings from "./pages/Settings";
import Exam from "./pages/Exam";
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
