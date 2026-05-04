import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Вся логика TTS в одном файле: на Vercel serverless второй модуль из `api/lib/`
 * часто не попадает в лямбду / разрешается как `/var/task/lib/...`.
 * Дубликат для `npm run dev` — в `vite.config.ts`.
 */
const OPENROUTER_TTS_MODEL = "google/gemini-3.1-flash-tts-preview";
const TTS_VOICE = "alloy";
const PCM_SAMPLE_RATE = 24_000;

/** Снимает кавычки/BOM/Bearer — иначе OpenRouter отвечает 401 «Missing Authentication header». */
function stripMatchingQuotes(k: string): string {
  if (k.length < 2) return k;
  const open = k[0]!;
  const close = k[k.length - 1]!;
  const pairs: Record<string, string> = {
    '"': '"',
    "'": "'",
    "\u201c": "\u201d",
    "\u2018": "\u2019",
  };
  if (pairs[open] === close) {
    return k.slice(1, -1).trim();
  }
  return k;
}

function normalizeOpenRouterApiKey(raw: string | undefined): string {
  let k = String(raw ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/[\r\n]+/g, "");
  k = stripMatchingQuotes(k);
  if (k.toLowerCase().startsWith("bearer ")) {
    k = k.slice(7).trim();
    k = stripMatchingQuotes(k);
  }
  return k.trim();
}

const OPENROUTER_KEY_RE = /^sk-or-v1-[A-Za-z0-9_-]{32,}$/;

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
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${apiKey}`);
  headers.set("Content-Type", "application/json");
  headers.set("X-OpenRouter-Title", "oleg-china");
  if (referer) {
    headers.set("HTTP-Referer", referer);
  } else if (process.env.VERCEL_URL) {
    headers.set("HTTP-Referer", `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}`);
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
    let hint = err || `OpenRouter TTS ${res.status}`;
    if (res.status === 401 && err.includes("Missing Authentication header")) {
      hint +=
        " — часто в Vercel в значение попали кавычки \"…\" или префикс Bearer; должно быть только sk-or-v1-… без обёртки. Проверь Production и Preview, сделай Redeploy.";
    }
    throw new Error(hint);
  }

  const pcm = await res.arrayBuffer();
  if (pcm.byteLength < 2) {
    throw new Error("Пустой ответ аудио");
  }

  return wrapPcm16LeMonoToWav(pcm, PCM_SAMPLE_RATE);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = normalizeOpenRouterApiKey(
    process.env["OPENROUTER_API_KEY"] ?? process.env["OPENROUTER_KEY"],
  );
  if (!apiKey) {
    res.status(500).json({
      error:
        "OPENROUTER_API_KEY пустой или только пробелы. В Vercel → Environment Variables вставь только ключ (sk-or-v1-…), без слова Bearer и без кавычек вокруг. Нужен redeploy; для Preview отдельно включи переменную.",
    });
    return;
  }
  if (!OPENROUTER_KEY_RE.test(apiKey)) {
    res.status(500).json({
      error:
        "OPENROUTER_API_KEY не похож на ключ OpenRouter (ожидается sk-or-v1- и длинная строка). Убери кавычки в UI Vercel, лишние пробелы; значение — одна строка только с ключом.",
    });
    return;
  }

  const textRaw = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!textRaw) {
    res.status(400).json({ error: "Нужно поле text (строка)" });
    return;
  }
  if (textRaw.length > 200) {
    res.status(400).json({ error: "Слишком длинный text" });
    return;
  }

  const refererHeader = req.headers["x-app-origin"];
  const referer = typeof refererHeader === "string" ? refererHeader : undefined;

  try {
    const wav = await fetchTtsPcmAsWav(apiKey, textRaw, referer);
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(Buffer.from(wav));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(502).json({ error: message });
  }
}
