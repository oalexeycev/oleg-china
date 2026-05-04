import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchTtsPcmAsWav } from "../lib/openrouterTts";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "На сервере не задан OPENROUTER_API_KEY (Vercel → Settings → Environment Variables)" });
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
