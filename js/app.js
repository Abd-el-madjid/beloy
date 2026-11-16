import { createQuote, issueContract } from "./api.js";
import { applyLanguage, copy } from "./i18n.js";
import { formatMoney } from "./money.js";
import {
  renderPackageCard,
  renderAddon,
  reviewField,
  renderNoticeContent,
  renderFieldFeedback,
} from "./components.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const state = {
  screen: 0,
  lang: "fr",
  frequency: "annual",
  quote: null,
  selection: null,
  addons: [],
  contract: null,
  form: null,
  busy: false,
};
const t = () => copy[state.lang];
const fmt = (amount) => formatMoney(amount, state.lang);
const dateText = (value) =>
  value
    ? new Date(`${value}T12:00:00`).toLocaleDateString(
        state.lang === "fr" ? "fr-FR" : "en-GB",
      )
    : "—";

function updateFavicon(theme) {
  const favicon = document.getElementById("siteFavicon");

  favicon.href =
    theme === "dark"
      ? "./assets/favicon-dark.svg"
      : "./assets/favicon-light.svg";
}

let noticeTimer = null;
function notice(title, message, actionLabel, action, type = "error") {
  const box = $("#notice");
  clearTimeout(noticeTimer);
  renderNoticeContent(box, {
    title,
    message,
    type,
    actionLabel: actionLabel !== t().messages.reviewAction ? actionLabel : null,
    onAction: action
      ? () => {
          clearNotice();
          action();
        }
      : null,
    onClose: clearNotice,
    closeLabel: t()["notice.close"],
  });
  noticeTimer = setTimeout(clearNotice, 5000);
}
function clearNotice() {
  clearTimeout(noticeTimer);
  noticeTimer = null;
  const box = $("#notice");
  box.className = "notice d-none";
  box.replaceChildren();
}
function clearFieldError(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("is-invalid");
  el.removeAttribute("aria-invalid");
  const feedback = document.getElementById(`${id}-error`);
  if (feedback) feedback.remove();
  el.removeAttribute("aria-describedby");
}
function fieldError(id, message) {
  const el = document.getElementById(id);
  if (!el) return;
  clearFieldError(id);
  el.classList.add("is-invalid");
  el.setAttribute("aria-invalid", "true");
  renderFieldFeedback(el, message);
}
function validateFields(checks, title, summary) {
  checks.forEach(([id]) => clearFieldError(id));
  const invalid = checks.filter(([, valid]) => !valid);
  if (!invalid.length) return true;
  invalid.forEach(([id, , message]) => fieldError(id, message));
  notice(title, summary);
  return false;
}
function setBusy(button, busy, message, original) {
  button.disabled = busy;
  button.setAttribute("aria-busy", String(busy));
  button.innerHTML = busy
    ? `<span class="spinner-border spinner-border-sm" aria-hidden="true"></span><span>${message}</span>`
    : original;
}
function go(step) {
  if (step > 1 && step < 5 && !state.quote && step >= 3) return;
  if (step === 4 && !currentPackage()) return;
  if (step === 5 && !state.contract) return;
  clearNotice();
  state.screen = step;
  $$("[data-screen]").forEach((section) =>
    section.classList.toggle("active", Number(section.dataset.screen) === step),
  );
  $("#stepperWrap").classList.toggle("d-none", step === 0);
  $$(".step-item").forEach((item) => {
    const n = Number(item.dataset.step);
    item.classList.toggle("active", n === step);
    item.classList.toggle("done", n < step);
    item.disabled =
      n > step ||
      (n === 3 && !state.quote) ||
      (n === 4 && !currentPackage()) ||
      (n === 5 && !state.contract);
    item.setAttribute(
      "aria-label",
      `${n < step ? "✓ " : ""}${item.querySelector("small")?.textContent || "Step"}`,
    );
    if (n === step) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  });
  const active = $(`[data-screen="${step}"]`);
  active?.setAttribute("tabindex", "-1");
  active?.focus({ preventScroll: true });
  saveProgress();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
const STORAGE_KEY = "bmw-drive-cover-progress-v3";
const fieldsToKeep = [
  "model",
  "listPrice",
  "deliveryDate",
  "birthDate",
  "licenceDate",
  "claims",
  "mileage",
  "postcode",
  "parking",
  "firstName",
  "lastName",
  "email",
  "phone",
];
function saveProgress() {
  try {
    const fields = Object.fromEntries(
      fieldsToKeep.map((id) => [id, document.getElementById(id)?.value ?? ""]),
    );
    fields.charging =
      document.querySelector('input[name="charging"]:checked')?.value || "home";
    fields.consents = ["consentInfo", "consentTerms", "consentData"].map(
      (id) => document.getElementById(id).checked,
    );
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...state,
        theme: document.documentElement.dataset.theme,
        fields,
        savedAt: Date.now(),
      }),
    );
  } catch (error) {
    console.warn("Progress could not be saved", error);
  }
}
function restoreProgress() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
    if (!saved || !saved.fields) return false;
    for (const id of fieldsToKeep)
      if (saved.fields[id] !== undefined)
        document.getElementById(id).value = saved.fields[id];
    const charging = document.querySelector(
      `input[name="charging"][value="${saved.fields.charging}"]`,
    );
    if (charging) charging.checked = true;
    ["consentInfo", "consentTerms", "consentData"].forEach(
      (id, i) =>
        (document.getElementById(id).checked = Boolean(
          saved.fields.consents?.[i],
        )),
    );
    state.lang = saved.lang === "en" ? "en" : "fr";
    state.frequency = saved.frequency === "monthly" ? "monthly" : "annual";
    state.quote = saved.quote || null;
    state.selection = saved.selection || null;
    state.addons = Array.isArray(saved.addons) ? saved.addons : [];
    state.contract = saved.contract || null;
    state.form = saved.form || null;
    if (state.quote && Date.parse(state.quote.expires_at) <= Date.now()) {
      state.quote = null;
      state.selection = null;
      state.addons = [];
      state.contract = null;
      saved.screen = Math.min(saved.screen, 2);
    }
    applyLanguage(state.lang);
    updateVehiclePreview();
    setFrequency(state.frequency);
    if (state.quote) {
      renderPackages();
      renderAddons();
      updateTotal();
    }
    if (state.quote && state.selection) populateReview();
    if (state.contract && state.quote && state.selection) renderConfirmation();
    document.documentElement.dataset.theme =
      saved.theme === "dark" ? "dark" : "light";
    document
      .getElementById("themeToggle")
      .setAttribute("aria-pressed", String(saved.theme === "dark"));
    go(
      Math.min(
        Math.max(0, Number(saved.screen) || 0),
        state.contract
          ? 5
          : state.quote && state.selection
            ? 4
            : state.quote
              ? 3
              : 2,
      ),
    );
    return true;
  } catch (error) {
    console.warn("Saved progress could not be restored", error);
    return false;
  }
}
function value(id) {
  return $(`#${id}`).value;
}
function vehiclePayload() {
  return {
    model_code: value("model"),
    list_price: Math.round(Number(value("listPrice")) * 100),
    delivery_date: value("deliveryDate"),
  };
}
function driverPayload() {
  return {
    birth_date: value("birthDate"),
    licence_since: value("licenceDate"),
    claims_3y: Number(value("claims")),
    annual_km: Number(value("mileage")),
    postcode: value("postcode").trim(),
    parking: value("parking"),
    charging: $('input[name="charging"]:checked').value,
  };
}
function validateVehicle() {
  const v = vehiclePayload();
  const future =
    v.delivery_date &&
    new Date(`${v.delivery_date}T00:00:00`) >
      new Date(new Date().toDateString());
  return validateFields(
    [
      [
        "listPrice",
        Number.isInteger(v.list_price) && v.list_price > 0,
        t()["validation.price"],
      ],
      ["deliveryDate", Boolean(future), t()["validation.delivery"]],
    ],
    t().messages.vehicleTitle,
    t().messages.vehicleInvalid,
  );
}
function validateDriver() {
  const d = driverPayload();
  const birth = d.birth_date ? new Date(`${d.birth_date}T00:00:00`) : null;
  const today = new Date();
  let age = birth ? today.getFullYear() - birth.getFullYear() : 0;
  if (
    birth &&
    (today.getMonth() < birth.getMonth() ||
      (today.getMonth() === birth.getMonth() &&
        today.getDate() < birth.getDate()))
  )
    age--;
  const licence = d.licence_since
    ? new Date(`${d.licence_since}T00:00:00`)
    : null;
  const licenceLimit = new Date();
  licenceLimit.setFullYear(licenceLimit.getFullYear() - 2);
  return validateFields(
    [
      [
        "birthDate",
        Boolean(birth && !Number.isNaN(+birth) && age >= 18),
        t()["validation.age"],
      ],
      [
        "licenceDate",
        Boolean(
          licence &&
          !Number.isNaN(+licence) &&
          licence <= licenceLimit &&
          licence >= birth,
        ),
        t()["validation.licence"],
      ],
      ["postcode", /^\d{5}$/.test(d.postcode), t()["validation.postcode"]],
      [
        "mileage",
        Number.isFinite(d.annual_km) && d.annual_km > 0,
        t()["validation.mileage"],
      ],
      [
        "claims",
        Number.isInteger(d.claims_3y) && d.claims_3y >= 0 && d.claims_3y <= 2,
        t()["validation.claims"],
      ],
    ],
    t().messages.driverTitle,
    t().messages.driverInvalid,
  );
}
function updateVehiclePreview() {
  $("#modelPreview").textContent = `BMW ${value("model")}`;
  $("#pricePreview").textContent = fmt(
    Math.round(Number(value("listPrice") || 0) * 100),
  );
}
function currentPackage() {
  return state.quote?.packages.find((pkg) => pkg.id === state.selection);
}
function selectedOptionCodes(includeBundled = false) {
  const pkg = currentPackage();
  if (!pkg) return [];
  return pkg.options
    .filter((option) =>
      includeBundled
        ? option.included || state.addons.includes(option.code)
        : !option.included && state.addons.includes(option.code),
    )
    .map((option) => option.code);
}
function renderPackages() {
  const host = $("#packages");
  host.replaceChildren();
  state.quote.packages.forEach((pkg) =>
    host.append(
      renderPackageCard(
        pkg,
        state.selection === pkg.id,
        state.frequency,
        state.lang,
        t(),
        () => {
          state.selection = pkg.id;
          state.addons = [];
          renderPackages();
          renderAddons();
          updateTotal();
          saveProgress();
        },
      ),
    ),
  );
}
function renderAddons() {
  const host = $("#addons");
  host.replaceChildren();
  const pkg = currentPackage();
  if (!pkg) {
    host.textContent = t()["cover.choose"];
    return;
  }
  pkg.options.forEach((option) =>
    host.append(
      renderAddon(
        option,
        state.addons.includes(option.code),
        state.frequency,
        state.lang,
        t(),
        (checked) => {
          state.addons = checked
            ? [...state.addons, option.code]
            : state.addons.filter((code) => code !== option.code);
          renderAddons();
          updateTotal();
          saveProgress();
        },
      ),
    ),
  );
}
function updateTotal() {
  const pkg = currentPackage();
  const button = $("#coverContinue");
  if (!pkg) {
    $("#runningTotal").textContent = "—";
    $("#totalNote").textContent = t()["cover.choose"];
    $("#addonCount").textContent = t()["selectedCountZero"];
    button.disabled = true;
    return;
  }
  const extras = pkg.options
    .filter((option) => !option.included && state.addons.includes(option.code))
    .reduce((sum, option) => sum + option.price[state.frequency], 0);
  const total = pkg.price[state.frequency] + extras;
  $("#runningTotal").textContent =
    `${fmt(total)} / ${t().frequency[state.frequency]}`;
  const annualTotal =
    pkg.price.annual +
    pkg.options
      .filter((option) => state.addons.includes(option.code))
      .reduce((sum, option) => sum + option.price.annual, 0);
  $("#totalNote").textContent =
    state.frequency === "monthly"
      ? t()["cover.monthlyNote"].replace("{annualTotal}", fmt(annualTotal))
      : t()["cover.annualNote"];
  $("#addonCount").textContent =
    state.addons.length === 1
      ? t().selectedCountOne
      : t().selectedCountMany.replace("{count}", String(state.addons.length));
  button.disabled = false;
}
function setFrequency(frequency) {
  state.frequency = frequency;
  $$("[data-frequency]").forEach((button) => {
    const active = button.dataset.frequency === frequency;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (state.quote) {
    renderPackages();
    renderAddons();
    updateTotal();
  }
  saveProgress();
}
function addReviewFields(container, fields) {
  const host = $(container);
  host.replaceChildren(
    ...fields.map(([label, value]) => reviewField(label, String(value))),
  );
}
function populateReview() {
  const v = vehiclePayload(),
    d = driverPayload(),
    pkg = currentPackage(),
    labels = t().labels;
  addReviewFields("#reviewVehicle", [
    [labels.model, `BMW ${v.model_code}`],
    [labels.listPrice, fmt(v.list_price)],
    [labels.delivery, dateText(v.delivery_date)],
  ]);
  addReviewFields("#reviewDriver", [
    [labels.birth, dateText(d.birth_date)],
    [labels.licence, dateText(d.licence_since)],
    [labels.claims, d.claims_3y],
    [
      labels.mileage,
      `${d.annual_km.toLocaleString(state.lang === "fr" ? "fr-FR" : "en-GB")} km`,
    ],
    [labels.postcode, d.postcode],
    [labels.parking, labels[d.parking]],
    [labels.charging, labels[d.charging]],
  ]);
  const names = selectedOptionCodes(true).map((code) => t().options[code].name);
  addReviewFields("#reviewCover", [
    [labels.package, t().packages[pkg.id].name],
    [labels.frequency, labels[state.frequency]],
    [labels.options, names.length ? names.join(", ") : labels.none],
    [labels.price, $("#runningTotal").textContent],
  ]);
}
function handleApiError(error, stage) {
  // Codes and request IDs are for developer diagnostics only; never render them to customers.
  console.error(`${stage} API error`, {
    code: error.code,
    requestId: error.requestId,
    status: error.status,
    detail: error.message,
  });
  const messages = t().messages;
  if (error.code === "invalid_request" && stage === "quote") {
    notice(messages.quoteTitle, t()["validation.serverRejected"]);
    return;
  }
  if (error.code === "driver_ineligible")
    return notice(
      messages.eligibilityTitle,
      messages.ineligible,
      messages.driverAction,
      () => go(2),
    );
  if (error.code === "quote_expired")
    return notice(
      messages.expiredTitle,
      messages.expired,
      messages.quoteAction,
      () => {
        state.quote = null;
        state.selection = null;
        state.addons = [];
        go(2);
      },
    );
  if (error.code === "consent_required")
    return notice(
      messages.consentTitle,
      messages.consentRequired,
      messages.consentAction,
      () => $("#consentInfo").focus(),
    );
  if (error.code === "network_unavailable")
    return notice(
      messages.networkTitle,
      messages.network,
      messages.retryAction,
      stage === "quote" ? getQuote : issue,
    );
  return notice(
    stage === "quote" ? messages.quoteTitle : messages.contractTitle,
    stage === "quote" ? messages.quoteFailed : messages.contractFailed,
    messages.retryAction,
    stage === "quote" ? getQuote : issue,
  );
}
async function getQuote() {
  if (state.busy || !validateVehicle() || !validateDriver()) return;
  state.busy = true;
  const button = $("#getQuoteBtn"),
    original = `<span>${t()["driver.getQuote"]}</span><span aria-hidden="true">→</span>`;
  setBusy(button, true, t().messages.calculating, original);
  clearNotice();
  try {
    state.form = { vehicle: vehiclePayload(), driver: driverPayload() };
    state.quote = await createQuote({ program: "bmw-fr-ev", ...state.form });
  } catch (error) {
    handleApiError(error, "quote");
    setBusy(button, false, "", original);
    state.busy = false;
    return;
  }
  try {
    state.selection = null;
    state.addons = [];
    $("#issueBtn").disabled = false;
    renderPackages();
    renderAddons();
    updateTotal();
    go(3);
  } catch (error) {
    console.error("Frontend rendering failed:", error);
    notice(t().messages.quoteTitle, t().messages.quoteFailed);
  } finally {
    setBusy(button, false, "", original);
    state.busy = false;
  }
}
function chosenContractOptions() {
  return selectedOptionCodes(false);
}
async function issue() {
  if (
    !validateFields(
      [
        [
          "firstName",
          Boolean(value("firstName").trim()),
          t()["validation.firstName"],
        ],
        [
          "lastName",
          Boolean(value("lastName").trim()),
          t()["validation.lastName"],
        ],
        [
          "email",
          Boolean(value("email").trim()) && $("#email").checkValidity(),
          t()["validation.email"],
        ],
        [
          "phone",
          Boolean(value("phone").trim()) && $("#phone").checkValidity(),
          t()["validation.phone"],
        ],
      ],
      t().messages.contactTitle,
      t().messages.contactInvalid,
    )
  )
    return;
  if (
    !validateFields(
      [
        ["consentInfo", $("#consentInfo").checked, t()["validation.consent"]],
        ["consentTerms", $("#consentTerms").checked, t()["validation.consent"]],
        ["consentData", $("#consentData").checked, t()["validation.consent"]],
      ],
      t().messages.consentTitle,
      t().messages.consentRequired,
    )
  )
    return;
  if (!state.quote || !currentPackage()) {
    notice(
      t().messages.quoteTitle,
      t().messages.quoteFailed,
      t().messages.quoteAction,
      () => go(2),
    );
    return;
  }
  if (state.busy) return;
  state.busy = true;
  const button = $("#issueBtn"),
    original = `<span>${t()["review.confirmButton"]}</span><span aria-hidden="true">→</span>`;
  setBusy(button, true, t().messages.issuing, original);
  clearNotice();
  const payload = {
    quote_id: state.quote.quote_id,
    package_id: currentPackage().id,
    options: chosenContractOptions(),
    frequency: state.frequency,
    holder: {
      first_name: value("firstName").trim(),
      last_name: value("lastName").trim(),
      email: value("email").trim(),
      phone: value("phone").trim(),
    },
    consents: {
      pre_contractual_information: true,
      general_conditions: true,
      data_processing: true,
    },
  };
  try {
    state.contract = await issueContract(payload);
    renderConfirmation();
    go(5);
  } catch (error) {
    handleApiError(error, "contract");
    if (error.code === "quote_expired") {
      state.quote = null;
      $("#issueBtn").disabled = true;
    }
  } finally {
    setBusy(button, false, "", original);
    state.busy = false;
    if (!state.quote) button.disabled = true;
  }
}
function renderConfirmation() {
  const contract = state.contract,
    pkg = currentPackage();
  $("#policyNumber").textContent = contract.policy_number;
  $("#policyStart").textContent = dateText(contract.starts_on);
  $("#policyPackage").textContent = t().packages[pkg.id].name;
  $("#paymentAmount").textContent = fmt(contract.payment.amount);
  $("#paymentEntity").textContent = contract.payment.entity;
  $("#paymentRef").textContent = contract.payment.reference;
  $("#paymentDue").textContent = fmt(contract.payment.amount);
  $("#paymentDueDate").textContent = dateText(contract.payment.due_by);
}
function reset() {
  sessionStorage.removeItem(STORAGE_KEY);
  state.quote = null;
  state.selection = null;
  state.addons = [];
  state.contract = null;
  state.form = null;
  state.frequency = "annual";
  $("#model").value = "i4";
  $("#listPrice").value = "59590";
  $("#deliveryDate").value = "";
  [
    "birthDate",
    "licenceDate",
    "postcode",
    "firstName",
    "lastName",
    "email",
    "phone",
  ].forEach((id) => ($(`#${id}`).value = ""));
  $("#claims").value = "0";
  $("#mileage").value = "12000";
  $("#parking").value = "street";
  $('input[name="charging"][value="home"]').checked = true;
  ["consentInfo", "consentTerms", "consentData"].forEach(
    (id) => ($(`#${id}`).checked = false),
  );
  setFrequency("annual");
  updateVehiclePreview();
  go(0);
}

$$(".step-item").forEach((button) =>
  button.addEventListener("click", () => {
    if (!button.disabled) go(Number(button.dataset.step));
  }),
);
const quoteInputIds = new Set([
  "model",
  "listPrice",
  "deliveryDate",
  "birthDate",
  "licenceDate",
  "claims",
  "mileage",
  "postcode",
  "parking",
]);
function invalidateQuoteForChangedInput(input) {
  if (
    !state.quote ||
    !(quoteInputIds.has(input.id) || input.name === "charging")
  )
    return;
  state.quote = null;
  state.selection = null;
  state.addons = [];
  state.contract = null;
}
$$("input, select").forEach((input) => {
  input.addEventListener("input", () => {
    clearFieldError(input.id);
    invalidateQuoteForChangedInput(input);
    saveProgress();
  });
  input.addEventListener("change", () => {
    clearFieldError(input.id);
    invalidateQuoteForChangedInput(input);
    saveProgress();
  });
});
$("#startBtn").addEventListener("click", () => go(1));
$$("[data-next]").forEach((button) =>
  button.addEventListener("click", () => {
    if (state.screen === 1 && !validateVehicle()) return;
    go(state.screen + 1);
  }),
);
$$("[data-back]").forEach((button) =>
  button.addEventListener("click", () => go(state.screen - 1)),
);
$("#getQuoteBtn").addEventListener("click", getQuote);
$("#coverContinue").addEventListener("click", () => {
  if (!currentPackage()) return;
  populateReview();
  go(4);
});
$("#issueBtn").addEventListener("click", issue);
$("#model").addEventListener("change", updateVehiclePreview);
$("#listPrice").addEventListener("input", updateVehiclePreview);
$$("[data-frequency]").forEach((button) =>
  button.addEventListener("click", () =>
    setFrequency(button.dataset.frequency),
  ),
);
$$("[data-edit]").forEach((button) =>
  button.addEventListener("click", () => go(Number(button.dataset.edit))),
);
$("#themeToggle").addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme !== "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  updateFavicon(dark ? "dark" : "light");

  $("meta[name=theme-color]").content = getComputedStyle(
    document.documentElement,
  )
    .getPropertyValue("--color-paper")
    .trim();
  $("#themeToggle").setAttribute("aria-pressed", String(dark));
  saveProgress();
});
$$("[data-lang]").forEach((button) =>
  button.addEventListener("click", () => {
    state.lang = button.dataset.lang;
    applyLanguage(state.lang);
    updateVehiclePreview();
    if (state.quote) {
      renderPackages();
      renderAddons();
      updateTotal();
    }
    if (state.screen === 4) populateReview();
    if (state.contract) renderConfirmation();
    saveProgress();
  }),
);
$$("[data-copy]").forEach((button) =>
  button.addEventListener("click", async () => {
    const target = $(`#${button.dataset.copy}`);
    try {
      await navigator.clipboard.writeText(target.textContent.trim());
      const original = button.textContent;
      button.textContent = t()["copy.done"];
      button.setAttribute("aria-label", t()["copy.aria"]);
      setTimeout(() => {
        button.textContent = original;
      }, 1400);
    } catch {
      notice(
        t().messages.copyTitle,
        t().messages.copyFailed,
        t().messages.copyAction,
        () => {
          target.setAttribute("tabindex", "-1");
          target.focus();
          const range = document.createRange();
          range.selectNodeContents(target);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        },
      );
    }
  }),
);
$("#restartBtn").addEventListener("click", reset);
$$("[data-go-home]").forEach((link) =>
  link.addEventListener("click", (event) => {
    event.preventDefault();
    go(0);
  }),
);
const minDate = new Date();
minDate.setDate(minDate.getDate() + 1);
$("#deliveryDate").min = minDate.toISOString().slice(0, 10);
applyLanguage(state.lang);
updateVehiclePreview();
$("meta[name=theme-color]").content = getComputedStyle(document.documentElement)
  .getPropertyValue("--color-paper")
  .trim();
if (!restoreProgress()) go(0);

updateFavicon(document.documentElement.dataset.theme);