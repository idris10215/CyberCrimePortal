import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../../server/src/app.js";

const directories: string[] = [];
async function app() { const dir = await mkdtemp(join(tmpdir(), "ncrp-demo-")); directories.push(dir); return createApp(join(dir, "cases.json")); }
afterEach(async () => { await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });

describe("deterministic complaint demonstration", () => {
  it("registers, stores only a password hash, logs in, reads the session, and logs out", async () => {
    const server = await app(); const citizen = request.agent(server);
    const registered = await citizen.post("/api/auth/register").send({ name: "Demo Citizen", email: "demo@example.test", password: "password123" }).expect(201);
    expect(registered.body.user).toMatchObject({ name: "Demo Citizen", email: "demo@example.test" });
    expect(registered.body.user.passwordHash).toBeUndefined();
    await citizen.post("/api/auth/register").send({ name: "Duplicate", email: "demo@example.test", password: "password123" }).expect(409);
    const users = JSON.parse(await readFile(join(directories[0], "users.json"), "utf8"));
    expect(users[0].passwordHash).not.toBe("password123");
    await citizen.get("/api/auth/me").expect(200).expect(({ body }) => expect(body.user.email).toBe("demo@example.test"));
    await citizen.post("/api/auth/logout").send({}).expect(200);
    await citizen.get("/api/auth/me").expect(401);
    await request(server).post("/api/auth/login").send({ email: "demo@example.test", password: "wrong-password" }).expect(401);
    await request(server).post("/api/auth/login").send({ email: "demo@example.test", password: "password123" }).expect(200).expect(({ body }) => expect(body.user.passwordHash).toBeUndefined());
  });

  it("protects My Complaints and isolates complaint ownership between users", async () => {
    const server = await app(); const userA = request.agent(server); const userB = request.agent(server);
    await request(server).get("/api/me/cases").expect(401);
    await userA.post("/api/auth/register").send({ name: "User A", email: "a@example.test", password: "password123" }).expect(201);
    await userB.post("/api/auth/register").send({ name: "User B", email: "b@example.test", password: "password123" }).expect(201);
    const created = await userA.post("/api/cases").send({}).expect(201);
    expect(created.body.userId).toBeTruthy();
    await userB.get("/api/me/cases").expect(200).expect(({ body }) => expect(body).toHaveLength(0));
    await userA.get("/api/me/cases").expect(200).expect(({ body }) => expect(body[0].id).toBe(created.body.id));
    await userB.post(`/api/cases/${created.body.id}/story`).send({ story: "I transferred 25000 through UPI to demo-fraud@upi on 26 August 2026." }).expect(404);
  });

  it("keeps guest complaints unowned, allows a one-time claim after login, and rejects bad claim tokens", async () => {
    const server = await app(); const guestCase = await request(server).post("/api/cases").send({}).expect(201);
    expect(guestCase.body.userId).toBeNull();
    await request(server).post(`/api/cases/${guestCase.body.id}/story`).send({ story: "I transferred 25000 through UPI using PhonePe to demo-fraud@upi on 26 August 2026. Transaction ID is DEMO12345." }).expect(200);
    await request(server).patch(`/api/cases/${guestCase.body.id}/incident`).send({}).expect(200);
    await request(server).patch(`/api/cases/${guestCase.body.id}/contact`).send({ fullName: "Guest Citizen", mobileNumber: "9999990000", email: null, otpVerified: true }).expect(200);
    const submitted = await request(server).post(`/api/cases/${guestCase.body.id}/mock-submit`).send({}).expect(200);
    expect(submitted.body.userId).toBeNull();
    expect(submitted.body.claimToken).toMatch(/^[a-f0-9]{64}$/);
    const citizen = request.agent(server);
    await citizen.post("/api/auth/register").send({ name: "Claim Citizen", email: "claim@example.test", password: "password123" }).expect(201);
    await citizen.post("/api/me/cases/claim").send({ claimToken: "not-a-real-token" }).expect(400);
    await citizen.post("/api/me/cases/claim").send({ claimToken: submitted.body.claimToken }).expect(200).expect(({ body }) => expect(body.userId).toBeTruthy());
    await citizen.post("/api/me/cases/claim").send({ claimToken: submitted.body.claimToken }).expect(400);
    await citizen.get("/api/me/cases").expect(200).expect(({ body }) => expect(body[0].id).toBe(guestCase.body.id));
  });

  it("completes verification, optional evidence, contact, submission, and tracking", async () => {
    const server = await app(); const created = await request(server).post("/api/cases").send({}).expect(201);
    const story = await request(server).post(`/api/cases/${created.body.id}/story`).send({ story: "I transferred 25000 through UPI to demo-fraud@upi on 26 August 2026. Transaction ID is DEMO12345." }).expect(200);
    expect(story.body.incident).toMatchObject({ amountLost: 25000, incidentDate: "2026-08-26", recipientUpiId: "demo-fraud@upi", transactionId: "DEMO12345", paymentApp: null });
    const verified = await request(server).patch(`/api/cases/${created.body.id}/incident`).send({ paymentApp: "DemoPay" }).expect(200);
    expect(verified.body.verifiedFields).toContain("paymentApp");
    const evidence = await request(server).post(`/api/cases/${created.body.id}/evidence`).send({ filename: "demo.pdf", mimeType: "application/pdf", base64: "JVBERi0xLjQ=" }).expect(200);
    expect(evidence.body.evidence[0]).toMatchObject({ filename: "demo.pdf", size: 8 });
    await request(server).delete(`/api/cases/${created.body.id}/evidence/${evidence.body.evidence[0].id}`).expect(200);
    await request(server).patch(`/api/cases/${created.body.id}/contact`).send({ fullName: "Demo Citizen", mobileNumber: "9999990000", email: null, otpVerified: true }).expect(200);
    const submission = await request(server).post(`/api/cases/${created.body.id}/mock-submit`).send({}).expect(200);
    expect(submission.body.mockSubmission.reference).toMatch(/^NCRP-DEMO-\d{4}-\d{6}$/);
    const tracked = await request(server).get(`/api/track/${submission.body.mockSubmission.reference}`).expect(200);
    expect(tracked.body.status).toBe("Complaint Submitted");
    await request(server).get("/api/track/NCRP-DEMO-2026-999999").expect(404);
  });

  it("accepts the verified Step 2 incident values extracted from the citizen story", async () => {
    const server = await app(); const created = await request(server).post("/api/cases").send({}).expect(201);
    const story = await request(server).post(`/api/cases/${created.body.id}/story`).send({ story: "Someone called pretending to be from my bank and said my KYC was expiring. They asked me to transfer ₹25,000 through UPI using PhonePe. I transferred the money to demo-fraud@upi on 26 August 2026. The transaction ID was TXN123456789." }).expect(200);
    expect(story.body.incident).toMatchObject({ amountLost: 25000, paymentApp: "PhonePe", recipientUpiId: "demo-fraud@upi", incidentDate: "2026-08-26", transactionId: "TXN123456789" });
    const { fraudType: _fraudType, currency: _currency, ...updates } = story.body.incident;
    const verified = await request(server).patch(`/api/cases/${created.body.id}/incident`).send(updates).expect(200);
    expect(verified.body.incident).toMatchObject({ amountLost: 25000, paymentApp: "PhonePe", recipientUpiId: "demo-fraud@upi", incidentDate: "2026-08-26", transactionId: "TXN123456789" });
  });

  it("rejects invalid incident data without weakening Zod validation", async () => {
    const server = await app(); const created = await request(server).post("/api/cases").send({}).expect(201);
    await request(server).patch(`/api/cases/${created.body.id}/incident`).send({ amountLost: -25000 }).expect(400).expect(({ body }) => expect(body.error).toBe("Please check the information entered and try again."));
  });

  it("checks synthetic suspect data and saves a suspect report", async () => {
    const server = await app();
    await request(server).get("/api/suspects/check?identifier=demo-fraud%40upi").expect(200).expect(({ body }) => expect(body.found).toBe(true));
    await request(server).post("/api/suspects").send({ type: "UPI ID", identifier: "demo-fraud@upi", description: "Synthetic demo report" }).expect(201).expect(({ body }) => expect(body.reference).toMatch(/^SUSPECT-DEMO-\d{6}$/));
  });
});
