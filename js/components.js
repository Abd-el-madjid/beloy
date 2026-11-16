import { formatMoney } from "./money.js";

export function renderPackageCard(pkg, selected, frequency, language, copy, onSelect) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = `package-card${selected ? " selected" : ""}${pkg.id === "comfort" ? " recommended" : ""}`;
  card.setAttribute("aria-pressed", String(selected));
  card.innerHTML = `<span class="visually-hidden">${copy.selectPackage}</span>${pkg.id === "comfort" ? `<span class="package-recommendation">${copy.recommended}</span>` : ""}<h3>${copy.packages[pkg.id].name}</h3><p class="package-desc">${copy.packages[pkg.id].description}</p><div class="package-price">${formatMoney(pkg.price[frequency], language)}<small> / ${copy.frequency[frequency]}</small></div><div class="package-annual">${frequency === "monthly" ? `${formatMoney(pkg.price.annual, language)} / ${copy.frequency.annual}` : copy.annualPayment}</div><div class="package-includes">${copy.packages[pkg.id].features.map(feature => `<span><b aria-hidden="true">✓</b>${feature}</span>`).join("")}</div>`;
  card.addEventListener("click", onSelect);
  return card;
}

export function renderAddon(option, selected, frequency, language, copy, onChange) {
  const item = document.createElement("label");
  const checked = option.included || selected;
  item.className = `addon-item${checked ? " selected" : ""}${option.included ? " included" : ""}`;
  item.innerHTML = `<input type="checkbox" ${checked ? "checked" : ""} ${option.included ? "disabled" : ""} aria-label="${copy.options[option.code].name}"><div class="addon-icon" aria-hidden="true">${copy.options[option.code].icon}</div><strong>${copy.options[option.code].name}</strong><p>${copy.options[option.code].description}</p><small>${option.included ? copy.included : `${formatMoney(option.price[frequency], language)} / ${copy.frequency[frequency]}`}</small>`;
  const input = item.querySelector("input");
  if (!option.included) input.addEventListener("change", () => onChange(input.checked));
  return item;
}

export function reviewField(label, value) {
  const wrapper = document.createElement("div");
  wrapper.className = "review-field";
  const title = document.createElement("small"); title.textContent = label;
  const content = document.createElement("strong"); content.textContent = value;
  wrapper.append(title, content);
  return wrapper;
}

/** Reusable notification content; timing and actions stay with the flow controller. */
export function renderNoticeContent(host, { title, message, actionLabel, onAction, onClose, closeLabel, type = "error" }) {
  host.replaceChildren();
  host.className = `notice ${type}`;
  const icon = document.createElement("span");
  icon.className = "notice-icon"; icon.setAttribute("aria-hidden", "true");
  icon.textContent = type === "success" ? "✓" : "!";
  const content = document.createElement("div"); content.className = "notice-content";
  const heading = document.createElement("strong"); heading.className = "notice-title"; heading.textContent = title;
  const body = document.createElement("p"); body.className = "notice-message"; body.textContent = message;
  content.append(heading, body);
  if (actionLabel && onAction) {
    const action = document.createElement("button"); action.type = "button"; action.className = "notice-action"; action.textContent = actionLabel;
    action.addEventListener("click", onAction); content.append(action);
  }
  const close = document.createElement("button"); close.type = "button"; close.className = "notice-close";
  close.setAttribute("aria-label", closeLabel); close.textContent = "×"; close.addEventListener("click", onClose);
  host.append(icon, content, close);
}

/** Reusable inline field feedback. */
export function renderFieldFeedback(field, message) {
  const feedback = document.createElement("small");
  feedback.id = `${field.id}-error`; feedback.className = "field-error"; feedback.textContent = message;
  field.setAttribute("aria-describedby", feedback.id);
  field.insertAdjacentElement("afterend", feedback);
}
