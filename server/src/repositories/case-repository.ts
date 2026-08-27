import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { incidentCaseSchema, type IncidentCase } from "../../../shared/incident-schema.js";

export class CaseRepository {
  public constructor(private readonly dataPath: string) {}

  public async create(caseData: IncidentCase): Promise<IncidentCase> {
    const cases = await this.readAll();
    cases.push(caseData);
    await this.writeAll(cases);
    return caseData;
  }

  public async findById(id: string): Promise<IncidentCase | null> {
    const cases = await this.readAll();
    return cases.find((item) => item.id === id) ?? null;
  }

  public async findByReference(reference: string): Promise<IncidentCase | null> {
    const cases = await this.readAll();
    return cases.find((item) => item.mockSubmission?.reference === reference) ?? null;
  }

  public async countSubmitted(): Promise<number> {
    return (await this.readAll()).filter((item) => item.mockSubmission !== null).length;
  }

  public async findByUserId(userId: string): Promise<IncidentCase[]> {
    return (await this.readAll()).filter((item) => item.userId === userId);
  }

  public async findByClaimTokenHash(claimTokenHash: string): Promise<IncidentCase | null> {
    return (await this.readAll()).find((item) => item.claimTokenHash === claimTokenHash) ?? null;
  }

  public async update(id: string, update: (caseData: IncidentCase) => IncidentCase): Promise<IncidentCase | null> {
    const cases = await this.readAll();
    const index = cases.findIndex((item) => item.id === id);
    if (index === -1) return null;

    const updated = incidentCaseSchema.parse(update(cases[index]));
    cases[index] = updated;
    await this.writeAll(cases);
    return updated;
  }

  private async readAll(): Promise<IncidentCase[]> {
    try {
      const raw = await readFile(this.dataPath, "utf8");
      return incidentCaseSchema.array().parse(JSON.parse(raw));
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  private async writeAll(cases: IncidentCase[]): Promise<void> {
    await mkdir(dirname(this.dataPath), { recursive: true });
    const temporaryPath = `${this.dataPath}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(cases, null, 2), "utf8");
    await rename(temporaryPath, this.dataPath);
  }
}
