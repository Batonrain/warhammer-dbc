// tools/_j1nc-batch2.mjs — wdbc-j1nc, партия 2: разнородные чистые кандидаты,
// найденные при ручном чтении первых ~80 записей + ключевом скане (Переброс,
// testMod, wounds-kind, legacy fearRating/initMod/speedMod). Каждая запись
// читалась целиком перед решением. Одноразовый скрипт.
import "../test/support/foundry-stub.mjs";
import fs from "node:fs";
import { legacyEffectsToChanges } from "../module/constants/effect-keys.mjs";

const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
globalThis.foundry.utils.randomID = (length = 16) =>
  Array.from({ length }, () => ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)]).join("");

function load(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function save(file, doc) { fs.writeFileSync(file, JSON.stringify(doc, null, 2) + "\n"); }

function addNativeEffect(doc, changes) {
  const effId = foundry.utils.randomID();
  doc.effects = doc.effects || [];
  doc.effects.push({
    name: `${doc.name} (перенесено)`, system: { changes }, _id: effId, img: doc.img,
    type: "base", disabled: false, start: null,
    duration: { value: null, units: "seconds", expiry: null, expired: false },
    description: "", origin: null, tint: "#ffffff", transfer: true, statuses: [],
    showIcon: 1, folder: null, sort: 0, flags: {},
    _stats: { coreVersion: "14.365", systemId: "warhammer-dbc", systemVersion: "0.1.0",
      createdTime: Date.now(), modifiedTime: Date.now(), lastModifiedBy: null,
      compendiumSource: null, duplicateSource: null, exportSource: null },
    _key: `!items.effects!${doc._id}.${effId}`
  });
  doc.flags ??= {};
  doc.flags["warhammer-dbc"] ??= {};
  doc.flags["warhammer-dbc"].migratedEffect = true;
}

function setMechanics(doc, entries) {
  doc.flags ??= {};
  doc.flags["warhammer-dbc"] ??= {};
  doc.flags["warhammer-dbc"].mechanics = [{
    id: foundry.utils.randomID(), operator: "AND", entries
  }];
}

function mkEntry(kind, extra) {
  return {
    id: foundry.utils.randomID(), kind, group: null,
    corruptionValue: "1", woundsValue: "1", cohesionRole: "any", cohesionValue: "1",
    charKey: "s", field: "total", op: "add", value: 1,
    sourceUuid: "", sourceName: "", sourceImg: "", sourceHasRating: false, rating: "", specialization: "",
    minionGroup: "", minionTier: "",
    skillScope: "plain", skillKey: "", specKey: "", specialty: "",
    specChoiceKeys: [], specChoiceCount: 1, rank: "untrained",
    weightScope: "all", weightMode: "kg", weightValue: 1,
    movementTarget: "spd", movementValue: 1,
    armourLocation: "body", armourValue: 1,
    ignoreTerrainProps: [],
    rerollScope: "all", rerollChar: "ag", rerollMode: "keepBest", rerollWho: "self",
    modScope: "all", modValueMode: "flat", modCharBonus: "inf",
    capabilityKey: "",
    fatigueAction: "threshold", fatigueThresholdChar: "t",
    equipMode: "direct", equipQty: 1,
    equipSourceUuid: "", equipSourceName: "", equipSourceImg: "",
    equipCategoryPack: "weapons", equipWeaponType: "", equipWeaponProp: "",
    equipArmorType: "", equipMaxAvailability: 5,
    equipQuality: "common", equipTalentTier: "", equipMaxPsyRating: "", equipImplantCategory: "",
    equipBudgetMode: "count", equipBudgetValue: 1,
    loyaltyMinionType: "", loyaltyOp: "add", loyaltyValue: 1,
    auraRadius: "1", auraAffects: "allies", auraIncludesSelf: false,
    weaponPropAction: "add",
    weaponPropKey: "", weaponPropLabel: "", weaponPropHasRating: false, weaponPropHasRating2: false,
    weaponPropValue: "1", weaponPropValue2: "0",
    weaponPropNewKey: "", weaponPropNewLabel: "", weaponPropNewHasRating: false, weaponPropNewHasRating2: false,
    weaponPropNewValue: "1", weaponPropNewValue2: "0",
    label: "", code: "",
    when: { negate: false, conditions: [] },
    ...extra
  };
}

// 1) Amphibious / Амфибия — «перебрасывает все тесты Плавания»; книга
// (core.json, стр. 30) прямо называет тест Плавания тестом на Athletics —
// не гадание, подтверждённое соответствие. Дышит водой/не тонет — не тест,
// автоматизировать нечего (в движке нет правил утопления).
{
  const f = "packs-src/traits/Amphibious___Амфибия_AE4vEU0dsm1gU2UA.json";
  const doc = load(f);
  setMechanics(doc, [mkEntry("reroll", { rerollScope: "skill", skillKey: "athletics", label: "Амфибия (Плавание = Athletics)" })]);
  save(f, doc);
  console.log("OK:", doc.name);
}

// 2) Barefoot / Босоногий — «+20 Stealth (бесшумность)», единственный
// заявленный эффект, чистый testMod.
{
  const f = "packs-src/traits/Barefoot___Босоногий_3MsfNfn6Ihq7Q0zq.json";
  const doc = load(f);
  setMechanics(doc, [mkEntry("testMod", { modScope: "skill", skillKey: "stealth", modValueMode: "flat", value: 20, label: "Босоногий (Скрытность)" })]);
  save(f, doc);
  console.log("OK:", doc.name);
}

// 3) Fear (1) / Страх — «Рейтинг Страха 1», ровно существующее legacy-поле.
{
  const f = "packs-src/traits/Элитные_архетипы/Длань_Архонта/Fear__1____Страх_pvI3ruSz2QyzPE4s.json";
  const doc = load(f);
  doc.system.effects.fearRating = 1;
  addNativeEffect(doc, legacyEffectsToChanges(doc.system.effects));
  save(f, doc);
  console.log("OK:", doc.name);
}

// 4) Sure Tread / Надёжная Поступь — «−1 SPD» (знак уже поправлен книжной
// сверкой 23.08, см. память doombc-talents-traits-audit). Остаток (замена A
// на Awareness на Трудном Ландшафте, «3+ Успеха — не замедляет») — бespoke
// диалог movement-terrain.mjs, не читает testMod/подмену характеристики.
{
  const f = "packs-src/traits/Sure_Tread___Над_жная_Поступь_RZ8eDsBa4H4r9l99.json";
  const doc = load(f);
  doc.system.effects.speedMod = -1;
  addNativeEffect(doc, legacyEffectsToChanges(doc.system.effects));
  doc.system.notes = "Механикой не выражено: на Трудном Ландшафте использует Awareness(P) вместо Athletics(A), и при 3+ Успехах ландшафт не замедляет вовсе — диалог movement-terrain.mjs жёстко использует Ag и не читает подмену характеристики/testMod.";
  save(f, doc);
  console.log("OK:", doc.name);
}

// 5) Brute Physiology / Физиология Громилы — «+15 к максимуму Ран» через
// реальный kind:"wounds" (применяется разово при выдаче + откат при
// удалении, тот же канал, что у Происхождений). Остаток — штрафы на
// немодифицированное оружие (условие «без свойства Ogrynized», не входит в
// область testMod) и помеха тонкой моторике (без числа) — в notes.
{
  const f = "packs-src/traits/Brute_Physiology___Физиология_Громилы_ZM5JfxTzLTfByO46.json";
  const doc = load(f);
  setMechanics(doc, [mkEntry("wounds", { op: "add", woundsValue: "15", label: "Физиология Громилы (Раны)" })]);
  doc.system.notes = "Механикой не выражено: −10 на оружие без свойства Ogrynized и −20 на стрелковое (условие «отсутствие свойства оружия», вне области testMod), помеха тонкой ручной работе (без числа в тексте).";
  save(f, doc);
  console.log("OK:", doc.name);
}

// 6) Sslyth Physiology / Физиология Сслита — крупный композит. Механизированы
// только 2 чистых плоских числа: +15 к максимуму Ран (kind:"wounds") и +4 к
// Инициативе (legacy initMod). Всё остальное — ins иммунитеты/условные
// бонусы/новая конечность с Unnatural S — в notes.
{
  const f = "packs-src/traits/Трейты_рас/Sslyth_Physiology___Физиология_Сслита_OZN2S1JapucmgHVb.json";
  const doc = load(f);
  doc.system.effects.initMod = 4;
  addNativeEffect(doc, legacyEffectsToChanges(doc.system.effects));
  setMechanics(doc, [mkEntry("wounds", { op: "add", woundsValue: "15", label: "Физиология Сслита (Раны)" })]);
  doc.system.notes = "Механикой не выражено: иммунитет к ядам/пост-эффектам/зависимости, ускоренная регенерация (+1 Рана/сутки, лечение как Космодесантник), авто-остановка кровотечения тестом T+0, «Избегание атак Орды/Троек как одиночных» (теряется при Размере 2+), хвост как пара рук с Unnatural S(6) и +30 Athletics на Захват/Борьбу, Unnatural Senses(60) на кровь, блокировка боли, +20/+40 против ментальных воздействий с W.b перебросов/день, устойчивость к холоду (тест T+0/час, порог на 4-й провал). Композит из ~10 разных механик без единого числового поля.";
  save(f, doc);
  console.log("OK:", doc.name);
}

// 7) Lumbering Giant / Громыхающий Гигант — «+10 Ран» (kind:"wounds").
// Запрет Бега/Прыжков/SPD×3 и авто-провал Stealth — поведенческие
// ограничения без противоположного числового поля (testMod не умеет
// «гарантированный провал»).
{
  const f = "packs-src/traits/Элитные_архетипы/Секутор/Lumbering_Giant___Громыхающий_Гигант_N4cmYUjXmhCbC3Mm.json";
  const doc = load(f);
  setMechanics(doc, [mkEntry("wounds", { op: "add", woundsValue: "10", label: "Громыхающий Гигант (Раны)" })]);
  doc.system.notes = "Механикой не выражено: запрет Бега/Прыжков/движения SPD×3 (кроме телепортации) и гарантированный провал тестов Stealth на бесшумность — оба поведенческие ограничения, testMod/reroll не поддерживают «всегда провал» или запрет конкретного действия.";
  save(f, doc);
  console.log("OK:", doc.name);
}

console.log("\nГотово.");
