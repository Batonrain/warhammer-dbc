// tools/_gift-active-ability-tzeentch-batch1.mjs
// wdbc-suwp — партия 4 (Дары Тзинча): перевод из kind:"capability"-заглушки
// в реальный kind:"script". Одноразовый инструмент, не удалять до
// подтверждения, что содержимое ушло в компендиум.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "packs-src/mutations/Дары_Богов/Тзинч");

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
    file: "Cauldron_of_Flesh___Кот_л_Плоти_ju41pinF1NCOmzVj.json",
    group: "gvnQXYNdIvCzIpUG",
    oldEntryId: "cauldronOfFlesh-cap",
    newEntryId: "cauldronOfFlesh-script",
    label: "Котёл Плоти",
    costPool: "infamy", costAmount: 1,
    code: reminderCard(
      "Котёл Плоти",
      "Полное действие, коснувшись трупа (≤1ч): обратить плоть в текучую массу с запасом Ран = ½ макс. Ран умершего (можно затягивать другие трупы, добавляя ½ их Ран). Полудействие: тратить Раны массы на лечение согласных союзников в радиусе 2м или отращивание частей тела (5 Ран за часть). Излеченный так получает перманентный −5 на встречные тесты/атаки против чемпиона (складывается до −Cor.b×5). Масса гибнет при попытке сдвинуть её, при отходе чемпиона дальше Cor м или в конце сцены."
    )
  },
  {
    file: "Flame_of_Souls___Пламя_Душ_7zXiJnjBINAGFHxb.json",
    group: "ORdIkuuJq0H6qhh6",
    oldEntryId: "flameOfSouls-cap",
    newEntryId: "flameOfSouls-script",
    label: "Пламя Душ",
    scriptThrottleUnit: "round",
    // Реальная автоматика: временное Очко Бесчестия (module/rules/temp-infamy.mjs
    // — та же самая пара, что и Priest of Bloodshed, партия Кхорна). Книга
    // даёт 1 или 3 в зависимости от того, видела ли цель атаку — вместо
    // тихого угадывания спрашиваем диалогом (DialogV2 — глобал, доступен без
    // импорта, «не песочница», см. item-script.mjs).
    code: `const unnoticed = await foundry.applications.api.DialogV2.confirm({
  window: { title: "Пламя Душ" },
  content: "<p>Цель не видела атаку, убившую её?</p>"
});
const amount = unnoticed ? 3 : 1;
const cur = Number(actor.getFlag("warhammer-dbc", "tempInfamy")?.amount) || 0;
await actor.setFlag("warhammer-dbc", "tempInfamy", {
  amount: cur + amount, source: item.name,
  restriction: "тратится как обычное Очко Бесчестия (в т.ч. на +1d10 урона одного попадания после Избегания, до Щитов); сгорает в конце следующего Хода чемпиона"
});
` + reminderCard(
      "Пламя Душ",
      "Чемпион, его Миньон или подчинённый убили другого персонажа — получено временное Очко Бесчестия (3, если цель не видела убившей её атаки)."
    )
  },
  {
    file: "Gatekeeper___Привратник_qkngN9Hac4D3l73D.json",
    group: "pzKuyO9jO9OOR1d9",
    oldEntryId: "gatekeeper-cap",
    newEntryId: "gatekeeper-script",
    label: "Привратник",
    code: reminderCard(
      "Привратник",
      "Феномен/Прорыв/Отвращение Варпа в Cor м от чемпиона — он автоматически знает результат. Реакция: бросить 1d100 вместо начального. Можно тратить Очки Бесчестия, бросая по 1d100 за каждое и выбирая любой из результатов (цена не фиксирована — списывать вручную)."
    )
  },
  {
    file: "Genius_of_Loki___Гений_Локи_K2eTFPqsLDEITh79.json",
    group: "phJgB13nVKdMp1HD",
    oldEntryId: "geniusOfLoki-cap",
    newEntryId: "geniusOfLoki-script",
    label: "Гений Локи",
    code: reminderCard(
      "Гений Локи",
      "9 минут медитации: вселить демона Тзинча в неодушевлённую местность радиусом Cor×5м (дружественен, телепатическая связь на любом расстоянии). Раз в Ход в Инициативу 0 демон делает участок до 9м Трудным Ландшафтом ИЛИ Страхом 3 (новое изменение стирает предыдущее). Вселение в новую местность изгоняет демона из старой."
    )
  },
  {
    file: "Hyperanalich___Гипераналих_SxH6wGylDY2GFpXv.json",
    group: "iGIJ1cTXVywlLQME",
    oldEntryId: "hyperanalich-cap",
    newEntryId: "hyperanalich-script",
    label: "Гипераналих",
    scriptThrottleUnit: "round",
    code: reminderCard(
      "Гипераналих",
      "Свободное действие: тест Logic+0 vs Deceive+0 цели. Успех — до конца боя цель теряет Укрытия против чемпиона, тот может Финтить её свободным действием (не чаще раза в Ход) и заставляет её перебрасывать Избегания/встречные тесты против себя. Переключение на другую цель (в т.ч. неудачное) снимает все преимущества с прежней."
    )
  },
  {
    file: "Nine_Thousand_Faces___Девять_Тысяч_Лиц_lPXvgbB3spqdwo7z.json",
    group: "t6ONEGkUR3nbskzk",
    oldEntryId: "nineThousandFaces-cap",
    newEntryId: "nineThousandFaces-script",
    label: "Девять Тысяч Лиц",
    code: reminderCard(
      "Девять Тысяч Лиц",
      "Полное действие: облик и голос другого известного персонажа ТОЙ ЖЕ расы — бесплатно. За 1 Очко Бесчестия — облик персонажа ДРУГОЙ расы (со сменой Размера, если нужно). Списать цену вручную, только если выбран второй вариант. Снаряжение не меняется."
    )
  },
  {
    file: "Pathchanger___Изменяющий_Пути_mpiCAQbKumcNB13W.json",
    group: "ivPjH8947JreGm2G",
    oldEntryId: "pathchanger-cap",
    newEntryId: "pathchanger-script",
    label: "Изменяющий Пути",
    costPool: "infamy", costAmount: 1,
    code: reminderCard(
      "Изменяющий Пути",
      "Полное действие, коснувшись себя/другого (может потребовать атаки): выбрать известную МУТАЦИЮ цели (не Дар) — цель немедленно перебрасывает её без замены на Дар, Оглушение 1 Раунд. За 3 Очка Бесчестия (спишите вручную ещё 2, если выбран этот вариант) — бросок как от провала. Цель нельзя задеть этим Даром повторно 9 лет 9 дней, пока не получит новую мутацию/не сменит текущую."
    )
  },
  {
    file: "Thief_of_Fate___Вор_Судьбы_Olxzbl4P59icsara.json",
    group: "Xpy5KJTfG79xiLXK",
    oldEntryId: "thiefOfFate-cap",
    newEntryId: "thiefOfFate-script",
    label: "Вор Судьбы",
    code: reminderCard(
      "Вор Судьбы",
      "Чемпион чувствует трату Очков Бесчестия/Судьбы в радиусе Cor м. Реакция: тест Inf+0 — Успех отменяет эффект засечённой траты и восстанавливает 1 ранее потраченное Очко Бесчестия чемпиона; Провал — тест W+0 или потеря 1 Очка Бесчестия."
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
