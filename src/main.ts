import "./style.css";
import { CARDS, type Card } from "./cards";

const root = document.querySelector("#app");
if (!(root instanceof HTMLDivElement)) {
  throw new Error("#app not found");
}
const app: HTMLDivElement = root;

let index = 0;
let revealed = false;

function current(): Card {
  return CARDS[index]!;
}

function render(): void {
  const card = current();

  app.replaceChildren();

  const main = document.createElement("main");
  main.className = "wrap";

  const header = document.createElement("header");
  header.className = "top";
  const title = document.createElement("h1");
  title.className = "title";
  title.textContent = "Карточки";
  const progress = document.createElement("p");
  progress.className = "progress";
  progress.textContent = `${index + 1} / ${CARDS.length}`;
  header.append(title, progress);

  const cardBtn = document.createElement("button");
  cardBtn.type = "button";
  cardBtn.className = "card";
  cardBtn.setAttribute("aria-expanded", revealed ? "true" : "false");

  const hanzi = document.createElement("div");
  hanzi.className = "hanzi";
  hanzi.lang = "zh-Hans";
  hanzi.textContent = card.hanzi;

  const meta = document.createElement("div");
  meta.className = "meta";

  if (revealed) {
    const pinyin = document.createElement("p");
    pinyin.className = "pinyin";
    pinyin.textContent = card.pinyin;
    const ru = document.createElement("p");
    ru.className = "meaning";
    ru.textContent = card.ru;
    meta.append(pinyin, ru);
  } else {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "Нажми, чтобы показать пиньинь и перевод";
    meta.append(hint);
  }

  cardBtn.append(hanzi, meta);
  cardBtn.addEventListener("click", () => {
    revealed = !revealed;
    render();
  });

  const row = document.createElement("div");
  row.className = "actions";

  const prev = document.createElement("button");
  prev.type = "button";
  prev.className = "btn btn--ghost";
  prev.textContent = "← Назад";
  prev.addEventListener("click", () => {
    index = (index - 1 + CARDS.length) % CARDS.length;
    revealed = false;
    render();
  });

  const next = document.createElement("button");
  next.type = "button";
  next.className = "btn";
  next.textContent = "Вперёд →";
  next.addEventListener("click", () => {
    index = (index + 1) % CARDS.length;
    revealed = false;
    render();
  });

  row.append(prev, next);

  const tip = document.createElement("p");
  tip.className = "kbd-tip";
  tip.textContent = "Пробел — открыть/закрыть · ← / → — карточки";

  main.append(header, cardBtn, row, tip);
  app.append(main);
}

window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
    return;
  }
  if (e.code === "Space") {
    e.preventDefault();
    revealed = !revealed;
    render();
  } else if (e.code === "ArrowRight") {
    e.preventDefault();
    index = (index + 1) % CARDS.length;
    revealed = false;
    render();
  } else if (e.code === "ArrowLeft") {
    e.preventDefault();
    index = (index - 1 + CARDS.length) % CARDS.length;
    revealed = false;
    render();
  }
});

render();
