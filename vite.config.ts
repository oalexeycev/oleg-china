import { defineConfig, loadEnv, type Plugin } from "vite";
import { fetchTtsPcmAsWav } from "./lib/openrouterTts";

function ttsDevApi(env: Record<string, string>): Plugin {
  return {
    name: "tts-dev-api",
    configureServer(server) {
      server.middlewares.use("/api/tts", (req, res, next) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method Not Allowed");
          return;
        }

        const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => chunks.push(c));
        req.on("end", () => {
          void (async () => {
            const key = env.OPENROUTER_API_KEY;
            if (!key) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              res.end(
                JSON.stringify({
                  error:
                    "Для озвучки локально создай файл .env с OPENROUTER_API_KEY=... или запусти vercel dev",
                }),
              );
              return;
            }

            try {
              const raw = Buffer.concat(chunks).toString("utf8");
              const body = JSON.parse(raw) as { text?: string };
              const text = typeof body.text === "string" ? body.text.trim() : "";
              if (!text) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(JSON.stringify({ error: "Нужно поле text" }));
                return;
              }
              const ref = req.headers["x-app-origin"];
              const referer = typeof ref === "string" ? ref : undefined;
              const wav = await fetchTtsPcmAsWav(key, text, referer);
              res.statusCode = 200;
              res.setHeader("Content-Type", "audio/wav");
              res.end(Buffer.from(wav));
            } catch (e) {
              res.statusCode = 502;
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
            }
          })().catch((err: unknown) => next(err instanceof Error ? err : new Error(String(err))));
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    base: "./",
    plugins: [ttsDevApi(env)],
  };
});
