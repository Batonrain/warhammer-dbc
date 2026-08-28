// tools/_mutation-mechanics-capability-batch3.mjs — wdbc-1rno.
// «Иллюзия Нормальности» была в исходном списке 13 «активная/переключаемая
// способность» (память doombc-mutations-mechanics-authoring), но выпала из
// партии batch1 (12 из 13 обработаны) — досмотрено и закрыто здесь.
import "../test/support/foundry-stub.mjs";
import fs from "node:fs";
import { blankMechEntry, blankMechGroup } from "../module/apps/mechanics.mjs";

const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
globalThis.foundry.utils.randomID = (length = 16) =>
  Array.from({ length }, () => ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)]).join("");

const file = "packs-src/mutations/Общие_мутации/Illusion_of_Normality___Иллюзия_Нормальн_1GO1WxLJ6dhOw8n1.json";
const doc = JSON.parse(fs.readFileSync(file, "utf8"));
const groups = doc.flags?.["warhammer-dbc"]?.mechanics || [];
if (groups.length > 0) {
  console.log("already has mechanics, skip:", file);
} else {
  const e = blankMechEntry("capability");
  e.id = "illusion-of-normality-cap";
  e.capabilityKey = "mutation.illusionOfNormality";
  doc.flags ??= {};
  doc.flags["warhammer-dbc"] ??= {};
  const g = blankMechGroup("AND");
  g.entries = [e];
  doc.flags["warhammer-dbc"].mechanics = [g];
  fs.writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");

  const CAP_FILE = "module/constants/capabilities.mjs";
  let capSrc = fs.readFileSync(CAP_FILE, "utf8");
  const block = "\n  // ── Общие мутации, партия 3 (wdbc-1rno) — заглушка данными, reader пуст сознательно ──\n" +
    `  "mutation.illusionOfNormality": {\n` +
    `    label: "Игнорируется наблюдателями как мутант, оружие/броня не привлекают внимания; активная поддерживаемая иллюзия, засекается Пси-чутьём (+5 за каждую прочую мутацию), псайкеры видят сквозь неё тестом W+0 (раз за бой/сцену)",\n` +
    `    source: "Мутация: Illusion of Normality (Общие мутации)",\n` +
    `    reader: ""\n` +
    `  },\n`;
  const marker = "\n};";
  const idx = capSrc.lastIndexOf(marker);
  capSrc = capSrc.slice(0, idx) + block + capSrc.slice(idx);
  fs.writeFileSync(CAP_FILE, capSrc);
  console.log("OK:", file);
}
