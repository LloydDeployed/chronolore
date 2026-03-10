import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getUniverses } from "../api/client";

export function HomePage() {
  const [universes, setUniverses] = useState<any[]>([]);

  useEffect(() => {
    getUniverses().then(setUniverses);
  }, []);

  return (
    <div className="home-page">
      <header className="hero">
        <h1>Chronolore</h1>
        <p>The spoiler-safe wiki. Only see what you've read.</p>
      </header>

      <section className="universe-list">
        <h2>Universes</h2>
        {universes.length === 0 && <p>Loading...</p>}
        {universes.map((u) => (
          <Link key={u.slug} to={`/${u.slug}`} className="universe-card">
            <h3>{u.name}</h3>
            {u.description && <p>{u.description}</p>}
          </Link>
        ))}
      </section>
    </div>
  );
}
