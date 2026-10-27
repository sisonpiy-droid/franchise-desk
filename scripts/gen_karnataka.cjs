// Builds public/sample/karnataka-territories-dataset.xlsx: the case's seven allowed Karnataka cities only, one territory per city,
// the fixed existing-stores list, and 75 invented applicants (not real people) with a realistic mix of strong, weak and incomplete
// applications. Every value is one the case template allows. Deterministic: run again, get the same file.
// Run: node scripts/gen_karnataka.cjs
const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");
const root = path.resolve(__dirname, "..");
const wb = XLSX.readFile(path.join(root, "docs/Case1_Franchise_Test_Data_Format.xlsx"));

let seed = 20261026;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (xs) => xs[Math.floor(rnd() * xs.length)];

// ---- one territory per allowed city; pins are real pincodes of that city (existing-store pins are included on purpose) ----
const CITIES = [
  { city: "Bengaluru", tier: 1, id: "TER-01", slots: 4, prio: "High", n: 22, pins: [560002, 560003, 560008, 560011, 560012, 560024, 560030, 560037, 560041, 560001, 560034], inv: [30, 85], size: [450, 800], rent: 0.7 },
  { city: "Mysuru", tier: 2, id: "TER-02", slots: 3, prio: "High", n: 14, pins: [570001, 570002, 570004, 570008, 570011, 570009, 570017], inv: [20, 55], size: [320, 600], rent: 0.65 },
  { city: "Mangaluru", tier: 2, id: "TER-03", slots: 2, prio: "Medium", n: 10, pins: [575002, 575003, 575005, 575006, 575001], inv: [20, 55], size: [320, 600], rent: 0.7 },
  { city: "Hubballi-Dharwad", tier: 2, id: "TER-04", slots: 2, prio: "Medium", n: 9, pins: [580001, 580002, 580008, 580009, 580020], inv: [20, 50], size: [320, 600], rent: 0.6 },
  { city: "Belagavi", tier: 2, id: "TER-05", slots: 2, prio: "Low", n: 8, pins: [590003, 590005, 590006, 590008, 590001], inv: [18, 48], size: [320, 580], rent: 0.6 },
  { city: "Tumakuru", tier: 3, id: "TER-06", slots: 2, prio: "Medium", n: 7, pins: [572101, 572102, 572103, 572104], inv: [14, 40], size: [250, 450], rent: 0.55 },
  { city: "Davanagere", tier: 3, id: "TER-07", slots: 1, prio: "Low", n: 5, pins: [577002, 577003, 577004, 577005], inv: [14, 38], size: [250, 430], rent: 0.55 },
];
const STORE_PINS = new Set([560001, 560034, 560038, 560066, 560076, 570009, 570017, 575001, 580020, 590001]);

const territories = CITIES.map((c) => [c.id, c.city, "Karnataka", c.pins.join(", "), `Tier ${c.tier}`, c.slots, c.prio]);

// ---- names, businesses, notes ----
const FIRST = ["Ananya", "Karthik", "Meera", "Farhan", "Divya", "Raghav", "Sunita", "Tejas", "Usha", "Vikram", "Wasim", "Yamini", "Zubin", "Aarti", "Bharat", "Chitra", "Deepak", "Esha", "Firoz", "Gita", "Hemant", "Ishita", "Jayant", "Kavita", "Lokesh", "Mala", "Nitin", "Omkar", "Padma", "Rohit", "Sneha", "Tarun", "Uma", "Vinay", "Harini", "Girish", "Latha", "Mahesh", "Nalini", "Prakash", "Rekha", "Sanjay", "Shobha", "Suresh", "Anil", "Pooja", "Imran", "Lakshmi", "Manoj", "Savita"];
const LAST = ["Gowda", "Rao", "Shetty", "Hegde", "Bhat", "Naik", "Kamath", "Pai", "Kulkarni", "Patil", "Reddy", "Iyer", "Menon", "Kini", "Joshi", "Sheikh", "Khan", "Ali", "Desai", "Nayak"];
const BIZ = ["Runs a kirana store", "Runs a mobile accessories shop", "Owns a stationery store", "Runs a footwear store", "Ran a garment shop for several years", "Owns a pharmacy", "Runs a bakery and snacks counter", "Retail sales executive", "Runs a gift and toy shop", "Wholesale trader", "Runs a supermarket franchise", "Salaried, first business", "Runs a provision store", "Investor, no retail experience"];
const NOTE = [null, null, null, null, null, null, "Wants to open before Diwali", "Family business, will manage the store myself", "Can start fit-out immediately", "Have a bank loan approved for part of the amount", "Looking for a corner shop on the main road", "ದೀಪಾವಳಿಗೆ ಮೊದಲು ಅಂಗಡಿ ತೆರೆಯಬೇಕು", "मैं दिवाली से पहले दुकान खोलना चाहता हूँ", "Brother will help run the store", "Prefer a ground-floor shop near a bus stop"];
const LANG = ["Kannada", "Kannada", "Kannada", "English", "English", "Hindi"];

// ---- applications ----
const apps = [];
let n = 0;
const used = new Set();
for (const c of CITIES) {
  for (let i = 0; i < c.n; i++) {
    n++;
    const id = "APP-" + String(n).padStart(3, "0");
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const free = c.pins.filter((p) => !STORE_PINS.has(p));
    // most pick a free pin; a few pick a pin where we already have a store, which the rules must not allow
    const pin = rnd() < 0.1 ? pick(c.pins.filter((p) => STORE_PINS.has(p)).concat(free)) : pick(free);
    const strong = rnd() < 0.55;
    let invest = int(c.inv[0], c.inv[1]);
    if (!strong && rnd() < 0.5) invest = Math.max(8, Math.round(invest * 0.5)); // some are short of the estimate
    const exp = strong ? int(3, 12) : int(0, 4);
    const r = rnd();
    let space = r < c.rent ? "Rented" : r < c.rent + 0.2 ? "Owned" : "Not yet identified";
    let size = space === "Not yet identified" ? null : int(c.size[0], c.size[1]);
    let floor = space === "Not yet identified" ? null : pick(["Ground", "Ground", "Ground", "Upper", "Mall unit"]);
    if (space !== "Not yet identified" && rnd() < 0.05) { floor = "Not known"; }
    if (space !== "Not yet identified" && rnd() < 0.04) size = null; // a few forgot the size
    // make each property distinct so only real clashes are flagged
    while (size !== null && used.has(`${pin}|${size}|${floor}|${space}`)) size += 7;
    if (size !== null) used.add(`${pin}|${size}|${floor}|${space}`);
    const target = rnd() < 0.85 ? int(2, 9) : null;
    apps.push([id, name, c.city, "Karnataka", pin, invest, exp, pick(BIZ), space, size, floor, target, pick(LANG), pick(NOTE)]);
  }
}

// ---- write into the template, keeping its title rows, headers, example row and the fixed existing-stores sheet ----
const headRow = (sheet, key) => XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: null }).findIndex((r) => String(r[0]).trim() === key);
function fill(name, key, rows, cols) {
  const ws = wb.Sheets[name];
  const start = headRow(name, key) + 2; // after the grey example row
  for (let r = start; r < start + 300; r++) for (let c = 0; c < cols; c++) delete ws[XLSX.utils.encode_cell({ r, c })];
  XLSX.utils.sheet_add_aoa(ws, rows, { origin: { r: start, c: 0 } });
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: start + rows.length, c: cols - 1 } });
}
fill("Applications", "Application ID", apps, 14);
fill("Territories", "Territory ID", territories, 7);
fs.mkdirSync(path.join(root, "public/sample"), { recursive: true });
XLSX.writeFile(wb, path.join(root, "public/sample/karnataka-territories-dataset.xlsx"), { compression: true });
console.log("applications", apps.length, "territories", territories.length);
