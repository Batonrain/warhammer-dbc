// tools/_gift-active-ability-slaanesh-batch1.mjs
// wdbc-suwp — партия 3 (Дары Слаанеш): перевод из kind:"capability"-заглушки
// в реальный kind:"script". Одноразовый инструмент, не удалять до
// подтверждения, что содержимое ушло в компендиум.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "packs-src/mutations/Дары_Богов/Слаанеш");

function blankEntry(id) {
  return {
    id, kind: "script",
    group: null,
    corruptionValue: "1",
    woundsValue: "1",
    cohesionRole: "any", cohesionValue: "1",
    charKey: "s", field: "total", op: "add", value: 1,
    sourceUuid: "", sourceName: "", sourceImg: "", sourceHasRating: false, rating: "", specialization: "",
    minionGroup: "", minionTier: "",
    skillScope: "plain", skillKey: "", specKey: "", specialty: "",
    specChoiceKeys: [], specChoiceCount: 1, rank: "untrained",
    weightScope: "all", weightMode: "kg", weightValue: 1,
    movementTarget: "spd", movementValue: 1,
    armourLocation: "body", armourValue: 1,
    ignoreTerrainProps: [],
    rerollScope: "all", rerollChar: "ag", rerollMode: "keepBest",
    modScope: "all", modValueMode: "flat", modCharBonus: "inf",
    rerollWho: "self",
    capabilityKey: "",
    capabilityCostPool: "", capabilityCostAmount: 1,
    capabilityMode: "flag", capabilityAptScope: "skill",
    capabilityAptMatch: "", capabilityAptAlign: "ally",
    fatigueAction: "threshold", fatigueThresholdChar: "t",
    equipMode: "direct", equipQty: 1,
    equipSourceUuid: "", equipSourceName: "", equipSourceImg: "",
    equipCategoryPack: "weapons", equipWeaponType: "", equipWeaponProp: "",
    equipArmorType: "", equipMaxAvailability: 5,
    equipQuality: "common", equipTalentTier: "", equipMaxPsyRating: "", equipImplantCategory: "",
    equipPrRequiredDelta: 0,
    equipBudgetMode: "count", equipBudgetValue: 1,
    loyaltyMinionType: "", loyaltyOp: "add", loyaltyValue: 1,
    auraRadius: "1", auraAffects: "allies", auraIncludesSelf: false,
    auraImmuneTraits: "",
    weaponPropAction: "add",
    weaponPropKey: "", weaponPropLabel: "", weaponPropHasRating: false, weaponPropHasRating2: false,
    weaponPropValue: "1", weaponPropValue2: "0",
    weaponPropNewKey: "", weaponPropNewLabel: "", weaponPropNewHasRating: false, weaponPropNewHasRating2: false,
    weaponPropNewValue: "1", weaponPropNewValue2: "0",
    label: "", code: "",
    scriptThrottleUnit: "", scriptThrottleMax: 1,
    when: { negate: false, conditions: [] }
  };
}

function reminderCard(title, text) {
  return `await ChatMessage.create(ChatMessage.applyRollMode({
  speaker,
  content: \`<div class="wh-roll-result">
    <div class="roll-header">${title} — \${actor.name}</div>
    <div class="roll-threshold">${text}</div>
  </div>\`
}, game.settings.get("core", "rollMode")));`;
}

const BATCH = [
  {
    file: "Idol_of_Vanity___Идол_Тщеславия_nA2TV4qVVucoMyfn.json",
    group: "yA6aopk0769EXbz1",
    oldEntryId: "idolOfVanity-cap",
    newEntryId: "idolOfVanity-script",
    label: "Идол Тщеславия",
    scriptThrottleUnit: "round",
    code: reminderCard(
      "Идол Тщеславия",
      "Раз в Раунд: +5 к одному тесту чемпиона за каждого видящего его подчинённого/Миньона (+10 за орду) под контролем — взамен каждый из них получает −10 на все тесты до начала следующего Хода чемпиона (применить обе стороны вручную, движок не считает подчинённых/орды и не трогает их листы). Засекается пси-чутьём как психосила."
    )
  },
  {
    file: "Narcissus___Нарцисс_8qxZRIA1IT3N7h2k.json",
    group: "qtf0hKMf5gB5XXQL",
    oldEntryId: "narcissus-cap",
    newEntryId: "narcissus-script",
    label: "Нарцисс",
    scriptThrottleUnit: "round",
    // "Раз за Ход" в тексте — тем же приближением, что и везде в этой партии,
    // гейтится ближайшим доступным юнитом "round" (боевой раунд), не
    // отдельным понятием «свой Ход». Реальный бросок W+30 и ветвление
    // Успех/Провал НЕ автоматизированы — тест ведёт стол стандартным
    // диалогом брос­ка (та же честность, что и остальная партия).
    code: reminderCard(
      "Нарцисс",
      "Первый раз за Ход, увидев своё отражение: тест W+30. Успех — 1 Очко Бесчестия, пропадает в начале следующего Хода, если не потрачено. Провал — Ступор 1 Раунд. Полудействием можно поймать отражение в бликах (прицел/линзы шлема) тестом Awareness+10."
    )
  }
];

let changed = 0;
for (const spec of BATCH) {
  const filePath = path.join(DIR, spec.file);
  const doc = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const group = doc.flags["warhammer-dbc"].mechanics.find(g => g.id === spec.group);
  const idx = group.entries.findIndex(e => e.id === spec.oldEntryId);
  if (idx === -1) throw new Error(`${spec.file}: запись ${spec.oldEntryId} не найдена`);

  const entry = blankEntry(spec.newEntryId);
  entry.label = spec.label;
  entry.code = spec.code;
  entry.scriptThrottleUnit = spec.scriptThrottleUnit || "";
  entry.capabilityCostPool = spec.costPool || "";
  entry.capabilityCostAmount = spec.costAmount || 1;
  group.entries[idx] = entry;

  fs.writeFileSync(filePath, JSON.stringify(doc, null, 2) + "\n", "utf8");
  changed++;
  console.log(`OK ${spec.file}`);
}
console.log(`Готово: ${changed}/${BATCH.length} файлов`);
