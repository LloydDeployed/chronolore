import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { NavBar } from "./components/NavBar";
import { HomePage } from "./pages/HomePage";
import { UniversePage } from "./pages/UniversePage";
import { ArticlePage } from "./pages/ArticlePage";
import { ModeratePage } from "./pages/ModeratePage";
import "./styles.css";

export function App() {
  const { user, isAuthenticated, setAuth, logout } = useAuth();

  return (
    <BrowserRouter>
      <NavBar user={user} onAuth={setAuth} onLogout={logout} />
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
          path="/:universeSlug/moderate"
          element={<ModeratePage isAuthenticated={isAuthenticated} />}
        />
      </Routes>
    </BrowserRouter>
  );
}
