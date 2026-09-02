// tools/_gift-active-ability-nurgle-batch1.mjs
// wdbc-suwp — партия 2 (Дары Нургла, продолжение партии Кхорна): перевод из
// kind:"capability"-заглушки в реальный kind:"script". Одноразовый
// инструмент, не удалять до подтверждения, что содержимое ушло в компендиум.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "packs-src/mutations/Дары_Богов/Нургл");

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
    file: "Destructive_Swarm___Разрушительный_Рой_SF0Jj2Bt4W65MQfe.json",
    group: "chR6Dn3FYhDs8SJC",
    oldEntryId: "destructiveSwarm-cap",
    newEntryId: "destructiveSwarm-script",
    label: "Разрушительный Рой",
    scriptThrottleUnit: "battle",
    code: reminderCard(
      "Разрушительный Рой",
      "Свободное действие (даже если уже атаковал в этот Ход): рукопашная ИЛИ стрелковая (30м) атака 1d10 E Toxic(½Cor.b), игнорирует негерметичную броню — ЛИБО вместо атаки закружить рой вокруг себя, давая всем атакам против чемпиона штраф −30. Первое использование за бой — бесплатно (эта запись троттлит именно его). Каждое ПОСЛЕДУЮЩЕЕ использование в этом же бою наносит чемпиону 1 непоглощаемого R урона, растущего на 1 за каждый повтор — считать и применять этот урон вручную, движок его не отслеживает."
    )
  },
  {
    file: "Devourer_of_Suffering___Поглотитель_Стра_oYWfYcPClHUJ3oRT.json",
    group: "tIJqwtpbamI23Zgb",
    oldEntryId: "devourerOfSuffering-cap",
    newEntryId: "devourerOfSuffering-script",
    label: "Поглотитель Страданий",
    // Без троттлинга/цены — в тексте книги нет ограничения по частоте (гейт
    // только полудействием + наличием подходящей цели), поэтому запись не
    // попадёт на центральную панель «ВОЗМОЖНОСТИ СЕЙЧАС» (ruleFromEntry
    // требует unit||cost) — кнопка «▶ Запустить» при этом всё равно видна на
    // листе самого предмета, как у любой kind:"script" записи (wdbc-f4jt).
    // Реальная автоматика: восстановить 1 Очко Бесчестия/Судьбы/Боли (тот же
    // pool-выбор, что capability-cost.mjs::capabilityPoolValue/Max — inline,
    // т.к. executeItemCode не даёт импортов внутрь code).
    code: `const isDp = actor.type === "demonPrince";
const path = isDp ? "system.dp.ip" : "system.fate.value";
const cur = isDp ? (Number(actor.system.dp?.ip) || 0) : (Number(actor.system.fate?.value) || 0);
const max = isDp ? (Number(actor.system.characteristics?.inf?.bonus) || 0) : (Number(actor.system.fate?.max) || 0);
await actor.update({ [path]: Math.min(max, cur + 1) });
` + reminderCard(
      "Поглотитель Страданий",
      "Полудействие: коснуться персонажа, страдающего от Критического Эффекта, и подавить этот эффект до конца боя/сцены (применить вручную — движок не отслеживает Критические Эффекты цели) — себе восстановлено 1 ранее потраченное Очко."
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
