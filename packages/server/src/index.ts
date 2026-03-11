import { join, resolve } from 'path';
import { existsSync } from 'fs';
import express from 'express';
import cors from 'cors';
import universesRouter from './routes/universes.js';
import articlesRouter from './routes/articles.js';
import searchRouter from './routes/search.js';
import authRouter from './routes/auth.js';
import contributeRouter from './routes/contribute.js';
import moderateRouter from './routes/moderate.js';

const app = express();
const port = process.env.PORT ?? 4001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/universes', universesRouter);
app.use('/api/universes/:universeSlug/articles', articlesRouter);
app.use('/api/universes/:universeSlug/search', searchRouter);
app.use('/api/auth', authRouter);
app.use('/api/universes/:universeSlug/contribute', contributeRouter);
app.use('/api/universes/:universeSlug/moderate', moderateRouter);

// Serve static frontend in production
if (process.env.NODE_ENV === 'production') {
  // Try common locations for the web dist
  const candidates = [
    resolve('packages/web/dist'),          // running from repo root
    resolve('../web/dist'),                // running from packages/server
    resolve('../../packages/web/dist'),    // running from packages/server/dist
  ];
  const webDist = candidates.find(p => existsSync(join(p, 'index.html')));

  if (webDist) {
    app.use(express.static(webDist));
    app.get('{*path}', (_req, res) => {
      res.sendFile(join(webDist, 'index.html'));
    });
    console.log(`Serving static files from ${webDist}`);
  } else {
    console.warn('Warning: Could not find web/dist for static serving');
  }
}

app.listen(port, () => {
  console.log(`Chronolore API listening on port ${port}`);
});
