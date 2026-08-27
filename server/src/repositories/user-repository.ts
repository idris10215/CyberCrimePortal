import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { userSchema, type User } from "../../../shared/incident-schema.js";

export class UserRepository {
  public constructor(private readonly dataPath: string) {}

  public async create(user: User): Promise<User> {
    const users = await this.readAll();
    users.push(user);
    await this.writeAll(users);
    return user;
  }

  public async findByEmail(email: string): Promise<User | null> {
    const users = await this.readAll();
    return users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
  }

  public async findById(id: string): Promise<User | null> {
    const users = await this.readAll();
    return users.find((user) => user.id === id) ?? null;
  }

  private async readAll(): Promise<User[]> {
    try {
      const raw = await readFile(this.dataPath, "utf8");
      return userSchema.array().parse(JSON.parse(raw));
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  private async writeAll(users: User[]): Promise<void> {
    await mkdir(dirname(this.dataPath), { recursive: true });
    const temporaryPath = `${this.dataPath}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(users, null, 2), "utf8");
    await rename(temporaryPath, this.dataPath);
  }
}
