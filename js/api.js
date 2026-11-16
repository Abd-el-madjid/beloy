const PROGRAM = "bmw-fr-ev";
const quotes = new Map();
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const makeId = prefix => `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;

const packages = [
  { id: "essential", price: { annual: 42000, monthly: 3850 }, options: [
    ["WALLBOX", false, 4800, 440], ["CABLE", false, 2400, 220], ["BATTERY", false, 9600, 880], ["STRANDED", false, 3600, 330], ["GLASS", false, 6000, 550]
  ]},
  { id: "comfort", price: { annual: 61200, monthly: 5610 }, options: [
    ["WALLBOX", false, 4800, 440], ["CABLE", true, 0, 0], ["BATTERY", false, 9600, 880], ["STRANDED", true, 0, 0], ["GLASS", false, 6000, 550]
  ]},
  { id: "integral", price: { annual: 86400, monthly: 7920 }, options: [
    ["WALLBOX", true, 0, 0], ["CABLE", true, 0, 0], ["BATTERY", false, 9600, 880], ["STRANDED", true, 0, 0], ["GLASS", true, 0, 0]
  ]}
].map(pkg => ({ ...pkg, options: pkg.options.map(([code, included, annual, monthly]) => ({ code, included, price: { annual, monthly } })) }));
function apiError(code, status) { const error = new Error(code); error.code = code; error.status = status; error.requestId = makeId("req"); return error; }
function ageOn(date) { const d = new Date(`${date}T00:00:00`), now = new Date(); let age = now.getFullYear() - d.getFullYear(); if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--; return age; }
function yearsHeld(date) { const d = new Date(`${date}T00:00:00`), now = new Date(); let years = now.getFullYear() - d.getFullYear(); const anniversary = new Date(now.getFullYear(), d.getMonth(), d.getDate()); if (now < anniversary) years--; return years; }
export async function createQuote(payload) {
  await wait(650);
  const v = payload.vehicle || {}, d = payload.driver || {};
  if (payload.program !== PROGRAM || !v.model_code || !Number.isInteger(v.list_price) || v.list_price <= 0 || !v.delivery_date || !d.birth_date || !d.licence_since || !Number.isInteger(d.claims_3y) || !Number.isInteger(d.annual_km) || !/^\d{5}$/.test(d.postcode || "") || !d.parking || !d.charging) throw apiError("invalid_request", 400);
  if (ageOn(d.birth_date) < 18) throw apiError("invalid_request", 400);
  if (yearsHeld(d.licence_since) < 2 || d.claims_3y > 2) throw apiError("driver_ineligible", 422);
  const quote = { quote_id: makeId("qt"), currency: "EUR", expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), packages: structuredClone(packages) };
  quotes.set(quote.quote_id, { ...quote, delivery_date: v.delivery_date });
  return quote;
}


export async function issueContract(body) {
  await wait(700);
  const quote = quotes.get(body.quote_id);
  if (!quote) throw apiError("quote_not_found", 404);
  if (Date.now() > Date.parse(quote.expires_at)) throw apiError("quote_expired", 409);
  const pkg = packages.find(item => item.id === body.package_id), options = Array.isArray(body.options) ? body.options : null, holder = body.holder || {}, consents = body.consents || {};
  if (!pkg || !options || !["annual", "monthly"].includes(body.frequency) || !holder.first_name?.trim() || !holder.last_name?.trim() || !/^\S+@\S+\.\S+$/.test(holder.email || "") || !holder.phone?.trim() || options.some(code => !pkg.options.some(o => o.code === code && !o.included)) || new Set(options).size !== options.length) throw apiError("invalid_request", 400);
  if (consents.pre_contractual_information !== true || consents.general_conditions !== true || consents.data_processing !== true) throw apiError("consent_required", 422);
  const annual = pkg.price.annual + pkg.options.filter(o => options.includes(o.code)).reduce((sum, o) => sum + o.price.annual, 0);
  const monthly = pkg.price.monthly + pkg.options.filter(o => options.includes(o.code)).reduce((sum, o) => sum + o.price.monthly, 0);
  const starts = new Date(`${quote.delivery_date}T12:00:00Z`), ends = new Date(starts); ends.setUTCFullYear(ends.getUTCFullYear() + 1); ends.setUTCDate(ends.getUTCDate() - 1);
  const due = new Date(); due.setUTCDate(due.getUTCDate() + 14);
  return { contract_id: makeId("ctr"), policy_number: `ARD-FR-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000000) + 1000000)}`, status: "issued", starts_on: quote.delivery_date, ends_on: ends.toISOString().slice(0, 10), premium: { annual, monthly, frequency: body.frequency }, payment: { method: "atm_reference", entity: "21456", reference: String(Math.floor(Math.random() * 900000000) + 100000000), amount: body.frequency === "annual" ? annual : monthly, due_by: due.toISOString().slice(0, 10) } };
}
