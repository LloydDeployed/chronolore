import { Router, type Request, type Response } from "express";
import bcrypt from "bcrypt";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { createToken, requireAuth, type AuthRequest } from "../middleware/auth.js";

const router: Router = Router();

// POST /api/auth/register
router.post("/register", async (req: Request, res: Response) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "username, email, and password required" });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  // Check for existing user
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.username, username));
  if (existingUser) {
    return res.status(409).json({ error: "Username already taken" });
  }

  const [existingEmail] = await db
    .select()
    .from(users)
    .where(eq(users.email, email));
  if (existingEmail) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [user] = await db
    .insert(users)
    .values({
      username,
      email,
      passwordHash,
      role: "contributor",
    })
    .returning();

  const token = createToken(user.id, user.role);

  res.status(201).json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
  });
});

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email and password required" });
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email));

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = createToken(user.id, user.role);

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
  });
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, req.userId!));

  if (!user) return res.status(404).json({ error: "User not found" });

  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  });
});

export default router;
