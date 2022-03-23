import id3 from "./id3.js";

// Constants and variables
const vidID = /id=([\w\d_-]+)/i.exec(window.location.search)?.[1];
const form = getEl<HTMLFormElement>("form");
const edit = getEl(".edit");
const coverImg = getEl<HTMLImageElement>(".cover");
const filePicker = getEl<HTMLInputElement>("input[type=file]");
const downloading = getEl(".downloading");
const cancelBtn = getEl(".cancel");
const progressBar = getEl("div.progress");
const progress = getEl("span.progress");
const remaining = getEl(".remaining");
const stage1 = getEl(".st1");
const stage2 = getEl(".st2");
const stage3 = getEl(".st3");
const errs = getEl(".errs");
const baseProps = ["interpret", "title", "album"];
let controller: AbortController;

// Functions
function getEl(selector: string): HTMLElement;
function getEl<T extends HTMLElement>(selector: string): T;
function getEl<T extends HTMLElement>(selector: string) {
  return document.querySelector(selector) as T;
}

function showError(err: string, link?: string) {
  const el = document.createElement("div");
  el.classList.add("err");
  const mes = (!link) ? err : err.replace(/\{([^\}]+)\}/g, `<a target="_blank" href="${link}">$1</a>`);
  el.innerHTML = `<div><img src="../images/triangle.svg" width="50px"></div><p>${mes}</p>`;
  errs.appendChild(el);
}

function safeParseJSON(data: string): Record<any, any> | null {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function switchEls(from: HTMLElement, to: HTMLElement) {
  from.classList.add("hidden");
  to.classList.remove("hidden");
}

function restart() {
  switchEls(stage2, stage1);
  switchEls(downloading, form);
}

function recurseRemove(el: HTMLElement) {
  if (el.classList.contains("err")) return el.remove();
  if (el.parentElement) recurseRemove(el.parentElement);
}

// Listeners
edit.onclick = () => filePicker.click();

filePicker.onchange = () => {
  const f = filePicker.files?.[0];
  if (!f?.type.startsWith("image")) return showError("Tento soubor není obrázek. Zkuste vybrat jiný soubor.");
  const reader = new FileReader();
  reader.readAsDataURL(f);
  reader.onload = () => {
    const res = reader.result as string;
    try {
      localStorage.setItem("image", res);
      coverImg.src = res;
    } catch (e) {
      console.error(e);
      if (!(e instanceof Error)) return showError("Při ukládání obrázku nastala neočekávaná chyba. Zkuste to znovu, nebo zkuste vybrat jiný.");
      if (e.name == "QuotaExceededError") showError("Tento obrázek je příliš velký. Zkuste vybrat jiný.");
      else showError("Při ukládání obrázku nastala neočekávaná chyba. Zkuste to znovu, nebo zkuste vybrat jiný.");
    }
  };
};

cancelBtn.onclick = () => {
  controller.abort();
  restart();
};

form.onchange = () => {
  baseProps.forEach(n => {
    localStorage.setItem(n, form[n].value);
  });
};

errs.onclick = e => {
  const el = e.target as HTMLDivElement;
  if (el.tagName != "A")
    recurseRemove(el);
};

form.onsubmit = e => {
  e.preventDefault();
  controller = new AbortController();

  switchEls(form, downloading);

  const socket = new WebSocket("ws://mp3.deadfish.cz:6343");
  let state = 0;
  let socId: string;
  let resolver: Function;
  const waitForSoc = new Promise(res => resolver = res);

  socket.onopen = () => socket.send(JSON.stringify({ id: 0, version: "0.3" }));

  socket.onmessage = m => {
    function closeUnknown() {
      showError("Při komunikaci se serverem došlo k neznámé chybě.");
      return socket.close(4003);
    }

    const mes = safeParseJSON(m.data);
    if (!mes) return closeUnknown();
    switch (state) {
      case 0:
        if (!mes.socId) return closeUnknown();
        socId = mes.socId;
        state = 1;
        resolver();
        break;

      case 1:
        if (!mes.downloading) break;
        switchEls(stage1, stage2);
        progressBar.style.width = progress.innerText = `${mes.progress}%`;
        remaining.innerText = mes.eta;
        break;
    }
  };

  socket.onclose = m => {
    switch (m.code) {
      case 1000:
        return;
      case 4004:
        return showError("Tato aplikace je příliš stará. Prosím aktualizujte ji podle návodu {zde}.", "https://support.mozilla.org/cs/kb/jak-aktualizovat-doplnky#w_aktualizace-doplnku");
      case 1006:
        showError("Server není dostupný. Zkuste to později.");
        cancelBtn.click();
        return;
      default:
        console.log("Server disconnected. Exit code:", m.code);
        showError("Připojení k serveru bylo neočekávaně přerušeno. Postup stahování se nebude ukazovat.");
    }
  };

  const props = new Map();
  baseProps.forEach(n => {
    const prop = form[n].value;
    if (prop) props.set(n, prop);
  });
  const img = localStorage.getItem("image");
  if (img) {
    const regex = /\w+:(\w+\/[^;]+);\w+,(.+)/.exec(img)!; // Example of Image "data:image/png;base64,iVBORw0KG..."
    props.set("imgMIME", regex[1]);
    props.set("image", Uint8Array.from(atob(regex[2]), c => c.charCodeAt(0)));
  }

  waitForSoc.then(() => {
    const interval = setInterval(() => socket.send('{"id":0}'), 1e3);
    controller.signal.onabort = () => {
      clearInterval(interval);
      socket.close(1000);
    };

    fetch(`http://mp3.deadfish.cz/stahnout?url=http://youtu.be/${vidID}&id=${socId}`, { signal: controller.signal })
      .then(r => {
        if (r.status != 200) return void r.text().then(text => {
          showError(`Stahování se nezdařilo. Důvod: ${text}`);
          socket.close(1000);
          restart();
        });
        const fileTitle = r.headers.get("Content-Disposition")?.match(/=(.+)\.mp3/)?.[1] || "Bez názvu";
        console.log(fileTitle);
        r.arrayBuffer().then(a => {
          switchEls(stage2, stage3);
          cancelBtn.classList.add("hidden");

          clearInterval(interval);
          socket.close(1000);

          const song = id3(a, props.get("title"), props.get("interpret"), props.get("album"), props.get("imgMIME"), props.get("image"));
          const name = (props.has("interpret") && props.has("title")) ? `${props.get("interpret")} - ${props.get("title")}.mp3`.replace(/[\/\\?<>:*|"]/g, "_") : `${fileTitle}.mp3`;
          browser.downloads.download({ url: URL.createObjectURL(new Blob([song])), filename: name });
        });
      })
      .catch(e => {
        if (e.name == "AbortError") return;
        showError("Při ukládání souboru došlo k neznámé chybě.");
        console.error(e);
      });
  });
};

// Other stuff
baseProps.forEach(n => {
  form[n].value = localStorage.getItem(n);
});
coverImg.src = localStorage.getItem("image") ?? "";

browser.runtime.sendMessage({ height: innerHeight }); // Sends current height of this window to background script so it can resize it

// Check if server is available and if there is newer version
fetch("http://mp3.deadfish.cz/latest-version").then(async r => {
  if (await r.text() != "0.3") showError("Je dostupná novější verze YTDown. Aktualizaci můžete provés pomocí {tohoto návodu}.", "https://support.mozilla.org/cs/kb/jak-aktualizovat-doplnky#w_aktualizace-doplnku");
}).catch(() => {
  showError("Server není dostupný. Zkuste to později.");
});
