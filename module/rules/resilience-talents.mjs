// module/rules/resilience-talents.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ТАЛАНТЫ СТОЙКОСТИ (глава 3, группа «Стойкость») — чистая логика.
//
//  Уже был сделан раньше: Крепкий / Hardy (лечение — rules/healing-clock.mjs).
//
//  Здесь — числа и условия остальных; диалоги, кнопки и карточки живут в
//  combat/…, sheets/…, чтобы это можно было проверить без Foundry.
//
//    Sound Constitution / Крепкое Телосложение — +1 Рана за копию, потолок T.b (+2 не-Космодесантнику)
//    Tireless / Неутомимый          — нет штрафа Усталости на WS, BS, S, T, A (и на атаки)
//    Mental Fortitude / Мент. Стойкость — обморок при Усталости T.b+2×W.b; штрафы с W.b+1 (запись «Усталость»)
//    Armour-Monger / Бронник        — +2 AP на всех участках, тумблер «обслужена сегодня» до полуночи
//    Hardened Soul / Укреплённая Душа — +½I.b поглощению варп-оружия; кубики Выжигания Души −½I.b
//    True Grit / Настоящая Выдержка — урон −T.b (мин. 1), пока Раны ниже 0
//    Resistance / Сопротивление     — +10 на тесты сопротивления своей специализации
//    Decadence / Декаданс           — +10 на тесты Зависимости
//    Snake Eater / Пожиратель Змей  — урон ядов и сроки ядов/пост-эффектов вдвое (окр.▲)
//    Drop and Roll / Падай и Перекатывайся — автоуспех тушения (combat/extinguish.mjs)
//    Head Guard / Прикрытие Головы  — какие попадания можно перенести на руку (combat/head-guard.mjs)
//    Hellish Resilience / Адская Живучесть — +Cor.b поглощения, срок «до конца следующего Хода» (combat/hellish-resilience.mjs)
//    Eye of the Gods / Взор Богов   — лимит 10 Ран: корзины, значимый персонаж (combat/eye-of-the-gods.mjs)
//    Hunker Down / Залегание        — метка и имя флага (combat/hunker-down.mjs; AP — rules/cover-locations.mjs)
//    Ablative Hardening / Аблативное Укрепление — заряды прочности брони (combat/ablative-hardening.mjs)
//    Iron Jaw / Стальная Челюсть    — тест T+0 против Оглушения (combat/status-resist.mjs)
//    Stonewall / Стена              — тест S+0 против падения, ответный сбив на 5+ Успехов (combat/status-resist.mjs)
//    Final Push / Последний Рывок   — T+0, кнопка на карточке Критического Эффекта (combat/crit-talents-actions.mjs)
//    Never Die / Не Умирать         — Очко Бесчестия гасит эффекты крита (combat/crit-talents-actions.mjs)
//    Pain Is an Illusion / Боль — Лишь Иллюзия — W+0, уровень эффекта − Успехи (combat/crit-talents-actions.mjs)
//    Die Hard / Крепкий Орешек      — кубик Кровотечения дважды; тест «смерть от шока» (combat/shock-death.mjs)
//
//  Файл подключён к rules/sources.mjs (резолвер resilienceTalentRules), поэтому
//  НЕ импортирует hasAbility/hasRuleFlag: те тянут collect.mjs → sources.mjs, и
//  круг подвесил бы загрузку модулей (AGENTS.md, «Источники правил»). Талант
//  опознаётся по имени предмета ИЛИ по прямому скану записей Конструктора
//  kind:"capability" — тем же приёмом, что rules/situational.mjs::actorHasCapability.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

const NS = "warhammer-dbc";

/** Короткий ключ → { ключ Возможности, имя Таланта }. */
export const RESILIENCE_TALENTS = {
  ablativeHardening: { key: "resilience.core.ablativeHardening", name: "Ablative Hardening" },
  armourMonger:      { key: "resilience.core.armourMonger",      name: "Armour-Monger" },
  decadence:         { key: "resilience.core.decadence",         name: "Decadence" },
  dieHard:           { key: "resilience.core.dieHard",           name: "Die Hard" },
  dropAndRoll:       { key: "resilience.core.dropAndRoll",       name: "Drop and Roll" },
  eyeOfTheGods:      { key: "resilience.core.eyeOfTheGods",      name: "Eye of the Gods" },
  finalPush:         { key: "resilience.core.finalPush",         name: "Final Push" },
  hardenedSoul:      { key: "resilience.core.hardenedSoul",      name: "Hardened Soul" },
  hardy:             { key: "resilience.core.hardy",             name: "Hardy" },
  headGuard:         { key: "resilience.core.headGuard",         name: "Head Guard" },
  hellishResilience: { key: "resilience.core.hellishResilience", name: "Hellish Resilience" },
  hunkerDown:        { key: "resilience.core.hunkerDown",        name: "Hunker Down" },
  ironJaw:           { key: "resilience.core.ironJaw",           name: "Iron Jaw" },
  mentalFortitude:   { key: "resilience.core.mentalFortitude",   name: "Mental Fortitude" },
  neverDie:          { key: "resilience.core.neverDie",          name: "Never Die" },
  painIsAnIllusion:  { key: "resilience.core.painIsAnIllusion",  name: "Pain Is an Illusion" },
  resistance:        { key: "resilience.core.resistance",        name: "Resistance" },
  snakeEater:        { key: "resilience.core.snakeEater",        name: "Snake Eater" },
  soundConstitution: { key: "resilience.core.soundConstitution", name: "Sound Constitution" },
  stonewall:         { key: "resilience.core.stonewall",         name: "Stonewall" },
  thumper:           { key: "resilience.core.thumper",           name: "Thumper" },
  tireless:          { key: "resilience.core.tireless",          name: "Tireless" },
  trueGrit:          { key: "resilience.core.trueGrit",          name: "True Grit" }
};

/** Есть ли на акторе предмет с записью Конструктора kind:"capability" с этим ключом. */
function holdsCapability(actor, key) {
  if (!key) return false;
  for (const item of actor?.items ?? []) {
    const groups = item?.flags?.[NS]?.mechanics;
    if (!Array.isArray(groups)) continue;
    for (const g of groups) {
      for (const e of g?.entries ?? []) {
        if (e?.kind === "capability" && e.capabilityKey === key) return true;
      }
    }
  }
  return false;
}

/** Есть ли у актора этот Талант Стойкости (по имени предмета ИЛИ по ключу Возможности). */
export function hasResilienceTalent(actor, id) {
  const t = RESILIENCE_TALENTS[id];
  if (!t) return false;
  const items = actor?.items;
  if (items?.some?.(i => i?.type === "talent" && itemHasName(i, t.name))) return true;
  return holdsCapability(actor, t.key);
}

const num = v => Number(v) || 0;
const charBonus = (actor, key) => num(actor?.system?.characteristics?.[key]?.bonus);

// ── Крепкое Телосложение ────────────────────────────────────────────────────

/** Космодесантник ли: по расе актора или по Черте «Astartes» (как rules/legacy-weapon.mjs::isAstartes). */
export function isSpaceMarine(actor) {
  if (String(actor?.system?.race || "") === "astartes") return true;
  return [...(actor?.items ?? [])].some(i => i?.type === "trait" && itemHasName(i, "Astartes"));
}

/** Сколько раз взят Талант: предметы-копии по имени (отдельные предметы, как «Бездонная Душа»). */
export function soundConstitutionCopies(actor) {
  const byName = [...(actor?.items ?? [])].filter(i =>
    i?.type === "talent" && itemHasName(i, RESILIENCE_TALENTS.soundConstitution.name)).length;
  if (byName > 0) return byName;
  return holdsCapability(actor, RESILIENCE_TALENTS.soundConstitution.key) ? 1 : 0;
}

/**
 * «До T.b раз и ещё +2 раза для не-Космодесантников». `extra` — надбавка к
 * потолку от Стального Сечения (steelRatioCapBonus): +I.b.
 */
export function soundConstitutionCap(toughnessBonus, astartes, extra = 0) {
  return Math.max(0, num(toughnessBonus)) + (astartes ? 0 : 2) + Math.max(0, num(extra));
}

/** Прибавка к максимуму Ран: +1 за каждую копию, но не больше потолка. */
export function soundConstitutionWounds({ copies, tb, astartes, extra = 0 }) {
  return Math.max(0, Math.min(num(copies), soundConstitutionCap(tb, astartes, extra)));
}

/**
 * Steel Ratio / Стальное Сечение (Механикум, стр. 112): «увеличивает
 * максимальное количество изучения Таланта Sound Constitution на I.b». Талант
 * опознаётся по имени или по записи Конструктора mechanicum.core.steelRatio.
 * Не зависит от числа копий — Талант берётся один раз.
 */
export function steelRatioCapBonus(actor) {
  const has = [...(actor?.items ?? [])].some(i => i?.type === "talent" && itemHasName(i, "Steel Ratio"))
    || holdsCapability(actor, "mechanicum.core.steelRatio");
  return has ? Math.max(0, charBonus(actor, "int")) : 0;
}

/**
 * Поправка к максимуму Ран — список {label, value} для строки «с учётом Черт»
 * (rules/character.mjs складывает его с Коротышкой и Саркофагом Дредноута).
 */
export function soundConstitutionWoundsMods(actor, tb) {
  const copies = soundConstitutionCopies(actor);
  if (!copies) return [];
  const value = soundConstitutionWounds({ copies, tb, astartes: isSpaceMarine(actor), extra: steelRatioCapBonus(actor) });
  return value > 0 ? [{ label: `Крепкое Телосложение ×${value}`, value }] : [];
}

// ── Неутомимый ──────────────────────────────────────────────────────────────

/**
 * Тесты, которых Усталость не касается у носителя: WS, BS, S, T, A (A —
 * ключ ag). «Не имеющие типа Ментальное» книга не разбирает по действиям, а у
 * системы нет типа на каждом тесте — решение владельца 18.10.2026: по
 * характеристике теста. Остаются под штрафом I, P, W, F (и Inf/Cor — они
 * освобождены и без Таланта, rules/situational.mjs::FATIGUE_EXEMPT).
 */
export const TIRELESS_CHARS = ["ws", "bs", "s", "t", "ag"];

export function tirelessExempt(actor, charKey) {
  const key = String(charKey ?? "").toLowerCase();
  if (!TIRELESS_CHARS.includes(key)) return false;
  return hasResilienceTalent(actor, "tireless");
}

// ── Ментальная Стойкость ────────────────────────────────────────────────────

/**
 * Усталость, при которой персонаж теряет сознание: T.b + W.b, а у Ментальной
 * Стойкости — T.b + 2×W.b. Единое место для листа, пересчёта актора и
 * вкладки Состояний.
 */
export function fatigueFaintThreshold(actor) {
  const tb = charBonus(actor, "t");
  const wb = charBonus(actor, "wp");
  return tb + wb * (hasResilienceTalent(actor, "mentalFortitude") ? 2 : 1);
}

// ── Бронник ─────────────────────────────────────────────────────────────────

/** Флаг актора: { day } — сутки Календаря, в которые отмечено «броня обслужена». */
export const ARMOUR_MONGER_FLAG = "armourMonger";
export const ARMOUR_MONGER_AP = 2;
const SECONDS_PER_DAY = 86400;

/** Сутки Календаря (терранские, граница в полночь worldTime кратного 86400). */
export function armourMongerDayOf(worldTime) {
  return Math.floor(num(worldTime) / SECONDS_PER_DAY);
}

export function armourMongerStamp(worldTime) {
  return { day: armourMongerDayOf(worldTime) };
}

function armourMongerFlag(actor) {
  return actor?.flags?.[NS]?.[ARMOUR_MONGER_FLAG] ?? actor?.getFlag?.(NS, ARMOUR_MONGER_FLAG) ?? null;
}

/**
 * Включён ли у носителя бонус сейчас. worldTime неизвестен (null/undefined —
 * мир ещё грузится, game.time не готов) — верим метке: лишнюю метку прошлых
 * суток уберут часы Календаря (armourMongerExpired).
 */
export function armourMongerActive(actor, worldTime) {
  // Метка проверяется первой: пересчёт зовёт это для каждого актора, а метка
  // есть у единиц — дорогой поиск Таланта по предметам нужен только им.
  const flag = armourMongerFlag(actor);
  if (!flag || !Number.isFinite(Number(flag.day))) return false;
  if (worldTime !== null && worldTime !== undefined && Number(flag.day) !== armourMongerDayOf(worldTime)) return false;
  return hasResilienceTalent(actor, "armourMonger");
}

/** +2 AP на всех участках, пока тумблер включён. */
export function armourMongerBonus(actor, worldTime) {
  return armourMongerActive(actor, worldTime) ? ARMOUR_MONGER_AP : 0;
}

/** Просрочена ли метка (часы Календаря сбрасывают её в полночь). */
export function armourMongerExpired(flag, worldTime) {
  if (!flag || !Number.isFinite(Number(flag.day))) return false;
  return Number(flag.day) !== armourMongerDayOf(worldTime);
}

// ── Укреплённая Душа ────────────────────────────────────────────────────────

/** ½ I.b (окр.▲), I — Интеллект (ключ int). */
export function hardenedSoulHalf(actor) {
  return Math.ceil(Math.max(0, charBonus(actor, "int")) / 2);
}

/** Прибавка к поглощению урона от варп-оружия. */
export function hardenedSoulSoakBonus(actor) {
  return hasResilienceTalent(actor, "hardenedSoul") ? hardenedSoulHalf(actor) : 0;
}

/** Кубики урона Выжигания Души после уменьшения: −½I.b, но не меньше одного (и не больше исходных). */
export function hardenedSoulDice(net, intBonus) {
  const n = Math.max(0, Math.floor(num(net)));
  if (n <= 1) return n;
  return Math.max(1, n - Math.ceil(Math.max(0, num(intBonus)) / 2));
}

// ── Настоящая Выдержка ──────────────────────────────────────────────────────

/**
 * Урон после Настоящей Выдержки: «когда Раны ниже 0, уменьшает полученный
 * урон на T.b до минимума 1, в т.ч. от попадания, опустившего их ниже 0».
 * Пересекающее ноль попадание всё равно обязано довести Раны минимум до −1
 * (решение владельца 18.10.2026) — иначе Выдержка отменяла бы само падение.
 * @param {{net:number, tb:number, value:number, critical:number, ablative?:number}} p
 * @returns {{net:number, reduced:number}}
 */
export function trueGritDamage({ net, tb, value, critical, ablative = 0 }) {
  const n = Math.max(0, num(net));
  const t = Math.max(0, num(tb));
  if (n <= 0 || t <= 0) return { net: n, reduced: 0 };
  const cushion = Math.max(0, num(value)) + Math.max(0, num(ablative));
  let result;
  if (num(critical) > 0) result = Math.max(1, n - t);          // уже в минусе
  else if (n > cushion) result = Math.max(n - t, cushion + 1); // пересекает ноль: до −1 минимум
  else return { net: n, reduced: 0 };
  result = Math.min(n, result);
  return { net: result, reduced: n - result };
}

// ── Сопротивление ───────────────────────────────────────────────────────────

export const RESISTANCE_BONUS = 10;

/** Девять специализаций книги: ключ → подпись, написания в данных (англ./рус.). */
export const RESISTANCE_SPEC_DEFS = {
  cold:      { label: "Cold",           names: ["cold", "холод"] },
  blindness: { label: "Blindness",      names: ["blindness", "слепота", "ослепление"] },
  deafness:  { label: "Deafness",       names: ["deafness", "глухота"] },
  disease:   { label: "Disease",        names: ["disease", "болезнь", "болезни"] },
  fear:      { label: "Fear",           names: ["fear", "страх"] },
  heat:      { label: "Heat",           names: ["heat", "жара", "жар"] },
  poison:    { label: "Poison",         names: ["poison", "яд", "яды"] },
  psychic:   { label: "Psychic Powers", names: ["psychic powers", "psychic", "психосилы", "пси-силы", "псайкана"] },
  stun:      { label: "Stun",           names: ["stun", "оглушение"] }
};

/** У каких специализаций в системе есть опознаваемый тест (остальные — честная заглушка). */
export const RESISTANCE_TESTED = ["fear", "poison", "psychic", "stun", "cold", "heat"];

const specKeyOf = raw => {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return null;
  return Object.entries(RESISTANCE_SPEC_DEFS).find(([, d]) => d.names.includes(s))?.[0] ?? null;
};

/**
 * Специализации Сопротивления актора. Предмет хранит их строкой через запятую
 * («Cold, Heat» у Огрина) — в system.specialization или в скобках имени.
 * Если в поле лежит ПОЛНЫЙ перечень библиотеки (специализацию не выбрали) — это
 * не выбор, а список вариантов: бонуса нет.
 * @returns {Set<string>} ключи из RESISTANCE_SPEC_DEFS
 */
export function resistanceSpecs(actor) {
  const out = new Set();
  const total = Object.keys(RESISTANCE_SPEC_DEFS).length;
  for (const item of actor?.items ?? []) {
    if (item?.type !== "talent" || !itemHasName(item, RESILIENCE_TALENTS.resistance.name)) continue;
    const fromName = /\(([^)]*)\)/.exec(String(item.name ?? ""))?.[1] ?? "";
    const parts = `${item.system?.specialization ?? ""},${fromName}`.split(",").map(specKeyOf).filter(Boolean);
    const own = new Set(parts);
    if (own.size >= total) continue;
    for (const k of own) out.add(k);
  }
  return out;
}

/**
 * К какой специализации Сопротивления относится тест. Теги ставит код теста:
 * fearTest (combat/fear.mjs), poisonTest (hooks.mjs, Toxic), psychicThreat
 * (сопротивление психосиле и Выжигание Души), stunTest (Оглушающее и др.).
 * @returns {?string}
 */
export function resistanceTestSpec(ctx) {
  if (!ctx) return null;
  if (ctx.fearTest) return "fear";
  if (ctx.poisonTest) return "poison";
  if (ctx.psychicThreat) return "psychic";
  if (ctx.stunTest) return "stun";
  // Тест на Жару/Холод Окружения (combat/temperature-hazard.mjs, 3-edc4 п.7).
  if (ctx.coldTest) return "cold";
  if (ctx.heatTest) return "heat";
  return null;
}

/** +10, если у актора есть Сопротивление этой специализации и тест — именно против неё. */
export function resistanceBonus(actor, ctx) {
  const spec = resistanceTestSpec(ctx);
  if (!spec) return 0;
  return resistanceSpecs(actor).has(spec) ? RESISTANCE_BONUS : 0;
}

// ── Декаданс ────────────────────────────────────────────────────────────────

export const DECADENCE_BONUS = 10;

// ── Пожиратель Змей ─────────────────────────────────────────────────────────

/** Вдвое меньше (окр.▲), если у актора Пожиратель Змей. */
export function snakeEaterHalve(actor, n) {
  const v = Math.max(0, Math.floor(num(n)));
  return hasResilienceTalent(actor, "snakeEater") ? Math.ceil(v / 2) : v;
}

// ── Падай и Перекатывайся ───────────────────────────────────────────────────

/**
 * Кто ложится Повален: «сбивая себя или потушенного (соответственно) с ног» —
 * тушил себя: сам носитель; тушил другого: потушенный. [допущение: «соответственно»]
 */
export function dropAndRollProneTarget(self) {
  return self ? "actor" : "patient";
}

// ── Прикрытие Головы ────────────────────────────────────────────────────────

/** Куда можно перенести попадание: ключ брони → метка места попадания (constants/combat.mjs). */
export const HEAD_GUARD_ARMS = { rightArm: "П. Рука", leftArm: "Л. Рука" };

/**
 * «Попадание в голову (но не Избирательный в глаз или сочленения шеи)» — только
 * обычное место «Голова»; «Глаз (Голова)» и «Сочленение / Шея» — Избирательные.
 */
export function headGuardApplies(hitLocation) {
  return hitLocation === "Голова";
}

// ── Адская Живучесть ────────────────────────────────────────────────────────

/** +Cor.b поглощения (Cor.b — system.corruptionBonus), если Талант есть. */
export function hellishResilienceBonus(actor) {
  return hasResilienceTalent(actor, "hellishResilience") ? Math.max(0, num(actor?.system?.corruptionBonus)) : 0;
}

/** Непоглощённый урон после прибавки к поглощению. */
export function hellishResilienceNet(net, bonus) {
  return Math.max(0, num(net) - Math.max(0, num(bonus)));
}

/**
 * Сколько КОНЦОВ своего Хода носитель должен пережить, пока бонус не снимется:
 * «до конца своего следующего Хода». Получил урон в чужой Ход — следующий его Ход
 * ещё впереди (1 конец); в собственный Ход — этот Ход «следующим» не считается,
 * считается тот, что придёт после (2 конца).
 */
export function hellishResilienceTurnEnds(ownTurn) {
  return ownTurn ? 2 : 1;
}

// ── Взор Богов ──────────────────────────────────────────────────────────────

export const EYE_OF_THE_GODS_LIMIT = 10;
/** Флаг актора: ГМ отметил персонажа «значимым» (для лимита Взора Богов у цели). */
export const NOTABLE_FLAG = "notableCharacter";
export const EYE_OF_THE_GODS_FLAG = "eyeOfTheGods";

/** Значимый ли персонаж (флаг актора, ставит ГМ в «Настройках листа»). */
export function isNotableCharacter(actor) {
  return !!(actor?.flags?.[NS]?.[NOTABLE_FLAG] ?? actor?.getFlag?.(NS, NOTABLE_FLAG));
}

/**
 * Корзина счёта: рядовые копят суммарно ("general"), у значимого — своя на каждого
 * (ключ — uuid атакующего). Значимый без uuid (урон без источника) — рядовой.
 */
export function eyeOfTheGodsBucket(notable, attackerUuid) {
  return notable && attackerUuid ? `notable:${attackerUuid}` : "general";
}

/** Сколько Ран уже потеряно в этой корзине за текущее окно (метка живёт только внутри своего боя). */
export function eyeOfTheGodsUsed(flag, combatId, bucket) {
  if (!flag || !combatId || flag.combatId !== combatId) return 0;
  return Math.max(0, num(flag.buckets?.[bucket]));
}

/** «Лишний» урон сверх лимита корзины игнорируется. */
export function eyeOfTheGodsCap(net, used, limit = EYE_OF_THE_GODS_LIMIT) {
  const n = Math.max(0, num(net));
  const room = Math.max(0, num(limit) - Math.max(0, num(used)));
  const out = Math.min(n, room);
  return { net: out, ignored: n - out };
}

/** Новая метка окна после потери `lost` Ран в корзине (другой бой — счёт с нуля). */
export function eyeOfTheGodsRecord(flag, combatId, bucket, lost) {
  const same = flag && flag.combatId === combatId;
  const buckets = same ? { ...(flag.buckets ?? {}) } : {};
  buckets[bucket] = Math.max(0, num(buckets[bucket])) + Math.max(0, num(lost));
  return { combatId, buckets };
}

/**
 * Методы против щитов-дефлекторов обходят Взор Богов: игнор щита (Омывание,
 * Варп-Оружие) и Освящённое (пропускает чародейские щиты — Взор Богов именно такой).
 */
export function eyeOfTheGodsBypassed({ ignoreShield = false, sanctified = false } = {}) {
  return !!(ignoreShield || sanctified);
}

// ── Залегание ───────────────────────────────────────────────────────────────

/** Turn-scoped флаг (rules/turn-flags.mjs): метка гаснет в начале следующего Хода носителя. */
export const HUNKER_DOWN_FLAG = "hunkerDown";

// ── Аблативное Укрепление ───────────────────────────────────────────────────

/** Поле брони (data/item/armor.mjs): заряды прочности. */
export const HARDENING_FIELD = "hardeningCharges";

/** Сколько зарядов даёт обслуживание: I.b (Интеллект), только у носителя Таланта. */
export function ablativeHardeningRefill(actor) {
  return hasResilienceTalent(actor, "ablativeHardening") ? Math.max(0, charBonus(actor, "int")) : 0;
}

/**
 * Какая броня платит зарядом за потерю AP на этом участке: надетая, закрывающая
 * участок (AP > 0) и с зарядами; при нескольких — с наибольшим запасом.
 * @param {Array<{id:string, system:object}>} armors предметы-броня актора
 * @param {string} armorKey head/body/leftArm/rightArm/leftLeg/rightLeg; null — любая надетая
 */
export function pickHardeningArmor(armors, armorKey = null) {
  let best = null;
  for (const a of armors ?? []) {
    if (a?.type !== "armor" || !a.system?.equipped) continue;
    if (armorKey && !(num(a.system?.[armorKey]) > 0)) continue;
    const charges = num(a.system?.[HARDENING_FIELD]);
    if (charges > 0 && (!best || charges > num(best.system?.[HARDENING_FIELD]))) best = a;
  }
  return best;
}

// ── Стальная Челюсть и Стена ────────────────────────────────────────────────

/**
 * Состояния, которые носитель вправе «проигнорировать» тестом, когда их на него
 * накладывают (combat/status-resist.mjs): Оглушение — тест T+0 (Стальная
 * Челюсть), Повален — тест S+0 (Стена). char — ключ характеристики теста.
 */
export const STATUS_RESIST = {
  stunned: { talent: "ironJaw",   char: "t", charLabel: "T", name: "Стальная Челюсть", what: "Оглушение" },
  prone:   { talent: "stonewall", char: "s", charLabel: "S", name: "Стена",            what: "падение с ног" }
};

/** Правило сопротивления для этого Состояния, если у актора есть нужный Талант; иначе null. */
export function statusResistFor(actor, condKey) {
  const rule = STATUS_RESIST[condKey];
  return rule && hasResilienceTalent(actor, rule.talent) ? rule : null;
}

/** Стена: «если пытались сбить рукопашным приёмом, на 5+ Успехов может сбить нападающего». */
export const STONEWALL_KNOCKBACK_SUCCESSES = 5;

export function stonewallKnockBack({ successes, melee, hasAttacker }) {
  return !!melee && !!hasAttacker && num(successes) >= STONEWALL_KNOCKBACK_SUCCESSES;
}

// ── Последний Рывок, Не Умирать, Боль — Лишь Иллюзия ────────────────────────

/** Тесты Талантов Критического Эффекта: Последний Рывок — T+0, Боль — W+0 (Willpower, ключ wp). */
export const FINAL_PUSH_CHAR = "t";
export const PAIN_ILLUSION_CHAR = "wp";

/** Флаг актора: эффекты, отложенные Последним Рывком до конца Хода носителя. */
export const FINAL_PUSH_FLAG = "finalPushDeferred";

/**
 * Боль — Лишь Иллюзия: «уменьшить эффект на Успехи, до минимума в 1». Уровень
 * Критического Эффекта в системе — число отрицательных Ран (строка таблицы).
 */
export function painIllusionLevel(level, successes) {
  const lvl = Math.max(1, Math.floor(num(level)));
  return Math.max(1, lvl - Math.max(0, Math.floor(num(successes))));
}

// ── Крепкий Орешек ──────────────────────────────────────────────────────────

/**
 * «Может перебрасывать тесты на Кровотечение»: кубик Кровотечения (1d10/1d20,
 * чем больше — тем лучше: ≤0 после Обескровливания — смерть) бросается дважды и
 * берётся больший. Для остальных — один бросок.
 */
export function bleedingRollCount(actor) {
  return hasResilienceTalent(actor, "dieHard") ? 2 : 1;
}

export function bestBleedingRoll(totals) {
  const list = (totals ?? []).map(Number).filter(Number.isFinite);
  return list.length ? Math.max(...list) : 0;
}

// ── Источник правил реестра ─────────────────────────────────────────────────

/**
 * Правила Талантов Стойкости для сборки тестов (rules/sources.mjs):
 * Сопротивление (+10 на тесты своей специализации) и Декаданс (+10 на тесты
 * Зависимости). Строки автоматические (auto) — как Усталость: не выбор игрока.
 */
export function resilienceTalentRules(actor, ctx = {}) {
  const rules = [];
  const spec = resistanceTestSpec(ctx);
  if (spec && resistanceBonus(actor, ctx) > 0) {
    const label = `Сопротивление (${RESISTANCE_SPEC_DEFS[spec].label})`;
    rules.push({
      id: `resilience.resistance.${spec}`, label, when: {},
      effects: [{ kind: "rollBonus", target: "all", value: RESISTANCE_BONUS, label, auto: true }]
    });
  }
  if (ctx.addictionTest && hasResilienceTalent(actor, "decadence")) {
    const label = "Декаданс: тест Зависимости";
    rules.push({
      id: "resilience.decadence.addiction", label, when: {},
      effects: [{ kind: "rollBonus", target: "all", value: DECADENCE_BONUS, label, auto: true }]
    });
  }
  return rules;
}
