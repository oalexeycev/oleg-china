/** Иероглифы CJK по одному символу (исключаем пробелы и латиницу на карточке). */
export function hanziChars(hanzi: string): string[] {
  return [...hanzi].filter((ch) => /\p{Script=Han}/u.test(ch));
}

function playAudioUrl(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error("Ошибка воспроизведения"));
    void audio.play().catch((err) => {
      reject(err instanceof Error ? err : new Error(String(err)));
    });
  });
}

/**
 * Запрашивает TTS у `/api/tts` по одному иероглифу и воспроизводит подряд.
 */
export async function speakHanziSequentially(
  hanzi: string,
  onError: (message: string) => void,
): Promise<void> {
  const chars = hanziChars(hanzi);
  if (chars.length === 0) {
    onError("На карточке нет иероглифов для озвучки");
    return;
  }

  const base = new URL("/api/tts", window.location.origin).toString();

  for (const ch of chars) {
    const res = await fetch(base, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-App-Origin": window.location.origin,
      },
      body: JSON.stringify({ text: ch }),
    });

    if (!res.ok) {
      let message = res.statusText;
      try {
        const data = (await res.json()) as { error?: string };
        if (data.error) message = data.error;
      } catch {
        try {
          message = await res.text();
        } catch {
          /* keep statusText */
        }
      }
      onError(message);
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    try {
      await playAudioUrl(url);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
