import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app not found");

app.innerHTML = `
  <main class="wrap">
    <h1>中文</h1>
    <p class="lead">Заготовка под приложение для китайского. Сборка Vite — готово к деплою на Vercel.</p>
  </main>
`;
