// The only place where API minor units become customer-facing money.
export function formatMoney(minorUnits, language = "fr") {
  const locale = language === "fr" ? "fr-FR" : "en-IE";
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(minorUnits / 100);
}
