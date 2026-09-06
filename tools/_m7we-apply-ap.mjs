// Цена в Очках Действия записям «Возможность», где действие — ЕДИНСТВЕННАЯ
// цена по книге (wdbc-m7we). Идемпотентен.
//
// Список закрытый и намеренно узкий. Не входят:
// • смешанные («Полудействие+1R себе», «Полное действие+1 Бесчестия») — поле
//   цены одно, вторая половина молча потерялась бы;
// • те, где действие названо УСЛОВИЕМ, а не ценой («Закончил Ход с
//   непотраченным полудействием»);
// • те, где рядом с платным действием есть постоянный эффект.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const AP = {
  "gift.khorne.fatherOfBattle": 1,      // Полудействие: видение
  "gift.nurgle.unseenBeggar": 1,        // полудействие накладывает морок
  "gift.tzeentch.etherealSwarm": 2,     // Полное действие: призыв Крикунов
  "mutation.janus": 1                   // Полудействие: перемещение глаз/рта
};

const DRY = !process.argv.includes("--write");
const filesIn = (dir) => readdirSync(dir, { withFileTypes: true, recursive: true })
  .filter(e => !e.isDirectory() && e.name.endsWith(".json"))
  .map(e => join(e.parentPath ?? e.path, e.name));

let touched = 0, already = 0;
const missing = new Set(Object.keys(AP));
for (const file of filesIn("packs-src")) {
  const raw = readFileSync(file, "utf8");
  if (!raw.includes('"capabilityKey"')) continue;
  let doc; try { doc = JSON.parse(raw); } catch { continue; }
  let changed = false;
  const dig = (o) => {
    if (Array.isArray(o)) return o.forEach(dig);
    if (!o || typeof o !== "object") return;
    const want = AP[o.capabilityKey];
    if (typeof o.capabilityKey === "string" && want) {
      missing.delete(o.capabilityKey);
      if (o.capabilityCostPool === "action") already++;
      else if (o.capabilityCostPool) console.log(`! ${o.capabilityKey}: уже есть другая цена «${o.capabilityCostPool}», не трогаю`);
      else {
        o.capabilityCostPool = "action";
        o.capabilityCostAmount = want;
        changed = true; touched++;
        console.log(`${DRY ? "[сухой] " : ""}+ ${o.capabilityKey.padEnd(34)} ${want} ОД   ${doc.name}`);
      }
    }
    for (const v of Object.values(o)) dig(v);
  };
  dig(doc.flags);
  if (changed && !DRY) writeFileSync(file, JSON.stringify(doc, null, 2) + "\n", "utf8");
}
console.log(`\nпроставлено: ${touched}, уже было: ${already}, без носителя: ${missing.size}`);
for (const k of missing) console.log("  НЕ НАЙДЕН НОСИТЕЛЬ: " + k);
