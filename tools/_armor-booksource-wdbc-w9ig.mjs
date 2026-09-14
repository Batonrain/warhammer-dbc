import fs from "fs";
import path from "path";

const ROOT = "packs-src/armour-systems";

// folder -> [subsection label, pdfPage]
const FOLDER_INFO = {
  "Стандартные_системы": ["Стандартные Системы", 237],
  "Шлем": ["Нестандартные Системы: Шлем", 237],
  "Торс": ["Нестандартные Системы: Торс", 238],
  "Ранец": ["Нестандартные Системы: Ранец", 238],
  "Руки": ["Нестандартные Системы: Руки", 239],
  "Ноги": ["Нестандартные Системы: Ноги", 239],
};

// English names present in core.json for verification (from "IV. АРСЕНАЛ" / СИСТЕМЫ section)
const BOOK_NAMES = new Set([
  "Magnetized Boot Soles", "Reactive Pauldron Plates", "Vox Link", "Autosenses",
  "Nutrient Recycler", "Osmotic Life Sustainer", "Recoil Suppressors", "Bio-Monitor",
  "Sustainable Power Source",
  "Hunter Mode", "Y-Visor", "Infra-Horns", "Maw", "Phaeton Targeter",
  "Retractable Helmet", "Diagnostor Helmet",
  "Gorget", "Echo of Mutation", "Riddle of Maat", "Chain Bandoliers", "Shift Field",
  "Fleshmetal Reinforcement", "Hydra Coils", "Auramite Shielding",
  "Anvilus Stabilizer", "Mag-Dispenser", "Cognis Caster", "Heat Sinks", "Power Cable",
  "Servo-Orderly", "Heavy Power Cable", "Promethean Core", "Servo-Loader",
  "Saturnyne Servoturret",
  "Mag-Gloves", "Shock Knuckles", "Fibercord", "Rippling Braces", "Titan Vambrace",
  "Repulsor Gauntlets", "Selenite Void Gauntlets", "Shoulder Daemon",
  "Anchors", "Sabaton Blades", "Vox-Gargoyles", "Disruptor Emitters",
  "Maneuvring Thrusters", "Grav Springs", "Raptor Claws", "Selenite Void Greaves",
  "Y-Визор", // no separate english form in this pack item
]);

function normalize(s) {
  return s.replace(/[\s-]/g, "").toLowerCase();
}
const bookNormSet = new Set([...BOOK_NAMES].map(normalize));

let updated = 0;
let skipped = [];

for (const folder of fs.readdirSync(ROOT)) {
  const dirPath = path.join(ROOT, folder);
  if (!fs.statSync(dirPath).isDirectory()) continue;
  const info = FOLDER_INFO[folder];
  if (!info) {
    console.log("UNKNOWN FOLDER:", folder);
    continue;
  }
  const [label, page] = info;
  for (const file of fs.readdirSync(dirPath)) {
    if (!file.endsWith(".json") || file === "_Folder.json") continue;
    const filePath = path.join(dirPath, file);
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    const fullName = data.name || "";
    const engName = fullName.split("/")[0].trim();

    if (!bookNormSet.has(normalize(engName))) {
      skipped.push(filePath + ' :: "' + engName + '" not matched in book names');
      continue;
    }

    if (data.system.bookSource) {
      console.log("ALREADY SET, skipping:", filePath);
      continue;
    }

    const value = "DoomBC — Основная книга, IV. Арсенал («" + label + "», стр. " + page + ")";

    // Insert bookSource as last key of system object, preserving formatting via
    // text-level insertion right before the closing brace that matches "system": {
    const marker = '  "system": {';
    const idx = raw.indexOf(marker);
    if (idx === -1) throw new Error("no system marker in " + filePath);

    // find matching closing brace for the system object by counting braces
    let depth = 0;
    let i = idx + marker.length - 1; // position of opening brace
    let closeIdx = -1;
    for (; i < raw.length; i++) {
      if (raw[i] === "{") depth++;
      else if (raw[i] === "}") {
        depth--;
        if (depth === 0) {
          closeIdx = i;
          break;
        }
      }
    }
    if (closeIdx === -1) throw new Error("no matching close brace in " + filePath);

    // Find the last non-whitespace char before closeIdx to append a comma after it.
    let j = closeIdx - 1;
    while (/\s/.test(raw[j])) j--;
    const before = raw.slice(0, j + 1);
    const backslash = String.fromCharCode(92);
    const escaped = value.split(backslash).join(backslash + backslash).split('"').join(backslash + '"');
    const insertion = ",\n    \"bookSource\": \"" + escaped + "\"\n  ";
    const newRaw = before + insertion + raw.slice(closeIdx);

    // sanity parse
    JSON.parse(newRaw);
    fs.writeFileSync(filePath, newRaw, "utf-8");
    updated++;
  }
}

console.log("Updated:", updated);
if (skipped.length) {
  console.log("SKIPPED:");
  skipped.forEach(function (s) { console.log(" -", s); });
}
