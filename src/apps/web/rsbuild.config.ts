import path from "node:path";
import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { pluginTailwindcss } from "@rsbuild/plugin-tailwindcss";

// Docs: https://rsbuild.rs/config/
export default defineConfig({
  source: {
    alias: {
      "@web": path.join(import.meta.dirname, "src"),
      "@core": path.join(import.meta.dirname, "../../packages/core/src"),
    },
  },
  html: {
    title: "NetworthDB",
    favicon: "./src/assets/images/logo/favicon.ico",
    tags: [
      {
        tag: "link",
        attrs: {
          rel: "icon",
          type: "image/png",
          sizes: "32x32",
          href: "/favicon-32x32.png",
        },
      },
      {
        tag: "link",
        attrs: {
          rel: "apple-touch-icon",
          sizes: "180x180",
          href: "/apple-touch-icon.png",
        },
      },
      {
        tag: "link",
        attrs: { rel: "manifest", href: "/manifest.webmanifest" },
      },
    ],
  },
  output: {
    copy: [
      {
        from: "./src/assets/images/logo",
        to: "./",
        globOptions: {
          ignore: [
            "**/networthdb-no-bg.png",
            "**/networthdb-no-bg-small.png",
            "**/fiscal_institutions/**",
          ],
        },
      },
    ],
  },
  dev: {
    lazyCompilation: false,
  },
  server: {
    port: Number(process.env.PORT) || 3000,
    proxy: {
      "/api": { target: "http://127.0.0.1:8000" },
      "/health": { target: "http://127.0.0.1:8000" },
    },
  },
  plugins: [
    pluginReact({
      reactCompiler: true,
    }),
    pluginTailwindcss(),
  ],
  tools: {
    rspack: {
      ignoreWarnings: [
        {
          module: /react-datepicker/,
          message: /Critical dependency: the request of a dependency is an expression/,
        },
      ],
    },
  },
});
