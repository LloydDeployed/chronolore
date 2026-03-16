import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { NavBar } from "./components/NavBar";
import { ToastContainer } from "./components/Toast";
import { NotFound } from "./components/NotFound";
import { HomePage } from "./pages/HomePage";
import { UniversePage } from "./pages/UniversePage";
import { ArticlePage } from "./pages/ArticlePage";
import { ModeratePage } from "./pages/ModeratePage";
import { DraftsPage } from "./pages/DraftsPage";
import { EditArticlePage } from "./pages/EditArticlePage";
import "./styles.css";

export function App() {
  const { user, isAuthenticated, setAuth, logout } = useAuth();

  return (
    <BrowserRouter>
      <NavBar user={user} onAuth={setAuth} onLogout={logout} />
      <ToastContainer />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/:universeSlug"
          element={<UniversePage isAuthenticated={isAuthenticated} />}
        />
        <Route
          path="/:universeSlug/articles/:articleSlug"
          element={<ArticlePage isAuthenticated={isAuthenticated} />}
        />
        <Route
          path="/:universeSlug/articles/:articleSlug/edit"
          element={<EditArticlePage isAuthenticated={isAuthenticated} />}
        />
        <Route
          path="/:universeSlug/moderate"
          element={<ModeratePage isAuthenticated={isAuthenticated} />}
        />
        <Route
          path="/:universeSlug/drafts"
          element={<DraftsPage isAuthenticated={isAuthenticated} />}
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
