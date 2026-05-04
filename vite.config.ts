import { defineConfig, loadEnv, type Plugin } from "vite";

/** Дубликат логики из `api/tts.ts` — только для `vite dev` (см. комментарий там). */
const OPENROUTER_TTS_MODEL = "google/gemini-3.1-flash-tts-preview";
const TTS_VOICE = "alloy";
const PCM_SAMPLE_RATE = 24_000;

function wrapPcm16LeMonoToWav(pcm: ArrayBuffer, sampleRate: number): ArrayBuffer {
  const data = new Uint8Array(pcm);
  const out = new Uint8Array(44 + data.length);
  const v = new DataView(out.buffer);
  let o = 0;
  const w4 = (n: number) => {
    v.setUint32(o, n, true);
    o += 4;
  };
  const w2 = (n: number) => {
    v.setUint16(o, n, true);
    o += 2;
  };
  const wStr = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      v.setUint8(o++, s.charCodeAt(i));
    }
  };
  wStr("RIFF");
  w4(36 + data.length);
  wStr("WAVE");
  wStr("fmt ");
  w4(16);
  w2(1);
  w2(1);
  w4(sampleRate);
  w4(sampleRate * 2);
  w2(2);
  w2(16);
  wStr("data");
  w4(data.length);
  out.set(data, 44);
  return out.buffer;
}

async function fetchTtsPcmAsWav(apiKey: string, input: string, referer?: string): Promise<ArrayBuffer> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "X-Title": "oleg-china",
  };
  if (referer) {
    headers["HTTP-Referer"] = referer;
  }

  const res = await fetch("https://openrouter.ai/api/v1/tts", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: OPENROUTER_TTS_MODEL,
      input,
      voice: TTS_VOICE,
      response_format: "pcm",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `OpenRouter TTS ${res.status}`);
  }

  const pcm = await res.arrayBuffer();
  if (pcm.byteLength < 2) {
    throw new Error("Пустой ответ аудио");
  }

  return wrapPcm16LeMonoToWav(pcm, PCM_SAMPLE_RATE);
}

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
