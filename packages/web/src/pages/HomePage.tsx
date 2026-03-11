import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getUniverses } from "../api/client";
import { useTitle } from "../hooks/useTitle";

export function HomePage() {
  const [universes, setUniverses] = useState<any[]>([]);
  useTitle("");

  useEffect(() => {
    getUniverses().then(setUniverses);
  }, []);

  return (
    <div className="home-page">
      <section className="hero">
        <h1>Chronolore</h1>
        <p className="hero-tagline">The spoiler-safe wiki.</p>
        <p className="hero-sub">
          Set your reading progress. Browse safely. Only see what you've read.
        </p>
      </section>

      <section className="how-it-works">
        <h2>How It Works</h2>
        <div className="steps">
          <div className="step">
            <span className="step-icon">📖</span>
            <h3>Set Your Progress</h3>
            <p>
              Check off the books, chapters, or episodes you've completed.
              It takes seconds.
            </p>
          </div>
          <div className="step">
            <span className="step-icon">🔒</span>
            <h3>Browse Safely</h3>
            <p>
              Articles and content are filtered to your progress. No spoiler
              warnings — hidden content is simply absent.
            </p>
          </div>
          <div className="step">
            <span className="step-icon">✍️</span>
            <h3>Contribute</h3>
            <p>
              Tag every fact with when it's revealed. Help build the wiki
              that respects readers.
            </p>
          </div>
        </div>
      </section>

      <section className="universe-list">
        <h2>Explore Universes</h2>
        {universes.length === 0 && <p className="empty-state">Loading...</p>}
        <div className="universe-grid">
          {universes.map((u) => (
            <Link key={u.slug} to={`/${u.slug}`} className="universe-card">
              <h3>{u.name}</h3>
              {u.description && <p>{u.description}</p>}
              <span className="universe-cta">Browse →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="open-source">
        <h2>Open Source</h2>
        <p>
          Chronolore is open source under the MIT license. Content
          contributions are licensed under{" "}
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/"
            target="_blank"
            rel="noopener"
          >
            CC-BY-SA 4.0
          </a>
          .
        </p>
        <a
          href="https://github.com/LloydDeployed/chronolore"
          target="_blank"
          rel="noopener"
          className="btn-secondary"
        >
          View on GitHub
        </a>
      </section>
    </div>
  );
}
