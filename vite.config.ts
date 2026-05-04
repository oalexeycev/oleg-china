import { defineConfig } from "vite";

export default defineConfig({
  // Явно для продакшена: относительные пути ассетов (удобно и на Vercel под любым путём)
  base: "./",
});
