const lang = localStorage.getItem("lang"); // If this is set, it will override the browser language

let table: Record<string, { message: string; }> = {};

function lookupBasic(key: string, substitutions: string[]) {
  return browser.i18n.getMessage(key, substitutions); // Use browser.i18n API to get the translation
}

function lookupOverride(key: string, substitutions: string[]) {
  const value = table[key];

  if (value) {
    const substituted = substitutions.reduce((acc, sub, index) => {
      return acc.replace(`$${index + 1}`, sub);
    }, value.message);

    return substituted; // Return the substituted string
  } else {
    console.warn(`Missing translation for key: ${key} in language: ${lang}`);
    return lookupBasic(key, substitutions); // Fallback to basic lookup if not found in the override table
  }
}

export function getRelevantString(key: string, substitutions: string[] = []) {
  return lang ? lookupOverride(key, substitutions) : lookupBasic(key, substitutions);
}

function getString(element: Element, dataKey: string) {
  const key = element.getAttribute(dataKey);

  if (!key) {
    return "";
  }

  return getRelevantString(key);
}

async function execute() {

  if (lang) {
    try {
      const response = await fetch(`/_locales/${lang}/messages.json`);
      if (!response.ok) {
        throw new Error(`Failed to load localization file for language: ${lang}`);
      }
      table = await response.json();
    } catch (error) {
      console.error("Error loading localization file:", error);
      return;
    }
  }

  document.querySelectorAll("[data-i18n]").forEach(element => {
    const value = getString(element, "data-i18n");
    element.textContent = value;
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach(element => {
    const value = getString(element, "data-i18n-placeholder");
    element.setAttribute("placeholder", value);
  });

  document.querySelectorAll("[data-i18n-value]").forEach((element) => {
    const value = getString(element, "data-i18n-value");
    element.setAttribute("value", value);
  });

  document.body.style.visibility = "visible";
}

execute().catch((error) => {
  console.error("Localization execution failed:", error);
});
