import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { NavBar } from "./components/NavBar";
import { AuthModal } from "./components/AuthModal";
import { ToastContainer } from "./components/Toast";
import { NotFound } from "./components/NotFound";
import { HomePage } from "./pages/HomePage";
import { UniversePage } from "./pages/UniversePage";
import { ArticlePage } from "./pages/ArticlePage";
import { ModeratePage } from "./pages/ModeratePage";
import { DraftsPage } from "./pages/DraftsPage";
import { EditArticlePage } from "./pages/EditArticlePage";
import "./styles.css";

function AppRoutes() {
  const { user, isAuthenticated, setAuth, logout } = useAuth();
  const location = useLocation();
  const [showAuth, setShowAuth] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth >= 769;
  });
  const pathParts = location.pathname.split("/").filter(Boolean);
  const showSidebarToggle = pathParts.length > 0;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      if (window.innerWidth >= 769) {
        setSidebarOpen(true);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <>
      <NavBar
        user={user}
        onOpenAuth={() => setShowAuth(true)}
        onLogout={logout}
        showSidebarToggle={showSidebarToggle}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
      />
      <ToastContainer />
      {showAuth && (
        <AuthModal
          onAuth={(token, nextUser) => {
            setAuth(token, nextUser);
            setShowAuth(false);
          }}
          onClose={() => setShowAuth(false)}
        />
      )}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/:universeSlug"
          element={<UniversePage isAuthenticated={isAuthenticated} user={user} sidebarOpen={sidebarOpen} onCloseSidebar={() => setSidebarOpen(false)} onOpenAuth={() => setShowAuth(true)} />}
        />
        <Route
          path="/:universeSlug/articles/:articleSlug"
          element={<ArticlePage isAuthenticated={isAuthenticated} user={user} sidebarOpen={sidebarOpen} onCloseSidebar={() => setSidebarOpen(false)} onOpenAuth={() => setShowAuth(true)} />}
        />
        <Route
          path="/:universeSlug/articles/:articleSlug/edit"
          element={<EditArticlePage isAuthenticated={isAuthenticated} />}
        />
        <Route
          path="/:universeSlug/moderate"
          element={<ModeratePage isAuthenticated={isAuthenticated} user={user} sidebarOpen={sidebarOpen} onCloseSidebar={() => setSidebarOpen(false)} onOpenAuth={() => setShowAuth(true)} />}
        />
        <Route
          path="/:universeSlug/drafts"
          element={<DraftsPage isAuthenticated={isAuthenticated} user={user} sidebarOpen={sidebarOpen} onCloseSidebar={() => setSidebarOpen(false)} onOpenAuth={() => setShowAuth(true)} />}
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
