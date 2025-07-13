import { download } from "./downloader.js";
import { config } from "./settings.js";
import id3 from "./id3.js";

// Constants and variables
const vidID = /id=([\w\d_-]+)/i.exec(window.location.search)?.[1] as string;
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

  const imgEl = document.createElement("img");
  imgEl.src = "../images/triangle.svg";
  imgEl.width = 50;

  const imgContainer = document.createElement("div");
  imgContainer.appendChild(imgEl);

  el.appendChild(imgContainer);

  const mesEl = document.createElement("p");

  if (!link) {
    mesEl.textContent = err;
  } else {
    const match = err.match(/\{([^\}]+)\}/g)!;
    const matchIndex = err.indexOf(match[0]);

    mesEl.appendChild(document.createTextNode(err.slice(0, matchIndex)));

    const linkEl = document.createElement("a");
    linkEl.target = "_blank";
    linkEl.href = link;
    linkEl.textContent = match[0].slice(1, -1); // Remove the curly braces

    mesEl.appendChild(linkEl);

    mesEl.appendChild(document.createTextNode(err.slice(matchIndex + match[0].length)));
  }

  el.appendChild(mesEl);

  errs.appendChild(el);
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

form.onsubmit = async e => {
  e.preventDefault();

  switchEls(form, downloading);

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

  controller = new AbortController();

  try {
    const { title, data } = await download(vidID, controller, (p, left) => {
      switchEls(stage1, stage2);
      progressBar.style.width = progress.innerText = `${p}%`;
      if (left) {
        remaining.textContent = `Zbývá: ${left} sekund`;
      }
    });

    switchEls(stage2, stage3);
    cancelBtn.classList.add("hidden");

    const name = (props.has("interpret") && props.has("title")) ? `${props.get("interpret")} - ${props.get("title")}.mp3`.replace(/[\/\\?<>:*|"]/g, "_") : `${title}.mp3`;

    const song = id3(data, props.get("title"), props.get("interpret"), props.get("album"), props.get("imgMIME"), props.get("image"));

    browser.downloads.download({
      url: URL.createObjectURL(new Blob([song])),
      filename: name
    });
  } catch (e) {
    const isError = e instanceof Error;

    if (isError && e.name == "AbortError") {
      return;
    }

    const mes = (e instanceof Error) ? e.message : "Při stahování souboru došlo k neočekávané chybě.";
    showError(mes);
    restart();
  }
};

// Other stuff
if (!vidID) {
  showError("Nepodařilo se získat ID videa. Zkontrolujte, zda je URL videa ve správném formátu.");
  throw new Error("No video ID found in URL.");
}

document.title = browser.runtime.getManifest().version;

baseProps.forEach(n => {
  form[n].value = localStorage.getItem(n);
});
coverImg.src = localStorage.getItem("image") ?? "";

setTimeout(() => {
  browser.runtime.sendMessage({ height: innerHeight }); // Sends current height of this window to background script so it can resize it
}, 100);

// Check if server is available and if there is newer version
fetch(`${config.domain}/latest-version`).then(async r => {
  if (r.status != 200) {
    showError("Server neodpovídá správně. Zkuste to později.");
    return;
  }

  const currentVersion = browser.runtime.getManifest().version;
  const currentSections = currentVersion.split(".");

  const text = await r.text();

  const sections = text.trim().split(".");

  sections.some((section, i) => {
    const number = Number(section);

    if (isNaN(number)) {
      showError("Server vrátil neplatnou verzi. Zkuste to později.");
      throw new Error("Invalid version format from server.");
    }

    if (currentSections[i] && number < Number(currentSections[i])) {
      showError(`Aktuální server podporuje starší verzi YTDown. Vy používáte ${currentVersion} a server hlásí nejnovější jako ${text}. Stahování může probíhat nestandardně, nebo nemusí fungovat vůbec.`);
      return true; // Stop the loop
    }

    if (currentSections[i] && number > Number(currentSections[i])) {
      showError("Je dostupná novější verze YTDown. Aktualizaci můžete provést pomocí {tohoto návodu}.", "https://support.mozilla.org/cs/kb/jak-aktualizovat-doplnky#w_aktualizace-doplnku");
      return true; // Stop the loop
    }
  });
}).catch(() => {
  showError("Server není dostupný. Zkuste to později.");
});
