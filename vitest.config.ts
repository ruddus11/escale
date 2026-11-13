import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        test: {
          name: "client",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
          setupFiles: ["./src/test/setup.ts"],
        },
      },
      {
        test: {
          name: "server",
          environment: "node",
          include: ["server/**/*.test.ts", "api/**/*.test.ts"],
        },
      },
    ],
  },
});
