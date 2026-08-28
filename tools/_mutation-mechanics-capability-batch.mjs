// tools/_mutation-mechanics-capability-batch.mjs — wdbc-1rno, шаг 3.
// Капабилити-заглушка (та же конвенция, что у Даров) для 12 общих Мутаций из
// старого списка ОТЛОЖЕНО «просто активная/переключаемая способность,
// кандидаты на kind:"script"» (см. память doombc-mutations-mechanics-authoring).
// Дуллахан ВКЛЮЧЁН, в отличие от прежнего решения «не кодировать даже чистую
// часть» — тогда опасались, что голая Multiple Arms(6) выглядела бы чистым
// плюсом без своей платы (Размер −2, странный SPD, все попадания в голову);
// капабилити-заглушка снимает это возражение — она не выдаёт Multiple Arms
// вовсе, только именованный флаг-плейсхолдер на весь составной эффект разом.
import "../test/support/foundry-stub.mjs";
import fs from "node:fs";
import { blankMechEntry, blankMechGroup } from "../module/apps/mechanics.mjs";

const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
globalThis.foundry.utils.randomID = (length = 16) =>
  Array.from({ length }, () => ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)]).join("");

const DIR = "packs-src/mutations/Общие_мутации/";

const ENTRIES = [
  ["Spatial_Instability___Пространственная_Н_snC2SuoOr50nguld.json", "spatialInstability",
    "Раз в 12−Cor.b ч, свободное действие: Трейт Incorporeal на Cor.b Раундов или до возврата; 10 god-гейтнутых субмутаций не автоматизированы (см. текст)"],
  ["Eyes_of_Chaos___Глаза_Хаоса_U5BlbfojB0YMxHAf.json", "eyesOfChaos",
    "Awareness+0 раз в Ход при мистическом событии — видит потоки психической энергии, Избегает Незримых психоатак; Forbidden Lore(Psykers)+0 для интерпретации; 10 субмутаций не автоматизированы"],
  ["Janus___Янус_eLDRGEq34e06UAYC.json", "janus",
    "Полудействие: доп. глаза/рот перемещаются в любую точку тела (обзор назад/за угол, независимая речь)"],
  ["Pure_Form___Чистая_Форма_kIXYDjqaaeSgrpkY.json", "pureForm",
    "1 час концентрации подавляет все мутации (теряя их эффекты), ещё 1 час возвращает их; Оглушение/потеря сознания/добровольный возврат — рывок 1d10 непогл. R Dmg + мгновенный возврат всех мутаций"],
  ["Twins___Близнецы_4ZbCZVle20Jt3HCG.json", "twins",
    "Раз в Раунд, свободное действие: переключение между двумя независимыми телами (раздельные Раны/снаряжение, второе тело чистое)"],
  ["Compression___Сжатие_e2b8gFhuqIdh3MxY.json", "compression",
    "Получив попадание в конечность/голову (доступно Уклонение) — тратит Реакцию вместо Уклонения, втягивает часть тела в торс (снимая попадание, втягивая броню/снаряжение); полудействие возвращает одну часть обратно; втянутая голова = слепота, втянутые ноги = мобильность вниз"],
  ["Mist_Transformation___Трансформация_Тума_YoeOledeqOMPFmmB.json", "mistTransformation",
    "Cor.b раз/сутки (не чаще раза в 10−Cor.b Раундов), полудействие: превращение в облако дыма 5м (нематериален/неуязвим, Flyer(A.b×2)) на Cor.b минут, растворяет до Cor.b согласных союзников"],
  ["Icon_of_Blasphemy___Икона_Богохульства_Tn9OOFtNi3DjQjR3.json", "iconOfBlasphemy",
    "Раз за бой/сцену, свободное действие: иллюзия на 1 Раунд — Имперцы видящие проходят W+0 или впадают в Ярость (атакуя только чемпиона); засекшие пси-чутьём/ноосканированием — W+0 или обязаны атаковать его следующий Ход"],
  ["Sentient_Cyst___Разумная_Циста_Zrcc0H6ZPrm0RwB5.json", "sentientCyst",
    "Провал теста социального взаимодействия — доп. +3 Провала (циста вмешивается в речь)"],
  ["Fruit_of_Flesh___Плод_Плоти_wXNtsm6KLNUcLkNO.json", "fruitOfFlesh",
    "Не чаще раза в сутки: втягивает конкретную опасность (урон/ЭМИ/дым/пламя/Оглушение/яд/психоатака/осколки — по субмутации) в плод-предмет с отложенным эффектом; 12 субмутаций не автоматизированы (см. текст)"],
  ["Armour_of_the_Gods___Доспехи_Богов_Y0m7niJ3HrX1xlXu.json", "armourOfTheGods",
    "Даёт элитный Архетип «Броненосец» (стр. 156) без траты опыта, Божественные Латы сливаются с текущей бронёй по лучшим характеристикам; недоступно Астартес/Механикум — выдача элитного архетипа вне полей Конструктора"],
  ["Dullahan___Дуллахан_r2oZnN2JG1ksCkro.json", "dullahan",
    "Размер −2 (SPD как у Размера 0), все попадания — в голову, волосы-щупальца = Multiple Arms(6) c платой 2 конечности на стойку/4 на ходьбу, регенерируют мгновенно — составной эффект, не кодируется частично (см. память)"]
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
let block = "\n  // ── Общие мутации (wdbc-1rno) — активные/переключаемые способности,\n" +
  "  // заглушка данными, reader пуст сознательно ──\n";
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
