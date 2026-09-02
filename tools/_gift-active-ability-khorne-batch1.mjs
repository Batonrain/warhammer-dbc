// tools/_gift-active-ability-khorne-batch1.mjs
// wdbc-suwp — перевод части Даров Кхорна из kind:"capability"-заглушки в
// реальный kind:"script" (цена/частота + engine-гейт wdbc-1dc8/wdbc-f4jt).
// Одноразовый инструмент, не удалять до подтверждения, что содержимое ушло
// в компендиум (npm run packs:build) и проверено.
//
// Стенд-запуск (не настоящий Foundry) через test/support/foundry-stub.mjs
// нужен только ради item.actor?.getActiveTokens?.(true)[0] etc в
// executeItemCode — здесь не нужен вовсе, скрипт правит JSON напрямую.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "packs-src/mutations/Дары_Богов/Кхорн");

// blankMechEntry() defaults (module/apps/mechanics.mjs) — полный флаттированный
// объект нужен, т.к. Foundry-документы не хранят «спарс» — у любой записи
// присутствуют ВСЕ поля Конструктора, даже нерелевантные текущему kind.
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
    file: "Avenger_s_Stride___Шаг_Мстителя_Iqux9O19e1y25oTr.json",
    oldEntryId: "avengersStride-cap",
    newEntryId: "avengersStride-script",
    label: "Шаг Мстителя",
    scriptThrottleUnit: "round",
    code: reminderCard(
      "Шаг Мстителя",
      "Реакция (Раз в Раунд): получив непоглощённый урон от Ненавистного врага в радиусе полудвижения — подвинуться к нему на расстояние до полудвижения и провести стандартную рукопашную атаку без свободных атак (движение выглядит как телепортация)."
    )
  },
  {
    file: "Challenge_of_Honour___Вызов_Чести_QAi2ecmgby1hSIFS.json",
    oldEntryId: "challengeOfHonour-cap",
    newEntryId: "challengeOfHonour-script",
    label: "Вызов Чести",
    costPool: "infamy", costAmount: 1,
    code: reminderCard(
      "Вызов Чести",
      "Свободное действие: громко вызвать видимого персонажа на дуэль (услышит и поймёт вызов даже сквозь бой/незнакомый язык). Пока один из дуэлянтов не победит: посторонние, атакующие или накладывающие психосилы/техночудеса на любого из них — W−30 или теряют действие; оба дуэлянта получают не перегружающийся щит-дефлектор 1-88 от всех атак, кроме друг друга; попытка сделать что-то не по дуэли — W−30 или теряется действие. Считается поддерживаемой психосилой (засекается пси-чутьём, может быть развеяна)."
    )
  },
  {
    file: "Charioteer___Колесничий_fVLerNvY6L1TyA7Z.json",
    oldEntryId: "charioteer-cap",
    newEntryId: "charioteer-script",
    label: "Колесничий",
    costPool: "infamy", costAmount: 1,
    code: reminderCard(
      "Колесничий",
      "Полное действие: коснуться боевой техники (в ней/на ней) и пройти встречный тест Cor+20 против I+0 техножреца-настройщика или демона-одержателя. Победа — слиться с техникой: попадания по чемпиону = попадания в технику, чемпион пилотирует своими WS/BS/A/I/P/W (все Навыки пилотирования +30), техника перестаёт слушаться прежних операторов и приобретает эстетику Кхорна. До конца сцены или пока не прекращено полудействием — техника возвращается к исходному виду."
    )
  },
  {
    file: "Font_of_Blood___Кровавая_Купель_sOvci5GhSNtsnzkN.json",
    oldEntryId: "fontOfBlood-cap",
    newEntryId: "fontOfBlood-script",
    label: "Кровавая Купель",
    costPool: "infamy", costAmount: 1,
    code: reminderCard(
      "Кровавая Купель",
      "Полное действие, стоя в боевой крови: телепорт в другую видимую лужу боевой крови в поле зрения. Выход в контакте с врагом считается проведённым Натиском."
    )
  },
  {
    file: "Living_Weapon___Живое_Оружие_hRwi2DatRrINumVS.json",
    oldEntryId: "livingWeapon-cap",
    newEntryId: "livingWeapon-script",
    label: "Живое Оружие",
    costPool: "infamy", costAmount: 1,
    code: reminderCard(
      "Живое Оружие",
      "Полудействие: влить душу в оружие/импровизированный предмет в руке до конца боя или сцены — его нельзя вырвать или выбить, пока чемпион сам его не выпустит; +10 WS с ним, Баланс до 0 (если не был выше), Pen до Cor.b (если не был выше), теряет свойство Primitive и получает Reinforced. Импровизированное оружие вдобавок не получает штраф −20, получает +1 кубик урона и удваивает S.b. Оружие видимо трансформируется."
    )
  },
  {
    file: "Priest_of_Bloodshed___Жрец_Кровопролития_PYgA6tKKRyvio3mE.json",
    oldEntryId: "priestOfBloodshed-cap",
    newEntryId: "priestOfBloodshed-script",
    label: "Жрец Кровопролития",
    scriptThrottleUnit: "round",
    // Реальная автоматика: временное Очко Бесчестия (module/rules/temp-infamy.mjs
    // — тот же примитив, что уже несёт Глас Божий, см. заголовок файла: «Пламя
    // Душ», т.е. gift.tzeentch.flameOfSouls, тоже документирован как будущий
    // потребитель). executeItemCode не даёт импортов внутрь code — логика
    // grantTempInfamy() воспроизведена инлайн один в один с оригиналом.
    code: `const cur = Number(actor.getFlag("warhammer-dbc", "tempInfamy")?.amount) || 0;
await actor.setFlag("warhammer-dbc", "tempInfamy", {
  amount: cur + 1, source: item.name,
  restriction: "тратится как обычное Очко Бесчестия, сгорает в конце следующего Хода чемпиона"
});
` + reminderCard(
      "Жрец Кровопролития",
      "В 8м от чемпиона произошло Кровотечение или смерть в бою другого персонажа — получено временное Очко Бесчестия (тратится как обычное, но сгорает в конце следующего Хода)."
    )
  },
  {
    file: "Purity_of_Battle___Чистота_Битвы_4Sdz3wYLKDm7jGcQ.json",
    oldEntryId: "purityOfBattle-cap",
    newEntryId: "purityOfBattle-script",
    label: "Чистота Битвы",
    costPool: "infamy", costAmount: 1,
    code: reminderCard(
      "Чистота Битвы",
      "Полное действие (даже находясь в Ярости): сферическая волна радиусом Cor.b м. Со всех персонажей в радиусе немедленно снимаются эффекты боевых наркотиков, психосил и техночудес, и на них нельзя наложить снятые эффекты повторно до конца боя или сцены."
    )
  }
];

let changed = 0;
for (const spec of BATCH) {
  const filePath = path.join(DIR, spec.file);
  const doc = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const group = doc.flags["warhammer-dbc"].mechanics[0];
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
