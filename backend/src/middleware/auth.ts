import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "secret-key";

export interface AuthPayload {
  userId: string;
  username: string;
  role?: string;
  iat?: number;
  exp?: number;
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = req.headers["authorization"] || req.headers["Authorization" as any];
    if (!auth || Array.isArray(auth)) {
      return res.status(401).json({ ok: false, error: "Missing Authorization header" });
    }

    const [scheme, token] = auth.split(" ");
    if (!token || scheme.toLowerCase() !== "bearer") {
      return res.status(401).json({ ok: false, error: "Invalid Authorization format" });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    (req as any).user = decoded;
    return next();
  } catch (err: any) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as AuthPayload | undefined;
    if (!user) return res.status(401).json({ ok: false, error: "Unauthorized" });
    if (roles.length && !roles.includes(user.role ?? "")) {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }
    next();
  };
}
