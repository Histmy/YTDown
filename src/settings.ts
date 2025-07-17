function getInput(selector: string) {
  return document.querySelector(selector) as HTMLInputElement;
}

const domainElement = getInput("#domain");
const languageElement = getInput("#language");
const saveButton = getInput("#save");

function saveItem(key: string, value: string) {
  if (value) {
    localStorage.setItem(key, value);
  } else {
    localStorage.removeItem(key);
  }
}

function saveSettings() {
  const domain = domainElement.value.trim();
  saveItem("domain", domain);

  const languageVal = languageElement.value;
  const language = languageVal == "auto" ? "" : languageVal; // Use empty string for auto
  saveItem("lang", language);
}

function getItem(key: string) {
  return localStorage.getItem(key) || "";
}

function loadSettings() {
  domainElement.value = getItem("domain");
  languageElement.value = getItem("lang") || "auto"; // Default to "auto" if not set
}

loadSettings();

saveButton.onclick = (e) => {
  e.preventDefault();
  saveSettings();

  location.reload();
};
