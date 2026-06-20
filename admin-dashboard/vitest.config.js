import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { mkdirSync } from "node:fs";
import { resolve as pathResolve } from "node:path";

// Ensure coverage/.tmp exists before Vitest UI coverage writes temp files
const ensureCoveragePlugin = {
  name: "ensure-coverage-dirs",
  enforce: "pre",
  config() {
    try {
      const base = pathResolve(process.cwd(), "coverage");
      const tmp = pathResolve(base, ".tmp");
      mkdirSync(tmp, { recursive: true });
    } catch {
      // ignore
    }
  },
};

const jestCompatTransform = {
  name: "jest-to-vi-transform",
  enforce: "pre",
  transform(code, id) {
    if (!/\/(?:__tests__|tests)\/.*\.(t|j)sx?$/.test(id)) return null;
    let out = code;

    // 1) Rewrite jest.* -> vi.*
    out = out.replace(/\bjest\./g, "vi.");

    // 2) Hoist vi.mock factories to top-level via vi.hoisted, not inside vi.mock
    const hoisted = [];
    const hoistFactory = (_m, mod, factory) => {
      const name = `__vi_mock_factory_${hoisted.length + 1}`;
      hoisted.push(`const ${name} = vi.hoisted(() => ${factory});`);
      return `vi.mock(${mod}, ${name})`;
    };

    // Arrow factory with block body: () => { ... }
    out = out.replace(
      /vi\.mock\(\s*(['"][^'"]+['"])\s*,\s*(\(\s*\)\s*=>\s*\{[\s\S]*?\})\s*\)/g,
      hoistFactory,
    );
    // Arrow factory returning object: () => ({ ... })
    out = out.replace(
      /vi\.mock\(\s*(['"][^'"]+['"])\s*,\s*(\(\s*\)\s*=>\s*\(\s*\{[\s\S]*?\}\s*\))\s*\)/g,
      hoistFactory,
    );
    // Function-expression factory: function() { ... }
    out = out.replace(
      /vi\.mock\(\s*(['"][^'"]+['"])\s*,\s*((?:async\s*)?function\s*\(\s*\)\s*\{[\s\S]*?\})\s*\)/g,
      hoistFactory,
    );

    // 3) Append .jsx for extensionless imports/requires from ../../components/* or ../../pages/*
    out = out.replace(
      /(from\s+['"])((?:\.\.\/)+(?:components|pages)\/[^'".]+)(['"])/g,
      (_m, a, p, z) => `${a}${p}.jsx${z}`,
    );
    out = out.replace(
      /(require\(\s*['"])((?:\.\.\/)+(?:components|pages)\/[^'".]+)(['"]\s*\))/g,
      (_m, a, p, z) => `${a}${p}.jsx${z}`,
    );

    if (hoisted.length) {
      out = `${hoisted.join("\n")}\n${out}`;
    }

    return out === code ? null : { code: out, map: null };
  },
};

export default defineConfig({
  plugins: [ensureCoveragePlugin, jestCompatTransform, react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.js"],
    include: [
      "__tests__/**/*.{test,spec}.{js,jsx,ts,tsx}",
      "tests/**/*.{test,spec}.{js,jsx,ts,tsx}",
    ],
    globals: true,
    css: false,
    environmentOptions: {
      jsdom: {
        url: "http://localhost/",
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      // Explicit temp dir and keep it between reruns to avoid ENOENT races in UI mode
      tempDir: "./coverage/.tmp",
      cleanOnRerun: false,
      reportOnFailure: true,
      all: true,
      include: [
        "components/**/*.{js,jsx,ts,tsx}",
        "pages/**/*.{js,jsx,ts,tsx}",
      ],
      exclude: [
        "**/*.{test,spec}.{js,jsx,ts,tsx}",
        "tests/**/*",
        "__tests__/**/*",
        "vitest.setup.{js,ts}",
        "vite.config.{js,ts}",
        "vitest.config.{js,ts}",
        "node_modules/**",
        "dist/**",
        "coverage/**",
      ],
    },
  },
});
