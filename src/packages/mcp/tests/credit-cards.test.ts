import { describe, expect, it } from "bun:test";
import type { FetchImpl } from "@mcp/api/client";
import { SessionStore } from "@mcp/auth/session-store";
import { createCreditCardTools } from "@mcp/tools/credit-cards";
import { API } from "@ndb/platform";
import { requireNamed } from "@tests/mcp/require-named";

const API_ORIGIN = "http://127.0.0.1:8000";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function authenticatedSession(fetchImpl: FetchImpl) {
  const session = new SessionStore({
    apiOrigin: API_ORIGIN,
    fetchImpl,
  });
  await session.login({ username: "usher", password: "x" });
  return session;
}

describe("credit card MCP tools", () => {
  it("credit_cards_catalog_list calls GET catalog with optional tag", async () => {
    const requests: string[] = [];
    const session = await authenticatedSession(async (url, init) => {
      requests.push(url);
      if (url.endsWith(API.auth.session.login) && init?.method === "POST") {
        return jsonResponse(200, {
          data: { sessionToken: "t", refreshToken: "r", expiresIn: 3600 },
        });
      }
      if (url.endsWith(API.users.me.get)) {
        return jsonResponse(200, {
          data: { id: "u1", username: "usher", role: "user", multifactorEnabled: false },
        });
      }
      if (url.includes(API.creditCards.catalog.list)) {
        return jsonResponse(200, { items: [], total: 0 });
      }
      throw new Error(`unexpected ${url}`);
    });

    const tools = createCreditCardTools(session);
    const list = requireNamed(tools, "credit_cards_catalog_list");
    await list.handler({ tag: "rewards" });
    expect(requests.some((url) => url.includes("tag=rewards"))).toBe(true);
  });

  it("credit_cards_catalog_get calls GET catalog by bank and variant", async () => {
    let catalogUrl = "";
    const session = await authenticatedSession(async (url, init) => {
      if (url.endsWith(API.auth.session.login) && init?.method === "POST") {
        return jsonResponse(200, {
          data: { sessionToken: "t", refreshToken: "r", expiresIn: 3600 },
        });
      }
      if (url.endsWith(API.users.me.get)) {
        return jsonResponse(200, {
          data: { id: "u1", username: "usher", role: "user", multifactorEnabled: false },
        });
      }
      if (url.includes("/credit-cards/catalog/idfc/wow")) {
        catalogUrl = url;
        return jsonResponse(200, { data: { registry_key: "idfc/wow" } });
      }
      throw new Error(`unexpected ${url}`);
    });

    const tools = createCreditCardTools(session);
    const get = requireNamed(tools, "credit_cards_catalog_get");
    const result = await get.handler({ bank: "idfc", variant: "wow" });
    expect(catalogUrl).toContain("/credit-cards/catalog/idfc/wow");
    expect(result).toEqual({ registry_key: "idfc/wow" });
  });

  it("credit_cards_catalog_bulk calls GET catalog bulk", async () => {
    let bulkUrl = "";
    const session = await authenticatedSession(async (url, init) => {
      if (url.endsWith(API.auth.session.login) && init?.method === "POST") {
        return jsonResponse(200, {
          data: { sessionToken: "t", refreshToken: "r", expiresIn: 3600 },
        });
      }
      if (url.endsWith(API.users.me.get)) {
        return jsonResponse(200, {
          data: { id: "u1", username: "usher", role: "user", multifactorEnabled: false },
        });
      }
      if (url.endsWith(API.creditCards.catalog.bulk)) {
        bulkUrl = url;
        return jsonResponse(200, { data: { catalogs: [] } });
      }
      throw new Error(`unexpected ${url}`);
    });

    const tools = createCreditCardTools(session);
    const bulk = requireNamed(tools, "credit_cards_catalog_bulk");
    await bulk.handler({});
    expect(bulkUrl).toContain(API.creditCards.catalog.bulk);
  });

  it("credit_cards_benefits_get calls GET benefits by slotId", async () => {
    let benefitsUrl = "";
    const session = await authenticatedSession(async (url, init) => {
      if (url.endsWith(API.auth.session.login) && init?.method === "POST") {
        return jsonResponse(200, {
          data: { sessionToken: "t", refreshToken: "r", expiresIn: 3600 },
        });
      }
      if (url.endsWith(API.users.me.get)) {
        return jsonResponse(200, {
          data: { id: "u1", username: "usher", role: "user", multifactorEnabled: false },
        });
      }
      if (url.includes("/credit-cards/benefits/lounge.domestic")) {
        benefitsUrl = url;
        return jsonResponse(200, { data: { slot_id: "lounge.domestic", items: [] } });
      }
      throw new Error(`unexpected ${url}`);
    });

    const tools = createCreditCardTools(session);
    const benefits = requireNamed(tools, "credit_cards_benefits_get");
    const result = await benefits.handler({ slotId: "lounge.domestic" });
    expect(benefitsUrl).toContain("lounge.domestic");
    expect(result).toEqual({ slot_id: "lounge.domestic", items: [] });
  });
});
