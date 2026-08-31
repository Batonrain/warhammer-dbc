// tools/_mutation-mechanics-capability-batch2.mjs — wdbc-1rno, продолжение шага 3.
// 8 общих Мутаций, отсутствовавших в прежних списках памяти (Boneless/Breeze/
// Burned Senses/Feels No Pain/Majestic Horns/Miasma/Polymath/Soul-Seer) —
// похоже, добавлены параллельной сессией «Полнота книг» (doombc-book-
// completeness-sweep-2408) уже ПОСЛЕ того, как «75 из 75 общих Мутаций»
// считались полностью просмотренными. Проверено: ни одна не сводится к
// чистой Trait/Skill/Characteristic-выдаче (Feels No Pain — единственный
// правдоподобный кандидат на существующую Черту — grep по packs-src/traits
// не нашёл такой Черты в паке). Все 8 — та же capability-заглушка.
import "../test/support/foundry-stub.mjs";
import fs from "node:fs";
import { blankMechEntry, blankMechGroup } from "../module/apps/mechanics.mjs";

const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
globalThis.foundry.utils.randomID = (length = 16) =>
  Array.from({ length }, () => ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)]).join("");

const DIR = "packs-src/mutations/Общие_мутации/";

const ENTRIES = [
  ["Boneless___Бескостный_fNLAmI7mDoN2snia.json", "boneless",
    "+10 A, ½ I(Cr) Dmg до Поглощения, иммунитет к Критическим Эффектам переломов; без опоры в жёстком доспехе — Athletics+0 или Amorphous+Crawler (−20 S, −2 Unnatural S, +30 Карабканье); опционально Quadruped(1) с модифицированной бронёй — составной эффект, не кодируется частично"],
  ["Breeze___Бриз_G6nMXCGIrtrPE0T1.json", "breeze",
    "Пузырь 2м: игнор штрафов от ветра/жары/холода, воздушный пузырь в вакууме, игнор сопротивления воздуха (без предела терминальной скорости, без урона трения при входе в атмосферу)"],
  ["Burned_Senses___Выжженные_Чувства_wdK2ol57WftRckVd.json", "burnedSenses",
    "2 броска по таблице чувств (d10): перманентная потеря первого выпавшего чувства, +20 и переброс провалов на второе — случайный парный выбор при получении, не кодируется текущими полями"],
  ["Feels_No_Pain___Не_Чувствует_Боли_o2obuo2qcbqJcLDW.json", "feelsNoPain",
    "Не получает штраф −10 от Усталости, иммунен к пытке болью; риск пропустить опасные ранения/условия мимо внимания — не выданный Trait в паке (проверено grep, такой Черты нет)"],
  ["Majestic_Horns___Величественные_Рога_7gVtvzDAlpTU48cd.json", "majesticHorns",
    "+20 социальные тесты с Хаоситами/Орками; 10 субмутаций (щиты/AP/природное оружие с формулой/god-гейтнутые бонусы) не автоматизированы — см. текст"],
  ["Miasma___Миазмы_2iUVQFAPJQmFG2PT.json", "miasma",
    "Без гермодоспеха: штрафы на соц. взаимодействие/Stealth, +40 на выслеживание по запаху"],
  ["Polymath___Полимат_x3Nnc19t1Mqfo0Sf.json", "polymath",
    "+10 на тесты Крафта и Исследований (группы Навыков, не одиночный Навык — вне поля одиночной Skill-выдачи Конструктора); Крит на такомтесте — 1d5 Усталости + доп. тест немедленно"],
  ["Soul_Seer___Душевидец_aVxEkP6L4xj4LVaj.json", "soulSeer",
    "Видит души/духов машин/демонов на 10м сквозь преграды, наслаивается на обычное зрение (мешает читать мимику/детали у ярких псайкеров)"]
];

let count = 0;
const toRegister = [];
for (const [file, slug, label] of ENTRIES) {
  const full = DIR + file;
  const doc = JSON.parse(fs.readFileSync(full, "utf8"));
  const groups = doc.flags?.["warhammer-dbc"]?.mechanics || [];
  if (groups.length > 0) { console.log("already has mechanics, skip:", full); continue; }
  const e = blankMechEntry("capability");
  e.id = `${slug}-cap`;
  e.capabilityKey = `mutation.${slug}`;
  doc.flags ??= {};
  doc.flags["warhammer-dbc"] ??= {};
  const g = blankMechGroup("AND");
  g.entries = [e];
  doc.flags["warhammer-dbc"].mechanics = [g];
  fs.writeFileSync(full, JSON.stringify(doc, null, 2) + "\n");
  count++;
  toRegister.push({ key: `mutation.${slug}`, label, name: doc.name });
}

const CAP_FILE = "module/constants/capabilities.mjs";
let capSrc = fs.readFileSync(CAP_FILE, "utf8");
let block = "\n  // ── Общие мутации, партия 2 (wdbc-1rno) — заглушка данными, reader пуст сознательно ──\n";
for (const { key, label, name } of toRegister) {
  block += `  "${key}": {\n` +
    `    label: ${JSON.stringify(label)},\n` +
    `    source: "Мутация: ${name.split(" / ")[0]} (Общие мутации)",\n` +
    `    reader: ""\n` +
    `  },\n`;
}
const marker = "\n};";
const idx = capSrc.lastIndexOf(marker);
capSrc = capSrc.slice(0, idx) + block + capSrc.slice(idx);
fs.writeFileSync(CAP_FILE, capSrc);

console.log(`OK: ${count} мутаций получили capability-запись, ${toRegister.length} ключей зарегистрировано`);
