import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { safeUserSchema, type SafeUser, type User } from "../../../shared/incident-schema.js";
import type { UserRepository } from "../repositories/user-repository.js";

export class AuthError extends Error {
  public constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "AuthError";
  }
}

export class AuthService {
  public constructor(private readonly users: UserRepository, private readonly jwtSecret: string) {}

  public async register(name: string, email: string, password: string): Promise<{ user: SafeUser; token: string }> {
    if (await this.users.findByEmail(email)) throw new AuthError("An account with this email already exists.", 409);
    const user: User = { id: randomUUID(), name, email: email.toLowerCase(), passwordHash: await bcrypt.hash(password, 12), createdAt: new Date().toISOString() };
    await this.users.create(user);
    return { user: safeUserSchema.parse(user), token: this.sign(user.id) };
  }

  public async login(email: string, password: string): Promise<{ user: SafeUser; token: string }> {
    const user = await this.users.findByEmail(email);
    if (!user || !await bcrypt.compare(password, user.passwordHash)) throw new AuthError("Invalid email or password.", 401);
    return { user: safeUserSchema.parse(user), token: this.sign(user.id) };
  }

  public async currentUser(userId: string): Promise<SafeUser | null> {
    const user = await this.users.findById(userId);
    return user ? safeUserSchema.parse(user) : null;
  }

  public verifyToken(token: string): string | null {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as { sub?: string };
      return payload.sub ?? null;
    } catch {
      return null;
    }
  }

  private sign(userId: string): string {
    return jwt.sign({}, this.jwtSecret, { subject: userId, expiresIn: "1d" });
  }
}
