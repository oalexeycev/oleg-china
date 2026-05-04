/** Модель и голос — как в примере OpenRouter для Gemini 3.1 Flash TTS. */
export const OPENROUTER_TTS_MODEL = "google/gemini-3.1-flash-tts-preview";
const TTS_VOICE = "alloy";
/** PCM 16-bit mono, 24 kHz — как в описании модели. */
const PCM_SAMPLE_RATE = 24_000;

/** Оборачивает сырой PCM в WAV (16-bit LE mono) для воспроизведения в браузере. */
export function wrapPcm16LeMonoToWav(pcm: ArrayBuffer, sampleRate: number): ArrayBuffer {
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

export async function fetchTtsPcmAsWav(
  apiKey: string,
  input: string,
  referer?: string,
): Promise<ArrayBuffer> {
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
