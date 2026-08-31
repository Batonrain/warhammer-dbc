// tools/_j1nc-survey.mjs — wdbc-j1nc, разведка: сколько Черт УЖЕ решены
// (native effects[] / flags.mechanics / непустой system.notes) vs сколько
// реально осталось прочитать. Одноразовый скрипт.
import fs from "node:fs";
import path from "node:path";

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.name.endsWith(".json") && entry.name !== "_Folder.json") out.push(p);
  }
  return out;
}

const files = walk("packs-src/traits");
let decided = 0, undecided = 0;
const undecidedList = [];

for (const f of files) {
  const doc = JSON.parse(fs.readFileSync(f, "utf8"));
  const hasNativeEffect = Array.isArray(doc.effects) && doc.effects.length > 0;
  const hasMechanics = Array.isArray(doc.flags?.["warhammer-dbc"]?.mechanics) && doc.flags["warhammer-dbc"].mechanics.length > 0;
  const hasNotes = typeof doc.system?.notes === "string" && doc.system.notes.trim().length > 0;
  const hasCapabilityKey = JSON.stringify(doc.flags ?? {}).includes("capabilityKey");
  if (hasNativeEffect || hasMechanics || hasNotes || hasCapabilityKey) {
    decided++;
  } else {
    undecided++;
    undecidedList.push({
      file: f,
      name: doc.name,
      benefit: doc.system?.benefit ?? "",
      description: doc.system?.description ?? "",
      hasRating: doc.system?.hasRating ?? false,
    });
  }
}

console.log(`Всего: ${files.length}, решено: ${decided}, осталось: ${undecided}`);
fs.writeFileSync("tools/_j1nc-undecided.jsonl", undecidedList.map(o => JSON.stringify(o)).join("\n") + "\n");
console.log("Список несделанных -> tools/_j1nc-undecided.jsonl");
