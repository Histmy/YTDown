// Constants and variables
const params = new URLSearchParams(window.location.search);
const url = params.get("url");
const title = params.get("title");
const form = document.querySelector("form");
const edit = document.querySelector(".edit");
const kavr = document.querySelector(".kavr");
const fajl = document.querySelector("input[type=file]");
const loading = document.querySelector(".loading");
const size = document.querySelector(".size");
const kencl = document.querySelector(".cancel");
const veci = ["artist", "title", "album"];
const socket = new WebSocket("ws://deadfish.cz:6343");
let socketId;
let controller;
let lastSize;

// Functions
const velikost = s => {
  if (s > 1_000_000) return `${Math.round(s / 10_485.76) / 100}M`;
  if (s > 1_000) return `${Math.round(s / 10.24) / 100}K`;
  return s;
};

// Listeners
edit.onclick = () => fajl.click();

fajl.onchange = () => {
  const f = fajl.files[0];
  if (!f.type.startsWith("image")) return;
  const reader = new FileReader();
  reader.readAsDataURL(f);
  reader.onload = () => {
    localStorage.setItem("image", reader.result);
    kavr.src = reader.result;
  };
};

socket.onmessage = m => {
  const mes = m.data;
  console.log(mes);
  if (mes.startsWith("i")) socketId = mes.slice(4);
  if (mes.startsWith("s")) {
    const nowSize = Number(mes.slice(6));
    size.innerText = `${velikost(2 * (nowSize - lastSize))}B/s`;
    lastSize = nowSize;
  }
};

veci.forEach(n => {
  form[n].value = localStorage.getItem(n);
});
kavr.src = localStorage.getItem("image") ?? "";

form.onchange = () => {
  veci.forEach(n => {
    localStorage.setItem(n, form[n].value);
  });
};

kencl.onclick = () => {
  controller.abort();
  form.style.display = "block";
  loading.style.display = "none";
};

form.onsubmit = e => {
  e.preventDefault();
  controller = new AbortController();

  const vlastnosti = { mojeid: socketId };
  veci.forEach(n => {
    const vec = form[n].value;
    if (vec) vlastnosti[n] = vec;
  });
  const obraz = localStorage.getItem("image");
  if (obraz) {
    vlastnosti.image = { base: /data:image\/\w+;base64,(.*)/.exec(obraz)[1] };
  }

  form.style.display = "none";
  loading.style.display = "block";
  lastSize = 0;
  size.innerText = "0B/s";
  const interval = setInterval(() => { socket.send("jak"); }, 500);

  fetch(`http://deadfish.cz:6699/stahnout?url=${url}`, { method: "POST", body: JSON.stringify(vlastnosti), headers: { "Content-Type": "application/json" }, signal: controller.signal })
    .then(r => {
      if (r.status !== 200) return void r.text().then(text => {
        const sanitizer = document.createElement("p");
        sanitizer.innerText = text;
        document.body.outerHTML = `<body class="err"><h1>Server Váš požadavek odmítnul</h1><p>Důvod: <code>${sanitizer.innerHTML}</code></p></body>`;
      });
      document.body.outerHTML = `<body class="proc"><h1>Video bylo úspěšně zpracováno</h1><p>Stahování bylo zahájeno.</p></body>`;
      r.blob().then(blob => {
        document.body.outerHTML = `<body class="succ"><h1>Úspěšně staženo</h1><p>Stahování bylo dokončeno. Toto okno můžete zavřít.</p></body>`;
        clearInterval(interval);
        browser.downloads.download({ url: URL.createObjectURL(blob), filename: `${title}.mp3` });
      });
    })
    .catch(() => clearInterval(interval));
};
