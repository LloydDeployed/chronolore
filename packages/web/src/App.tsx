import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { UniversePage } from "./pages/UniversePage";
import { ArticlePage } from "./pages/ArticlePage";
import "./styles.css";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/:universeSlug" element={<UniversePage />} />
        <Route
          path="/:universeSlug/articles/:articleSlug"
          element={<ArticlePage />}
        />
      </Routes>
    </BrowserRouter>
  );
}
