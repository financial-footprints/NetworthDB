import { describe, expect, test } from "bun:test";
import { API, apiPath } from "@ndb/platform";
import { readApiJson } from "@tests/api/helpers/api-response";
import { loginViaApp } from "@tests/api/helpers/auth-services";
import { createTestApp } from "@tests/api/helpers/create-test-app";

describe("credit card catalog routes", () => {
  test("requires session for catalog list", async () => {
    const { app } = await createTestApp({ seedUser: false });
    const response = await app.request(API.creditCards.catalog.list);
    expect(response.status).toBe(401);
  });

  test("lists catalogs and returns idfc/wow details", async () => {
    const { app } = await createTestApp({ username: "ccapi", password: "password123" });
    const token = await loginViaApp(app, "ccapi", "password123");

    const list = await app.request(API.creditCards.catalog.list, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(list.status).toBe(200);
    const listed = await readApiJson<{ items: Array<{ registry_key: string }>; total: number }>(
      list
    );
    expect(listed.items.length).toBeGreaterThan(20);
    expect(listed.total).toBe(listed.items.length);
    expect(listed.items.some((row) => row.registry_key === "idfc/wow")).toBe(true);

    const details = await app.request(
      apiPath(API.creditCards.catalog.get, { bank: "idfc", variant: "wow" }),
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(details.status).toBe(200);
    const body = await readApiJson<{ data: { registry_key: string; display_name: string } }>(
      details
    );
    expect(body.data.registry_key).toBe("idfc/wow");
    expect(body.data.display_name.length).toBeGreaterThan(0);
  });

  test("bulk returns full catalogs", async () => {
    const { app } = await createTestApp({ username: "ccbulk", password: "password123" });
    const token = await loginViaApp(app, "ccbulk", "password123");

    const response = await app.request(API.creditCards.catalog.bulk, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(200);
    const body = await readApiJson<{
      data: { items: Array<{ registry_key: string; fees: { annual: { status: string } } }> };
    }>(response);
    expect(body.data.items.length).toBeGreaterThan(20);
    const wow = body.data.items.find((row) => row.registry_key === "idfc/wow");
    expect(wow?.fees.annual.status).toBeDefined();
  });

  test("returns 404 for unknown bank variant", async () => {
    const { app } = await createTestApp({ username: "cc404", password: "password123" });
    const token = await loginViaApp(app, "cc404", "password123");

    const response = await app.request(
      apiPath(API.creditCards.catalog.get, { bank: "missing", variant: "card" }),
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(response.status).toBe(404);
  });

  test("returns benefit-first view for lounge.domestic", async () => {
    const { app } = await createTestApp({ username: "ccslot", password: "password123" });
    const token = await loginViaApp(app, "ccslot", "password123");

    const response = await app.request(
      apiPath(API.creditCards.benefits.get, { slotId: "lounge.domestic" }),
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(response.status).toBe(200);
    const body = await readApiJson<{
      data: { slot_id: string; items: Array<{ registry_key: string; status: string }> };
    }>(response);
    expect(body.data.slot_id).toBe("lounge.domestic");
    expect(body.data.items.length).toBeGreaterThan(20);
    expect(body.data.items.every((row) => row.registry_key.includes("/"))).toBe(true);
  });

  test("returns 404 for unknown benefit slot", async () => {
    const { app } = await createTestApp({ username: "ccslot404", password: "password123" });
    const token = await loginViaApp(app, "ccslot404", "password123");

    const response = await app.request(
      apiPath(API.creditCards.benefits.get, { slotId: "fees.not_a_slot" }),
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(response.status).toBe(404);
  });
});
