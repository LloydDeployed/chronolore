import express from "express";
import cors from "cors";
import universesRouter from "./routes/universes.js";
import articlesRouter from "./routes/articles.js";
import searchRouter from "./routes/search.js";

const app = express();
const port = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/universes", universesRouter);
app.use("/api/universes/:universeSlug/articles", articlesRouter);
app.use("/api/universes/:universeSlug/search", searchRouter);

app.listen(port, () => {
  console.log(`Chronolore API listening on port ${port}`);
});
