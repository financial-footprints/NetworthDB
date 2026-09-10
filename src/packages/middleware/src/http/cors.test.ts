import { describe, expect, test } from "bun:test";
import { cors } from "@middleware/http/cors";
import { Hono } from "hono";

function createApp(options: Parameters<typeof cors>[0] = {}) {
  const app = new Hono();
  app.use("*", cors(options));
  app.get("/ping", (c) => c.json({ ok: true }));
  return app;
}

async function originHeader(app: Hono, origin: string): Promise<string | null> {
  const res = await app.request("/ping", { headers: { Origin: origin } });
  return res.headers.get("Access-Control-Allow-Origin");
}

describe("cors", () => {
  test("allows an exact listed origin", async () => {
    const app = createApp({ allowedOrigins: ["https://app.example.com"] });

    expect(await originHeader(app, "https://app.example.com")).toBe("https://app.example.com");
  });

  test("rejects a different scheme or port for a listed origin", async () => {
    const app = createApp({ allowedOrigins: ["https://app.example.com"] });

    expect(await originHeader(app, "http://app.example.com")).toBeNull();
    expect(await originHeader(app, "https://app.example.com:8443")).toBeNull();
  });

  test("allows http localhost loopback with any port when allowLocalhost is set", async () => {
    const app = createApp({ allowLocalhost: true });

    expect(await originHeader(app, "http://localhost:4000")).toBe("http://localhost:4000");
    expect(await originHeader(app, "http://127.0.0.1:3000")).toBe("http://127.0.0.1:3000");
  });

  test("does not allow localhost when allowLocalhost is unset", async () => {
    const app = createApp({ allowedOrigins: ["https://app.example.com"] });

    expect(await originHeader(app, "http://localhost:4000")).toBeNull();
  });
});
