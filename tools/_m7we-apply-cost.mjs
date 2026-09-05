// Проставляет цену Очком Бесчестия записям «Возможность», которые по книге
// целиком сводятся к «потратить Очко и сделать X» (wdbc-m7we).
//
// Идемпотентен: запись, уже несущая цену, не трогается. Список закрытый и
// совпадает с PAID в test/rules/capability-cost-in-packs.test.mjs — смешанные
// подписи (платное действие плюс пассивка в одной записи) сюда не входят
// намеренно, кнопка списывала бы очко и за пассивку.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PAID = [
  "gift.khorne.eyeOfChallenge",
  "gift.khorne.redSun",
  "gift.khorne.theHunter",
  "gift.tzeentch.akashicLibrary",
  "gift.tzeentch.hiddenThreat",
  "gift.tzeentch.wishGranter",
  "gift.tzeentch.sundering",
  "rune.beastmanShaman.boneRuneEtching.slaaneshVariant"
];

const DRY = !process.argv.includes("--write");

const filesIn = (dir) => readdirSync(dir, { withFileTypes: true, recursive: true })
  .filter(e => !e.isDirectory() && e.name.endsWith(".json"))
  .map(e => join(e.parentPath ?? e.path, e.name));

let touched = 0;
let already = 0;
const missing = new Set(PAID);

for (const file of filesIn("packs-src")) {
  const raw = readFileSync(file, "utf8");
  if (!raw.includes('"capabilityKey"')) continue;
  let doc;
  try { doc = JSON.parse(raw); } catch { continue; }

  let changed = false;
  const dig = (o) => {
    if (Array.isArray(o)) return o.forEach(dig);
    if (!o || typeof o !== "object") return;
    if (typeof o.capabilityKey === "string" && PAID.includes(o.capabilityKey)) {
      missing.delete(o.capabilityKey);
      if (o.capabilityCostPool === "infamy") { already++; }
      else {
        o.capabilityCostPool = "infamy";
        o.capabilityCostAmount = 1;
        changed = true;
        touched++;
        console.log(`${DRY ? "[сухой] " : ""}+ ${o.capabilityKey.padEnd(48)} ${doc.name}`);
      }
    }
    for (const v of Object.values(o)) dig(v);
  };
  dig(doc.flags);
  if (changed && !DRY) writeFileSync(file, JSON.stringify(doc, null, 2) + "\n", "utf8");
}

console.log(`\nпроставлено: ${touched}, уже было: ${already}, без носителя: ${missing.size}`);
for (const k of missing) console.log("  НЕ НАЙДЕН НОСИТЕЛЬ: " + k);
