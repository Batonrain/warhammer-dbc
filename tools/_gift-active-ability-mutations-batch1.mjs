// tools/_gift-active-ability-mutations-batch1.mjs
// wdbc-suwp — партия 5, последняя (общие мутации): перевод из
// kind:"capability"-заглушки в реальный kind:"script". Illusion of Normality
// НАМЕРЕННО не входит в эту партию — при чтении текста оказалась постоянно
// действующей пассивной иллюзией без активации (ложное срабатывание
// автоматического фильтра по слову «поддерживаемая»), а не активной
// способностью — остаётся kind:"capability" как раньше. Одноразовый
// инструмент, не удалять до подтверждения, что содержимое ушло в компендиум.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "packs-src/mutations/Общие_мутации");

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
    file: "Eyes_of_Chaos___Глаза_Хаоса_U5BlbfojB0YMxHAf.json",
    group: "FgQeMEbBBOaiZkFh",
    oldEntryId: "eyesOfChaos-cap",
    newEntryId: "eyesOfChaos-script",
    label: "Глаза Хаоса",
    scriptThrottleUnit: "round",
    code: reminderCard(
      "Глаза Хаоса",
      "Раз в Ход, когда в поле зрения происходит нечто мистическое: тест Awareness+0. Успех — видит потоки психической энергии как свет (не сквозь преграды, обычный угол обзора), Избегает Незримых психических атак. Forbidden Lore (Psykers)+0, чтобы понять увиденное. 10 god-гейтнутых субмутаций из текста не автоматизированы."
    )
  },
  {
    file: "Twins___Близнецы_4ZbCZVle20Jt3HCG.json",
    group: "wGIJZlLeUg3hFSh6",
    oldEntryId: "twins-cap",
    newEntryId: "twins-script",
    label: "Близнецы",
    scriptThrottleUnit: "round",
    code: reminderCard(
      "Близнецы",
      "Раз в Раунд, свободное действие: переключение между двумя независимыми телами (рябь искажённого пространства). Второе тело при создании без снаряжения/бионики/травм/шрамов, но идентично основному (включая мутации), с собственными Ранами. Снаряжение отброшенного тела исчезает, заменяясь снаряжением нового — применить вручную (движок не хранит второй лист персонажа)."
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
