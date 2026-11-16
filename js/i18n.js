import fr from "./locales/fr.js";
import en from "./locales/en.js";
export const copy = { fr, en };
export function applyLanguage(lang) {
  const dict = copy[lang] || copy.fr;
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach(element => {
    const key = element.dataset.i18n;
    const value = dict[key] ?? key.split(".").reduce((node, part) => node?.[part], dict);
    if (typeof value === "string") element.innerHTML = value;
  });
  document.querySelectorAll("[data-i18n-content]").forEach(element => { const value = dict[element.dataset.i18nContent]; if (typeof value === "string") element.setAttribute("content", value); });
  document.querySelectorAll("[data-i18n-aria-label]").forEach(element => { const value = dict[element.dataset.i18nAriaLabel]; if (value) element.setAttribute("aria-label", value); });
  document.querySelectorAll("[data-i18n-title]").forEach(element => { const value = dict[element.dataset.i18nTitle]; if (value) element.setAttribute("title", value); });
  document.querySelectorAll("[data-lang]").forEach(button => {
    const active = button.dataset.lang === lang;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  return dict;
}
