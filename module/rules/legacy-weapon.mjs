// module/rules/legacy-weapon.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ОРУЖИЕ НАСЛЕДИЯ — числа (корбук, стр. 426-428).
//
//  Здесь порог Возвышения, счёт положенных Мутаций и то, что Наследие делает с
//  профилем оружия. Ни Foundry, ни бросков: окно (apps/legacy-weapon.mjs) лишь
//  показывает посчитанное и катает кубик.
//
//  Ключевая тонкость Возвышения: тест идёт «на Inf+0 с модификатором Редкости
//  оружия, ИГНОРИРУЯ модификатор Качества». Редкость и Качество в системе
//  лежат рядом (`availability` и `quality`) и оба участвуют в реквизиции, так
//  что соблазн взять готовую сложность велик — но качество сюда не входит, и
//  порог собирается заново.
// ════════════════════════════════════════════════════════════════════════════

import { rarityDiff } from "../constants/craft.mjs";
import { MUTATION_THRESHOLDS, ASCENSION_HEAVY_MOD, ASCENSION_LEGION_BONUS,
         ASCENSION_DEED_MAX, ASCENSION_HARD_PROPS,
         historyByRoll, mutationByRoll } from "../constants/legacy-weapon.mjs";
import { itemHasName, hatredTargetsOf } from "./predicates.mjs";
import { anyTargetMatches } from "./talent-targets.mjs";
import { CHARACTERISTICS } from "../constants/characteristics.mjs";
import { isCapabilityAvailable, markCapabilityUsed } from "./cooldown.mjs";

// ВОССТАНОВЛЕНО 21.09.2026 после потери незакоммиченных правок (параллельная
// сессия влила origin/main в эту же рабочую копию и откатила отслеживаемые
// файлы до коммита 9f0f65fa6 "15/35 Мутаций"). Все находки ниже — от
// «4 системных пробелов» до Тихого/Наследия Бойни/Терпения/Лучшей Части
// Отваги — переписаны заново по памяти этого разговора, не восстановлены
// байт-в-байт. НЕ импортировать rules/hands.mjs (weaponHandsRequired/
// getHeldHand) отсюда — тот транзитивно тянет rules/flags.mjs →
// rules/collect.mjs → rules/sources.mjs, а sources.mjs сам импортирует ЭТОТ
// модуль (registerRuleSource на legacyWrathRules и т.д. ниже) — замкнёт
// цикл, на котором зависает vitest (test/rules/scaffold.test.mjs, не падает
// в обычном Node). legacyHatredShieldArms поэтому живёт в apps/legacy-
// weapon.mjs, не здесь.

const num = v => Number(v) || 0;

/** Свойства оружия ключами — они лежат записями {key, rating}. */
function propKeys(weapon) {
  return new Set((weapon?.system?.weaponProps ?? []).map(p => p?.key).filter(Boolean));
}

/** Тяжёлое ли оружие: класс «heavy» — то же, что «Тяжелое» книги. */
export function isHeavyWeapon(weapon) {
  return weapon?.system?.weaponClass === "heavy";
}

/** Свойства из списка «трудных», которые есть у этого оружия. */
export function hardProps(weapon) {
  const keys = propKeys(weapon);
  return ASCENSION_HARD_PROPS.filter(k => keys.has(k));
}

/**
 * Может ли оружие вообще стать Наследием. Демоническое — не может (стр. 426);
 * уже возвышенное возвышать заново незачем.
 * @returns {{ok:boolean, reason:string}}
 */
export function canAscend(weapon) {
  if (weapon?.type !== "weapon") return { ok: false, reason: "Это не оружие." };
  if (weapon.system?.daemonWeapon?.bound)
    return { ok: false, reason: "Демоническое Оружие не может быть Оружием Наследия." };
  if (weapon.system?.legacy?.active)
    return { ok: false, reason: "Это оружие уже является Оружием Наследия." };
  return { ok: true, reason: "" };
}

/**
 * Слагаемые порога Возвышения — списком, чтобы окно показало игроку, из чего
 * тот собран, а не одно готовое число.
 *
 * `legendary` — Легендарное оружие: у него своя легенда, и книга даёт ему
 * максимальный бонус +30 всегда, вместо разбора подвигов.
 * @returns {{rows:{label:string,val:number}[], threshold:number}}
 */
export function ascensionRows(actor, weapon, { deedBonus = 0, legendary = false } = {}) {
  const inf = num(actor?.system?.characteristics?.inf?.total);
  const rows = [{ label: "Бесчестие (Inf)", val: inf, primary: true }];

  // Редкость считается ТОЛЬКО по availability: модификатор Качества книга
  // велит игнорировать, и брать общую сложность реквизиции здесь нельзя.
  const rarity = rarityDiff(num(weapon?.system?.availability));
  if (rarity) rows.push({ label: "Редкость оружия", val: rarity });

  if (isHeavyWeapon(weapon)) rows.push({ label: "Тяжёлое оружие", val: ASCENSION_HEAVY_MOD });
  const hard = hardProps(weapon);
  if (hard.length) rows.push({ label: `Свойства: ${hard.join(", ")}`, val: ASCENSION_HEAVY_MOD });

  // Космодесантник и оружие со свойством Legion — родная пара (стр. 426).
  if (propKeys(weapon).has("legion") && isAstartes(actor))
    rows.push({ label: "Астартес с оружием Legion", val: ASCENSION_LEGION_BONUS });

  const deed = legendary
    ? ASCENSION_DEED_MAX
    : Math.max(0, Math.min(ASCENSION_DEED_MAX, num(deedBonus)));
  if (deed) rows.push({ label: legendary ? "Легендарное оружие" : "Подвиги, достойные легенд", val: deed });

  return { rows, threshold: rows.reduce((s, r) => s + r.val, 0) };
}

/** Космодесантник ли: по расе актора или по Черте «Astartes». */
export function isAstartes(actor) {
  if (String(actor?.system?.race || "") === "astartes") return true;
  return [...(actor?.items ?? [])].some(
    i => i?.type === "trait" && itemHasName(i, "Astartes"));
}

// ── Что Наследие делает с профилем ────────────────────────────────────────

/**
 * Бонус Наследия к Dmg и Pen: ½Inf.b, округление вверх (стр. 426). Перебор/
 * fearsome 8-8 (wdbc-1rno.35, стр. 427): «Бонус к урону оружия использует
 * полный Inf.b вместо половины» — полный, если у ЭТОГО оружия уже записана
 * Мутация (второй параметр опционален: applyLegacy на самом Возвышении почти
 * всегда зовёт без него — Мутаций тогда ещё нет; исключение — повторное
 * Возвышение после разрыва связи, книга сохраняет Мутации, стр. 428).
 */
export function legacyBonus(actor, weapon = null) {
  const infBonus = num(actor?.system?.characteristics?.inf?.bonus);
  if (weapon && legacyExcessBoostActive(actor, weapon)) return infBonus * 2;
  if (weapon && takenMutationNames(weapon).has("Перебор")) return infBonus;
  return Math.ceil(infBonus / 2);
}

/** Качество на ступень выше — «+1 Качество» общих свойств. */
export const QUALITY_LADDER = ["poor", "common", "good", "best"];

export function qualityAfterLegacy(quality) {
  const i = QUALITY_LADDER.indexOf(String(quality || "common"));
  if (i < 0) return "good";
  return QUALITY_LADDER[Math.min(i + 1, QUALITY_LADDER.length - 1)];
}

/**
 * Свойства после Возвышения: прибавляется Reinforced, снимается Primitive.
 * Возвращает НОВЫЙ массив — исходный нужен для отката, если связь порвётся.
 */
export function propsAfterLegacy(props = []) {
  const out = [...props].filter(p => p?.key !== "primitive");
  if (!out.some(p => p?.key === "reinforced")) out.push({ key: "reinforced" });
  return out;
}

// ── Мутации по Порче (стр. 426) ───────────────────────────────────────────

/**
 * Сколько Мутаций положено оружию при этой Порче владельца: по одной за
 * каждый пройденный порог 20/40/60/80.
 */
export function mutationSlots(corruption) {
  const cor = num(corruption);
  return MUTATION_THRESHOLDS.filter(t => cor >= t).length;
}

/** Порча, при которой откроется следующая Мутация; null — все четыре взяты. */
export function nextMutationAt(corruption) {
  const cor = num(corruption);
  return MUTATION_THRESHOLDS.find(t => cor < t) ?? null;
}

/**
 * Сколько Мутаций можно взять прямо сейчас: положено минус уже записанные.
 * Унаследованное оружие сохраняет Мутации, даже если Порчи нового владельца
 * для них не хватает (стр. 428), поэтому отрицательной разницы здесь не
 * бывает — лишние не отбираются.
 */
export function mutationsAvailable(actor, weapon) {
  const taken = (weapon?.system?.legacy?.mutations ?? []).length;
  const slots = mutationSlots(actor?.system?.corruption?.value);
  return Math.max(0, slots - taken);
}

/**
 * Табличное имя Мутации: по Характеру и броску, если они записаны. Сохранённое
 * m.name — лишь подпись: правка названия в таблице не должна тихо выключать
 * механику у уже созданного оружия (wdbc-bjy1.5). Своя Мутация (roll 0) и
 * записи без Характера узнаются по имени, как раньше.
 */
export function legacyMutationName(m) {
  return (m?.character && mutationByRoll(m.character, m.roll)?.name) || m?.name || "";
}

/** Броски, которые в этой таблице уже выпадали, — их перебрасывают. */
export function takenMutationNames(weapon) {
  return new Set((weapon?.system?.legacy?.mutations ?? []).map(legacyMutationName).filter(Boolean));
}

// ── Применение конкретных Мутаций/Историй (wdbc-1rno.35) ──────────────────
//  Хранилище (weapon.system.legacy.mutations/historyKey) уже достаточно
//  структурировано (подтверждено на wdbc-1rno.41) — общий реестр по типу
//  capabilityKey/kind:"script" не нужен, каждая запись читается точечно, в
//  месте боевого конвейера, которое ей соответствует.

/**
 * Сверхточное/Skilled 9-9 (стр. 428): «При одиночных выстрелах или рукопашных
 * атаках с Прицеливанием это оружие получает +1 Dmg за каждый чётный Успех на
 * попадание.» Прицеливание книга ставит условием для обеих веток (та же
 * логика, что у общего Меткого — attack-outcome.mjs::bonusDamageDice, «без
 * Прицеливания Меткое не даёт бонуса вовсе»), поэтому aimed проверяется и для
 * одиночного выстрела, и для рукопашной.
 */
export function preciseLegacyDamageBonus({ weapon, hit, deg, rofMode, isMelee, aimed }) {
  if (!hit || !aimed) return 0;
  if (!(isMelee || rofMode === "single")) return 0;
  if (!takenMutationNames(weapon).has("Сверхточное")) return 0;
  return Math.floor((Number(deg) || 0) / 2);
}

/** Табличное имя взятой Истории: по historyKey, сохранённое historyName — подпись (wdbc-bjy1.5). */
export function legacyHistoryName(weapon) {
  const L = weapon?.system?.legacy;
  return historyByRoll(L?.historyKey)?.name || String(L?.historyName || "");
}

export function legacyHistoryIs(weapon, name) {
  return legacyHistoryName(weapon) === name;
}

/**
 * Наследие Боли (История 5, стр. 427): «Оружие получает свойство
 * Crippling (1) или Shocking, если уже имело его.» Разовое ПОСТОЯННОЕ
 * изменение свойств оружия — тот же приём, что propsAfterLegacy у самого
 * Возвышения (новый массив, не мутация); зовётся ОДИН раз при записи
 * Истории (apps/legacy-weapon.mjs::setHistory), не на каждой атаке, как
 * остальные находки этого тикета — здесь нечего считать в бою заново.
 */
export function painLegacyProps(props = []) {
  const out = [...props];
  if (!out.some(p => p?.key === "crippling")) {
    out.push({ key: "crippling", rating: 1 });
    return out;
  }
  if (!out.some(p => p?.key === "shocking")) out.push({ key: "shocking" });
  return out;
}

/**
 * Наследие Чумы (История 7, стр. 427): «Оружие получает свойство Toxic (0).
 * Если оно уже имело это свойство, оно повышает рейтинг свойства Toxic на
 * 1.» Тот же приём разового постоянного изменения, что painLegacyProps.
 *
 * Третье предложение книги («Если оно заряжено альтернативным ядом, тесты
 * против этого яда получают штраф −10») честно НЕ реализовано — у боеприпаса
 * (module/data/item/ammo.mjs) нет вообще понятия «альтернативный яд»/тип
 * яда как структурного поля (grep подтвердил: ни одного упоминания вне
 * текста книг), гейтить нечем.
 */
export function plagueLegacyProps(props = []) {
  const out = [...props];
  const idx = out.findIndex(p => p?.key === "toxic");
  if (idx === -1) {
    out.push({ key: "toxic", rating: 0 });
    return out;
  }
  out[idx] = { ...out[idx], rating: (Number(out[idx].rating) || 0) + 1 };
  return out;
}

/**
 * Наследие Гнева (История 2, стр. 427): «+2 Dmg против врагов, на которых у
 * персонажа есть Талант Hatred.» Цель Ненависти — та же инфраструктура, что
 * уже читает сам Талант (rules/hatred.mjs, wdbc-1rno, 12.09.2026):
 * hatredTargetsOf(actor) + anyTargetMatches по ctx.targetActor.
 */
export function wrathLegacyDamageBonus({ weapon, actor, hit, targetActor }) {
  if (!hit) return 0;
  if (!legacyHistoryIs(weapon, "Наследие Гнева")) return 0;
  const targets = hatredTargetsOf(actor);
  if (!targets.length) return 0;
  return anyTargetMatches(targets, { targetActor }) ? 2 : 0;
}

/**
 * Наследие Крови (История 8, стр. 427): «+1 Dmg. +10 на попадание по
 * Псайкерам.» Третья часть («+10 на встречные тесты против психосил/
 * выжигания души/демонических даров/одержимости, пока вооружён») — 2 из 4
 * категорий реализованы через новый общий тег ctx.psychicThreat
 * (rules/resolve-test.mjs::effectAppliesTo, scope "psychicthreat") —
 * см. legacyBloodPsychicRules ниже; Одержимость и добровольная выдача Дара
 * Демон-Принцем честно НЕ реализованы — в коде нет самого теста
 * сопротивления для этих двух категорий вовсе (нечего гейтить, не пробел
 * в архитектуре), см. wdbc-1rno.46.
 */
export function bloodLegacyDamageBonus({ weapon, hit }) {
  if (!hit) return 0;
  return legacyHistoryIs(weapon, "Наследие Крови") ? 1 : 0;
}

/**
 * Кровожадное/fearsome 1-2 (стр. 427), рукопашная ветка: «+20 на все тесты
 * с оружием в Ход, когда персонаж совершал Натиск.» combat/movement-
 * actions.mjs::declareCharge пишет system.meleeBase='charge' на ВЕСЬ Ход
 * (не на одну атаку) — ровно то состояние, что спрашивает книга.
 */
export function bloodthirstyLegacyMeleeActive(actor, weapon) {
  if (weapon?.system?.weaponClass !== "melee") return false;
  return actor?.system?.meleeBase === "charge" && takenMutationNames(weapon).has("Кровожадное");
}

/**
 * Рваное/fearsome 3-4 (стр. 427, both): «Даёт свойство Tearing. Если оно уже
 * имело это свойство, даёт вместо этого Proven (½Inf.b (окр.▲)).» Разовое
 * постоянное изменение — тот же приём, что painLegacyProps/plagueLegacyProps,
 * но зовётся из rollMutation (apps/legacy-weapon.mjs), не setHistory: это
 * Мутация, не История. infBonus — Inf.b ВЛАДЕЛЬЦА на момент получения
 * Мутации (число фиксируется тогда же, не пересчитывается каждый раз).
 */
export function tearingLegacyProps(props = [], infBonus = 0) {
  const out = [...props];
  if (!out.some(p => p?.key === "tearing")) {
    out.push({ key: "tearing" });
    return out;
  }
  if (!out.some(p => p?.key === "proven")) {
    out.push({ key: "proven", rating: Math.ceil((Number(infBonus) || 0) / 2) });
  }
  return out;
}

/**
 * Разбивающее/fearsome 5-6 (стр. 427): «Рукопашная: Даёт Power Field. Если
 * уже имело — +2 Pen. Стрелковая: Даёт Razor Sharp. Если уже имело — +2
 * Pen.» Ни у Power Field, ни у Razor Sharp нет рейтинга (булевы свойства) —
 * «+2 Pen» повторного попадания уходит не в weaponProps, а плоской
 * прибавкой к system.penetration самого предмета (тот же разряд правки,
 * что Возвышение уже делает с профилем — permanent, не за столом).
 * @returns {{props: object[], penDelta: number}}
 */
export function shatteringLegacyGrant(weapon) {
  const propKey = weapon?.system?.weaponClass === "melee" ? "powerField" : "razorSharp";
  const props = [...(weapon?.system?.weaponProps ?? [])];
  if (!props.some(p => p?.key === propKey)) return { props: [...props, { key: propKey }], penDelta: 0 };
  return { props, penDelta: 2 };
}

/**
 * Ошеломляющее/fearsome 7-7 (стр. 427). Рукопашная: «Даёт Concussive
 * (½Inf.b (окр.▲)) или +1 к рейтингу, если оно равно или выше.» Стрелковая:
 * «Даёт Concussive (1).» — фиксированный рейтинг 1, не масштабируется
 * Inf.b, но тот же приём «уже есть — +1».
 *
 * Второе предложение стрелковой ветки («Если цель Уклонилась, бросьте
 * 1d10+Inf.b — если пробивает её Поглощение, попадание без урона с
 * Concussive (0)») реализовано отдельным модулем — combat/legacy-weapon-
 * stunning.mjs (кнопка на карточке успешного дистанционного Уклонения,
 * честно упрощённый расчёт Поглощения без Ртути/Адаптации/Аблативного
 * AP-щита/Felling-редукции — см. заголовок того файла).
 */
/**
 * Быстрое/skilled 8-8 (стр. 428). Рукопашная: «Даёт Flexible. Если уже
 * имело — Уклонения от него получают −10.» Стрелковая: «Избегания от этого
 * оружия получают −20» (безусловно, не 'если уже имело').
 *
 * Рукопашная ветка: если Flexible уже была на оружии ДО этой Мутации, книга
 * не даёт повторный грант — вместо этого нужен живой −10 к Уклонению при
 * атаке ИМЕННО этим оружием, но weaponProps после гранта не хранит, «Flexible
 * появилась от Мутации или была всегда» — поэтому факт «нужен ли −10»
 * фиксируется отдельным булевым полем на самом предмете (weapon.system.
 * legacy.swiftDodgePenalty), а не выводится из списка свойств заново.
 * @returns {{props: object[], swiftDodgePenalty: boolean}}
 */
export function swiftLegacyMeleeGrant(weapon) {
  const props = [...(weapon?.system?.weaponProps ?? [])];
  if (props.some(p => p?.key === "flexible")) return { props, swiftDodgePenalty: true };
  return { props: [...props, { key: "flexible" }], swiftDodgePenalty: false };
}

/** Стрелковая ветка Быстрого: безусловный штраф −20 Уклонению от ЭТОГО оружия. */
export function swiftLegacyRangedDodgePenalty(weapon) {
  if (weapon?.system?.weaponClass === "melee") return 0;
  return takenMutationNames(weapon).has("Быстрое") ? -20 : 0;
}

/** Рукопашная ветка Быстрого: −10 Уклонению, если уже было Flexible при получении (см. swiftLegacyMeleeGrant). */
export function swiftLegacyMeleeDodgePenalty(weapon) {
  if (weapon?.system?.weaponClass !== "melee") return 0;
  if (!takenMutationNames(weapon).has("Быстрое")) return 0;
  return weapon?.system?.legacy?.swiftDodgePenalty ? -10 : 0;
}

/**
 * Резня/merciless 7-7 (стр. 428): «Даёт свойство Devastating (½Inf.b
 * (окр.▲)) или +1 к рейтингу, если оно равно или выше.» Тот же приём, что
 * stunningLegacyGrant (Ошеломляющее) — грант/апгрейд рейтинга при получении
 * Мутации, разово, apps/legacy-weapon.mjs::rollMutation.
 */
export function slaughterLegacyGrant(weapon, infBonus) {
  const props = [...(weapon?.system?.weaponProps ?? [])];
  const idx = props.findIndex(p => p?.key === "devastating");
  const base = Math.ceil((Number(infBonus) || 0) / 2);
  if (idx === -1) { props.push({ key: "devastating", rating: base }); return props; }
  props[idx] = { ...props[idx], rating: (Number(props[idx].rating) || 0) + 1 };
  return props;
}

/**
 * Злобное/merciless 9-9 (стр. 428): «Даёт свойство Crippling (½Inf.b
 * (окр.▲)) или +1 к рейтингу, если оно равно или выше.» Тот же приём.
 */
export function viciousLegacyGrant(weapon, infBonus) {
  const props = [...(weapon?.system?.weaponProps ?? [])];
  const idx = props.findIndex(p => p?.key === "crippling");
  const base = Math.ceil((Number(infBonus) || 0) / 2);
  if (idx === -1) { props.push({ key: "crippling", rating: base }); return props; }
  props[idx] = { ...props[idx], rating: (Number(props[idx].rating) || 0) + 1 };
  return props;
}

export function stunningLegacyGrant(weapon, infBonus) {
  const isMeleeW = weapon?.system?.weaponClass === "melee";
  const baseRating = isMeleeW ? Math.ceil((Number(infBonus) || 0) / 2) : 1;
  const props = [...(weapon?.system?.weaponProps ?? [])];
  const idx = props.findIndex(p => p?.key === "concussive");
  if (idx === -1) {
    props.push({ key: "concussive", rating: baseRating });
    return props;
  }
  props[idx] = { ...props[idx], rating: (Number(props[idx].rating) || 0) + 1 };
  return props;
}

/** Экипированное Оружие Наследия с указанной Историей — сам предмет, либо null. */
export function equippedLegacyWeaponWithHistory(actor, historyName) {
  return [...(actor?.items ?? [])].find(i =>
    i?.type === "weapon" && i.system?.legacy?.active && i.system?.equipped
    && legacyHistoryIs(i, historyName)) ?? null;
}

/** Экипированное Оружие Наследия с указанной Мутацией — сам предмет, либо null. */
export function equippedLegacyWeaponWithMutation(actor, mutationName) {
  return [...(actor?.items ?? [])].find(i =>
    i?.type === "weapon" && i.system?.legacy?.active && i.system?.equipped
    && takenMutationNames(i).has(mutationName)) ?? null;
}

/**
 * Наследие Ярости/Rage (История 3, стр. 427). Рукопашная ветка:
 * «+10 к атакам этим оружием. Пока персонаж вооружён им, он получает штраф
 * −10 на тесты I и P и может входить в Ярость за свободное действие.»
 *
 * «+10 к атакам этим оружием» — sheets/attack/mods.mjs (weapon-scoped
 * авто-галочка, тот же приём, что Тихое Устранение). «Может входить в
 * Ярость свободным действием» — честно НЕ реализовано: у самого входа в
 * Ярость (system.inRage) в движке вообще нет стоимости действия, менять
 * нечего (combat/frenzy.mjs — единственное реализованное правило про
 * Ярость — лимит ПОВТОРНОГО входа, к которому эта строка не относится).
 *
 * Штраф −10 на I/P — источник правил (sources.mjs), а не прямое чтение в
 * attack.mjs: он действует ВСЕГДА, пока оружие снаряжено, не только во
 * время атаки этим оружием (тесты Интеллекта/Восприятия — отдельные
 * броски). Возвращает записи формата rules-format.md (см. hatred.mjs).
 */
/**
 * Наследие Ярости, ranged-ветка (стр. 427): «+1 к наибольшей RoF оружия или
 * RoF S/2−, если у него было RoF S/−/−.» «Наибольшая» — semi или full, какая
 * больше; ничья (обе >0 и равны) решается в пользу full как более «старшей»
 * очереди книжной таблицы. Возвращает НОВЫЕ rof_semi/rof_full, либо null —
 * не Наследие Ярости/не эта ветка (рукопашное оружие сюда не попадает,
 * см. legacyWrathRules выше про ту же Историю).
 */
export function legacyWrathRangedRof(weapon) {
  if (!weapon || weapon.system?.weaponClass === "melee") return null;
  if (!legacyHistoryIs(weapon, "Наследие Ярости")) return null;
  const semi = Number(weapon.system?.rof_semi) || 0;
  const full = Number(weapon.system?.rof_full) || 0;
  if (semi === 0 && full === 0) return { rof_semi: 2, rof_full: 0 };
  return full >= semi ? { rof_semi: semi, rof_full: full + 1 } : { rof_semi: semi + 1, rof_full: full };
}

/**
 * sys (или клон sys) с уже применённым бонусом legacyWrathRangedRof — тот же
 * приём клонирования, что Fanning/Быстрый Курок (combat/attack.mjs::
 * fanningSys): реальный предмет не трогаем, полем rof_semi/rof_full грузится
 * downstream-код (счёт попаданий, расход патронов, список режимов диалога).
 */
export function legacyWrathEffectiveRof(sys, weapon) {
  const bump = legacyWrathRangedRof(weapon);
  return bump ? { ...sys, ...bump } : sys;
}

/**
 * Наследие Предательства (История 4, стр. 427): «+1d5 Dmg против врагов, что
 * не видят персонажа, или Застигнуты Врасплох.» Оба условия УЖЕ разведены в
 * конвейере атаки (combat/attack.mjs) для Backstab/Quiet Elimination — unseen
 * (Незримое, стр. 32) и targetSurprised (галочка «Цель Врасплох»), здесь
 * только проверка, сработала ли История; сам d5 катает вызывающий код (нужен
 * await Roll, здесь — чистая функция без броска).
 */
export function betrayalLegacyActive({ weapon, hit, unseen, targetSurprised }) {
  if (!hit || !(unseen || targetSurprised)) return false;
  return legacyHistoryIs(weapon, "Наследие Предательства");
}

/**
 * Бесчестное/skilled 10-10 (стр. 428): «+1d10 Dmg против врагов, что не
 * видят персонажа, или Застигнуты Врасплох. Ещё +1d10, если они считают
 * персонажа союзником.» Первая половина — тот же unseen/targetSurprised, что
 * Наследие Предательства (betrayalLegacyActive), здесь только другая Мутация
 * и другой куб (d10, не d5). Вторая половина («считают персонажа союзником»,
 * т.е. цель заблуждается о принадлежности атакующего) честно НЕ реализована
 * — в системе нет состояния «цель X ошибочно считает актора Y своим», это
 * не то же самое, что Незримое/Врасплох (объективные факты сцены), а
 * субъективное заблуждение цели без структурного следа где-либо ещё в игре.
 */
export function dishonorableLegacyActive({ weapon, hit, unseen, targetSurprised }) {
  if (!hit || !(unseen || targetSurprised)) return false;
  return takenMutationNames(weapon).has("Бесчестное");
}

/** Флаг цели — DISTRACTING_LEGACY_FLAG на getFlag/setFlag (warhammer-dbc). */
export const DISTRACTING_LEGACY_FLAG = "legacyDistractingMark";

/**
 * Отвлекающее/skilled 3-4 (стр. 427-428), стрелковая: «Все остальные
 * персонажи получают бонус +10 на стрельбу по цели, в которую попало это
 * оружие.» Метка живёт на ЦЕЛИ (тот же приём, что Hex-Marked Prey,
 * rules/predicates.mjs::hexMarkedPreyAllyBonus) и переходит на самого
 * свежего поражённого — книга не даёт срока действия отдельно, «пока в
 * цель попадало» читается как «до следующего иного попадания», не «до
 * конца боя» (более сильная граница, чем большинство других Мутаций).
 * Без гонки по расе/принадлежности — «все остальные», не только союзники.
 *
 * Рукопашная ветка («Финт — тест на Charm(F) или I вместо WS») реализована
 * через legacyDistractingCharSwapRules ниже — grantFlag capability
 * charSwap.fel.forWs/charSwap.int.forWs, читается sheets/attack/mods.mjs.
 */
export function distractingLegacyActive(weapon) {
  return weapon?.system?.weaponClass !== "melee" && takenMutationNames(weapon).has("Отвлекающее");
}

/**
 * Наследие Излишеств (История 6, стр. 427), первая половина: «Персонаж
 * получает +1 Успех на все успешные тесты WS и BS с этим оружием.»
 * Прибавляется к СТЕПЕНИ (deg), не к Порогу — тот же приём, что Дикарь/
 * Savage (rules/dual-wield-talents.mjs::savageExtraHits), только по
 * Истории оружия, не по парным клинкам.
 */
export function excessLegacyExtraDeg({ hit, weapon }) {
  if (!hit) return 0;
  return legacyHistoryIs(weapon, "Наследие Излишеств") ? 1 : 0;
}

/** Идентификатор правила — общий с actor-sheet.mjs, которая ищет именно ЭТУ
 * галочку среди отмеченных, чтобы понять, был ли взят риск на КОНКРЕТНОМ
 * броске (см. каскад W+0/Порча, combat/legacy-weapon-excess.mjs). */
export const EXCESS_LEGACY_RULE_ID = "legacyExcess.charBonus";

/**
 * Наследие Излишеств, вторая половина: «...выбирает одну Характеристику,
 * кроме WS и BS, и пока держит оружие в руке может выбрать бонус +10 на все
 * тесты по ней, но при провале — тест на W+0 или 1 Порчи.» Выбранная
 * характеристика — weapon.system.legacy.excessChar (UI выбора — apps/
 * legacy-weapon.mjs). Сам бонус — ОПЦИОНАЛЬНАЯ галочка (без auto:true), тот
 * же общий конвейер (rules/roll-mods.mjs::ruleRollModsHtml), что уже
 * показывает Ненависть/Родной мир и т.п. на ЛЮБОМ тесте Навыка/Характеристики
 * листа (не только в диалоге атаки) — часть «пока держит оружие в руке»
 * приближена до «оружие экипировано» (то же допущение, что у Наследия
 * Ярости выше, — «в руке» вне сцены/боя система не отслеживает).
 */
export function legacyExcessRules(actor) {
  const weapon = equippedLegacyWeaponWithHistory(actor, "Наследие Излишеств");
  const char = String(weapon?.system?.legacy?.excessChar || "");
  if (!weapon || !char) return [];
  const abbr = CHARACTERISTICS[char]?.abbr ?? char.toUpperCase();
  return [{
    id: EXCESS_LEGACY_RULE_ID,
    label: `Наследие Излишеств: +10 на тест ${abbr} (риск — провал: W+0 или 1 Порчи)`,
    when: { charIn: [char] },
    effects: [{ kind: "rollBonus", target: "all", value: 10 }]
  }];
}

/**
 * Наследие Перемен (История 9, стр. 427): «В начале каждого Хода бросьте
 * 2d5 — до начала следующего Хода оружие получает такой бонус ко всем
 * тестам WS и BS. Если выпал дубль, вместо бонуса к тестам результат
 * ОДНОГО из кубиков добавляется к урону этого оружия.»
 *
 * Живёт флагом flags.warhammer-dbc.legacyChangeBonus ({weaponId, testBonus,
 * damageBonus}) — НЕ через общий реестр «гасят до начала следующего Хода»
 * (rules/turn-flags.mjs::TURN_SCOPED_FLAGS): та просто СНИМАЕТ метку, а эта
 * каждый Ход ЗАМЕНЯЕТСЯ новым броском — записать оба намерения в один
 * update («−=legacyChangeBonus: null» и «legacyChangeBonus: {…}» разом)
 * значило бы дать Foundry два противоречащих патча по одному ключу.
 * combat/action-economy.mjs::resetActionEconomy сама решает — новое
 * значение или явный снос (нет больше подходящего оружия).
 *
 * @returns {{weaponId:string, testBonus:number, damageBonus:number}|null}
 *   null — нет экипированного Оружия Наследия с этой Историей (флаг тогда
 *   не пишется вовсе, старое значение снимет общий реестр turn-flags.mjs).
 */
export async function rollLegacyChangeBonus(actor) {
  const weapon = equippedLegacyWeaponWithHistory(actor, "Наследие Перемен");
  if (!weapon) return null;
  const d1 = await new Roll("1d5").evaluate();
  const d2 = await new Roll("1d5").evaluate();
  const double = d1.total === d2.total;
  return {
    weaponId: weapon.id,
    testBonus: double ? 0 : d1.total + d2.total,
    damageBonus: double ? d1.total : 0
  };
}

/** Бонус Наследия Перемен к тесту WS/BS ИМЕННО этим оружием — 0, если флаг не про него. */
export function legacyChangeTestBonus(actor, weapon) {
  const flag = actor?.getFlag?.("warhammer-dbc", "legacyChangeBonus")
    ?? actor?.flags?.["warhammer-dbc"]?.legacyChangeBonus;
  if (!flag || String(flag.weaponId) !== String(weapon?.id)) return 0;
  return Number(flag.testBonus) || 0;
}

/** Бонус Наследия Перемен к урону ИМЕННО этим оружием (только на дубле) — 0, если флаг не про него. */
export function legacyChangeDamageBonus(actor, weapon, hit) {
  if (!hit) return 0;
  const flag = actor?.getFlag?.("warhammer-dbc", "legacyChangeBonus")
    ?? actor?.flags?.["warhammer-dbc"]?.legacyChangeBonus;
  if (!flag || String(flag.weaponId) !== String(weapon?.id)) return 0;
  return Number(flag.damageBonus) || 0;
}

/** Флаг цели — LEGACY_GUARDIAN_FLAG на getFlag/setFlag (warhammer-dbc), гасится turn-flags.mjs. */
export const LEGACY_GUARDIAN_FLAG = "legacyGuardianMark";

/**
 * Защитник/vigilant 8-8 (стр. 428), стрелковая: «Цель, по которой стреляли
 * из этого оружия, до начала её следующего Хода получает штраф −30 на атаки
 * по персонажу.» Правило безусловное (when читает predicates.mjs::
 * legacyGuardianMarked по ctx.targetActor) — этот источник просто отдаёт
 * его КАЖДОМУ актору, эффект сработает только тем, у кого метка есть (тот
 * же приём, что hatredRules — предикат сам решает, применяется ли).
 *
 * Рукопашная ветка («перебросить один проваленный тест Парирования в Раунд,
 * Баланс поднимается до 0») реализована напрямую в combat/defense.mjs —
 * НЕ через общий resolveTest-конвейер (Парирование, как и Уклонение, считает
 * свой Порог/переброс напрямую), а через локальный примитив этого файла же
 * (guardianLegacyMeleeActive/guardianLegacyBalanceFloor/
 * LEGACY_GUARDIAN_PARRY_REROLL_CAPABILITY, раз-в-Раунд, ниже).
 */
/**
 * Скорая Кончина/versatile 7-7 (стр. 428): «Первое успешное попадание этого
 * оружия в бой наносит +3 Dmg. Попадания, блокированные силовыми щитами,
 * считаются как промахи.» «В бой» — once per battle, тот же примитив, что
 * лимит повторного входа в Ярость (combat/frenzy.mjs::frenzyEntryBlocked,
 * isCapabilityAvailable(actor, flag, "battle")).
 *
 * Второе предложение («блокированные щитом — промахи») честно НЕ реализовано
 * — «блокировано силовым щитом» решается позже, при применении урона
 * (module/combat/damage.mjs), не в момент попадания здесь; там уже поздно
 * превращать это конкретное попадание в промах постфактум без более широкой
 * переработки конвейера.
 */
export const EARLY_DEATH_LEGACY_FLAG = "legacyEarlyDeath";

/**
 * Адаптивное/versatile 8-8 (стр. 428), рукопашная: «+1 Dmg, когда противник
 * имеет численный перевес в рукопашной; когда перевес 2к1 — ещё и +10 на
 * тесты WS; когда 3к1 — враги получают штраф −10 на рукопашные атаки по
 * персонажу.» attackerContactCount — число ВРАГОВ АТАКУЮЩЕГО в контакте с
 * НИМ САМИМ (не с целью — то же combat/tactical-map.mjs::meleeContactCount,
 * что уже считает Дуэлянтское/«Числ. перевес» цели, но с обратным токеном).
 *
 * Третье предложение («враги получают −10 на атаки по персонажу») —
 * adaptiveLegacyDefenderPenalty ниже (wdbc-bjy1.13): считается в диалоге
 * атаки со стороны атакующего по цели, живой геометрией контакта.
 * Стрелковая ветка («+10 попадание и +1 Успех, когда враги превосходят
 * числом персонажа И его союзников») честно НЕ реализована вовсе — иной
 * масштаб подсчёта (весь бой, не контакт вплотную), не то же geometry, что
 * здесь.
 */
export function adaptiveLegacyMeleeDamageBonus({ weapon, hit, attackerContactCount }) {
  if (!hit || weapon?.system?.weaponClass !== "melee" || !takenMutationNames(weapon).has("Адаптивное")) return 0;
  return (attackerContactCount ?? 0) >= 2 ? 1 : 0;
}

// Ступени отдельны, не нарастают (решение владельца, wdbc-bjy1.2): +10 WS
// только при 2к1 ровно; при 3к1 его место занимает третья ступень — как
// строки «Численный перевес 2к1 +10 / 3к1 +20» общей таблицы модификаторов.
export function adaptiveLegacyMeleeWsBonus({ weapon, attackerContactCount }) {
  if (weapon?.system?.weaponClass !== "melee" || !takenMutationNames(weapon).has("Адаптивное")) return 0;
  return attackerContactCount === 2 ? 10 : 0;
}

/**
 * Третья ступень Адаптивного (стр. 428, wdbc-bjy1.13): «когда 3к1 — враги
 * получают штраф −10 на рукопашные атаки по персонажу». Ступени отдельны
 * (wdbc-bjy1.2): при 3к1 эта заменяет +10 WS второй. Считается со стороны
 * АТАКУЮЩЕГО по цели, у которой в руках Адаптивное рукопашное оружие;
 * targetContactCount — врагов цели в контакте с ней (та же meleeContactCount
 * от токена цели, что у «Числ. перевес 3к1» в диалоге атаки).
 */
export function adaptiveLegacyDefenderPenalty({ targetActor, targetContactCount, isMelee }) {
  if (!isMelee || (Number(targetContactCount) || 0) < 3) return 0;
  const wields = [...(targetActor?.items ?? [])].some(i => i?.type === "weapon" && i.system?.equipped
    && i.system?.weaponClass === "melee" && takenMutationNames(i).has("Адаптивное"));
  return wields ? -10 : 0;
}

export function earlyDeathLegacyDamageBonus({ weapon, actor, hit }) {
  if (!hit || !takenMutationNames(weapon).has("Скорая Кончина")) return 0;
  return isCapabilityAvailable(actor, EARLY_DEATH_LEGACY_FLAG, "battle") ? 3 : 0;
}

/** Отмечает использование — звать ПОСЛЕ применения бонуса, тем же тактом атаки. */
export async function markEarlyDeathLegacyUsed(actor, weapon, hit) {
  if (!hit || !takenMutationNames(weapon).has("Скорая Кончина")) return;
  await markCapabilityUsed(actor, EARLY_DEATH_LEGACY_FLAG, "battle");
}

export function legacyGuardianRules() {
  return [{
    id: "legacyGuardian.rangedPenalty",
    label: "Защитник: −30 на атаки по отметившему стрелку",
    when: { legacyGuardianMarked: true },
    effects: [{ kind: "rollBonus", target: "attack", value: -30 }]
  }];
}

export function legacyWrathRules(actor) {
  // Штраф I/P — только рукопашная ветка Истории (ranged-ветка вместо него
  // даёт RoF+принуждение, другой книжный текст, см. заголовок функции).
  const weapon = equippedLegacyWeaponWithHistory(actor, "Наследие Ярости");
  if (!weapon || weapon.system?.weaponClass !== "melee") return [];
  return [
    {
      id: "legacyWrath.charPenalty",
      label: "Наследие Ярости: штраф на I/P, пока вооружён Оружием Наследия",
      when: { charIn: ["int", "per"] },
      effects: [{ kind: "rollBonus", target: "all", value: -10, auto: true }]
    }
  ];
}

// ════════════════════════════════════════════════════════════════════════
//  «4 СИСТЕМНЫХ ПРОБЕЛА» (после 15/35 baseline)
// ════════════════════════════════════════════════════════════════════════

/**
 * Наследие Крови, третья часть (стр. 427): «+10 на встречные тесты против
 * психосил и выжигания души, пока вооружён» — 2 из 4 книжных категорий
 * (психосилы, выжигание души; демонические дары как психосила Хаос-NAT
 * покрыты тем же путём автоматически). Одержимость и добровольная выдача
 * Дара Демон-Принцем честно НЕ реализованы — тестов сопротивления для них в
 * коде нет вовсе (wdbc-1rno.46). Общий тег ctx.psychicThreat
 * (rules/resolve-test.mjs, scope "psychicthreat") протащен через ВСЮ цепочку
 * делегированных тестов (psy-resist-request-btn/hooks.mjs/_rollCharacteristic
 * и напрямую в hooks.mjs::_executeSoulBurn). auto:true — книга не даёт
 * выбора, эффект идёт в autoMods, не в список опциональных галочек (без
 * auto:true бонус молча не применялся бы — поймано end-to-end тестом).
 */
export function legacyBloodPsychicRules(actor) {
  const weapon = equippedLegacyWeaponWithHistory(actor, "Наследие Крови");
  if (!weapon) return [];
  return [{
    id: "legacyBloodPsychic.resistBonus",
    label: "Наследие Крови: +10 на встречный тест против психической угрозы",
    when: {},
    effects: [{ kind: "rollBonus", target: "psychicthreat", value: 10, auto: true }]
  }];
}

/**
 * Инстинктивное/versatile 1-2 (стр. 428): «...и оно не может быть вырвано
 * или выбито у него из рук.» — переиспользует уже готовую capability
 * combat.cannotBeDisarmed (тот же ключ, что Присоски/Tentacle, wdbc-egll),
 * тем же приёмом grantFlag, что legacyWrathRules/legacyGuardianRules.
 *
 * Первое предложение той же записи («достаёт/складывает за свободное
 * действие, независимо от разгрузки») честно НЕ реализовано — стоимость
 * Достать/Сложить (module/sheets/tabs/gear.mjs::equipItem) сейчас фиксирована
 * (1 ОД на любой предмет), не параметризована по конкретному оружию, а
 * «независимо от разгрузки» ссылается на Quick Draw/Quick Store — сами
 * незаведённые capability-заглушки (constants/capabilities.mjs) — сначала
 * нужна была бы их собственная реализация, это не однострочная правка внутри
 * этой находки.
 */
export function legacyInstinctiveDisarmRules(actor) {
  if (!equippedLegacyWeaponWithMutation(actor, "Инстинктивное")) return [];
  return [{
    id: "legacyInstinctive.disarmImmune",
    label: "Инстинктивное: нельзя быть обезоруженным",
    when: {},
    effects: [{ kind: "grantFlag", target: "combat.cannotBeDisarmed" }]
  }];
}

/**
 * Отвлекающее/skilled 3-4, Оружие Наследия, рукопашная ветка (wdbc-1rno.35,
 * стр. 427-428): «При проведении Финта персонаж может проходить тест на
 * Charm(Fel) или Int вместо WS.» Ответ на уточняющий вопрос пользователя —
 * «I» книги читается как «Int»/Интеллект, не Initiative. grantFlag —
 * capability charSwap.wp.forWsS (module/sheets/attack/mods.mjs::
 * charSwapWhy) — только на fel/int вместо wp, и только рукопашная ветка
 * (мутация одна на все виды атаки, а книга разрешает подмену именно для
 * рукопашного WS-теста Финта).
 *
 * Честно: подпись у пункта выбора характеристики в диалоге атаки — это
 * РАЗРЕШЕНИЕ («книга это допускает»), не автоматическое ГЕЙТИРОВАНИЕ по
 * тому, выбран ли СЕЙЧАС именно Приём «Финт» — тот же уровень проверки,
 * что уже принят для Локуса Мутации (attack-dialog.mjs не знает, какой
 * Приём выбран, на момент построения списка характеристик; выбор Финта
 * и корректность применения — на игроке/ГМ, как и там).
 */
export function legacyDistractingCharSwapRules(actor) {
  const weapon = equippedLegacyWeaponWithMutation(actor, "Отвлекающее");
  if (!weapon || weapon.system?.weaponClass !== "melee") return [];
  return [{
    id: "legacyDistracting.charSwap",
    label: "Отвлекающее: Charm(Fel) или Int вместо WS при Финте",
    when: {},
    effects: [
      { kind: "grantFlag", target: "charSwap.fel.forWs" },
      { kind: "grantFlag", target: "charSwap.int.forWs" }
    ]
  }];
}

/** Флаг «модификатор последней атаки этим оружием» — гасится turn-flags.mjs, тратится defense.mjs. */
export const LEGACY_PENDULUM_FLAG = "legacyPendulumBonus";

/**
 * Маятник/vigilant 7-7 (стр. 427): «Если персонаж атаковал этим оружием в
 * свой Ход, один раз до начала следующего Хода он может получить бонус к
 * тесту Избегания, равный модификатору к последней атаке этим оружием.»
 * Не гейтится попаданием — книга говорит «атаковал», не «попал». Модификатор
 * атаки — это порог теста МИНУС голая характеристика (WS/BS.total), то есть
 * ровно то, что сверх нее насчитал диалог атаки; считает вызывающая сторона
 * (attack.mjs, там уже есть и threshold, и charKey).
 * @returns {?{weaponId:string, bonus:number}} что положить во флаг, или null (не Маятник — флаг не трогаем).
 */
export function pendulumLegacyFlagValue(weapon, attackModifier) {
  if (!takenMutationNames(weapon).has("Маятник")) return null;
  return { weaponId: weapon.id, bonus: Number(attackModifier) || 0 };
}

/** Бонус к текущему тесту Избегания от Маятника — 0, если флага нет (defense.mjs гасит его после чтения, «один раз»). */
export function pendulumLegacyBonus(actor) {
  return Number(actor?.getFlag?.("warhammer-dbc", LEGACY_PENDULUM_FLAG)?.bonus) || 0;
}

/** Раз-в-Раунд ключ переброса Парирования (module/rules/cooldown.mjs, unit:"round"). */
export const LEGACY_GUARDIAN_PARRY_REROLL_CAPABILITY = "mutation.legacyGuardianParryReroll";

/**
 * Защитник/vigilant 8-8, рукопашная ветка (wdbc-1rno.35, стр. 428): «Может
 * перебросить один проваленный тест Парирования в Раунд. Если его Баланс
 * ниже 0, он поднимается до 0.» Реализовано напрямую в combat/defense.mjs —
 * тест Парирования не проходит через общий resolveTest-конвейер.
 */
export function guardianLegacyMeleeActive(weapon) {
  return weapon?.system?.weaponClass === "melee" && takenMutationNames(weapon).has("Защитник");
}

/** Баланс не ниже 0 при активном Защитнике на этом оружии — 0 подставляется вместо отрицательного. */
export function guardianLegacyBalanceFloor(weapon, rawBalance) {
  if (!guardianLegacyMeleeActive(weapon)) return rawBalance;
  return Math.max(0, Number(rawBalance) || 0);
}

/**
 * Неприкасаемый/vigilant 5-6 (стр. 428): «Рукопашная: в Защитной Стойке
 * персонаж может перебрасывать тесты Избегания. Стрелковая: находясь в
 * Укрытии — то же.» Книга не говорит «этим оружием» (в отличие от
 * Защитника выше) — это личная способность от факта ношения ЛЮБОГО
 * экипированного Оружия Наследия с этой Мутацией, не только того, которым
 * защищаются (то же чтение, что Наследие Ярости/Крови — «пока вооружён»).
 * Мелкий/стрелковый класс оружия С ЭТОЙ Мутацией решает, какое условие
 * действует (Стойка или Укрытие) — оружие только одно, обе ветки книги не
 * бывают активны разом у одного персонажа.
 *
 * `inCover` вычисляет вызывающая сторона (defense.mjs, через уже готовый
 * combat/cover.mjs::coverBonusForShot) — этот модуль документов Foundry не
 * касается.
 */
export function unassailableLegacyDodgeAdvantage(actor, inCover) {
  const weapon = equippedLegacyWeaponWithMutation(actor, "Неприкасаемый");
  if (!weapon) return false;
  const melee = weapon.system?.weaponClass === "melee" || weapon.system?.weaponClass === "thrown";
  return melee ? actor?.system?.meleeStance === "defensive" : !!inCover;
}

/** Раз-в-Раунд ключ переброса (module/rules/cooldown.mjs, unit:"round"). */
export const LEGACY_UNBREAKABLE_REROLL_CAPABILITY = "mutation.legacyUnbreakableReroll";

/**
 * Неприступное/versatile 5-6 (стр. 428): «Раз в Раунд может перебросить
 * тест на Избегание, игнорируя негативные модификаторы этого оружия.»
 * Реализовано напрямую в defense.mjs, тем же приёмом, что Защитник выше.
 */
export function unbreakableLegacyActive(weapon) {
  return takenMutationNames(weapon).has("Неприступное");
}

/** Игнорирует отрицательный Баланс этого оружия — используется вместе с переброс-капабилити выше. */
export function unbreakableLegacyBalanceFloor(weapon, rawBalance) {
  if (!unbreakableLegacyActive(weapon)) return rawBalance;
  return Math.max(0, Number(rawBalance) || 0);
}

/** Флаг «накопленный штраф Карателя» на ЦЕЛИ, ключ — id оружия. */
export const LEGACY_PUNISHER_FLAG = "legacyPunisherStacks";

/**
 * Каратель/merciless 8-8 (стр. 428): «За каждое успешное попадание оружие
 * получает накапливающийся +3 на попадание по НЕМУ до конца боя. Атаки с
 * множественными попаданиями считаются как одно.» Счётчик — на ЦЕЛИ
 * (actor, тот кого атаковали ЭТИМ оружием), ключ id самого оружия —
 * несколько разных Карателей по одной цели копят независимо.
 */
export function punisherLegacyBonus(targetActor, weapon) {
  const stacks = targetActor?.getFlag?.("warhammer-dbc", LEGACY_PUNISHER_FLAG) ?? {};
  return Number(stacks[weapon?.id]) || 0;
}

/** Инкремент на +3 — звать ОДИН раз за успешную атаку (не за попадание Очереди), attack.mjs. */
export async function incrementPunisherLegacyStack(targetActor, weapon) {
  if (!targetActor || !weapon) return;
  const stacks = { ...(targetActor.getFlag?.("warhammer-dbc", LEGACY_PUNISHER_FLAG) ?? {}) };
  stacks[weapon.id] = (Number(stacks[weapon.id]) || 0) + 3;
  await targetActor.setFlag("warhammer-dbc", LEGACY_PUNISHER_FLAG, stacks);
}

/** Снять накопленное — конец боя (module/hooks.mjs::deleteCombat). */
export async function clearLegacyPunisherStacks(actor) {
  if (actor?.getFlag?.("warhammer-dbc", LEGACY_PUNISHER_FLAG)) {
    await actor.unsetFlag("warhammer-dbc", LEGACY_PUNISHER_FLAG);
  }
}

/**
 * Инстинктивное/versatile 1-2 (стр. 428): «+2 к Инициативе, когда носит
 * его» — решение НЕ через ActiveEffect (wdbc-1rno.47): в rules/
 * initiative.mjs уже есть прецедент ровно такой формы — Талант «Самая
 * Быстрая Рука» (fastestHandBonus), «надбавка, которую эффектом не
 * выразить, пересчитывается каждый цикл». Слагаемое в rules/character/
 * final-pools.mjs::prepareFinalPools, та же строка, что fastestHandBonus.
 */
export function legacyInstinctiveInitiativeBonus(actor) {
  return equippedLegacyWeaponWithMutation(actor, "Инстинктивное") ? 2 : 0;
}

/**
 * Без Предупреждения/versatile 9-9 (стр. 428): «Даёт +½Inf.b(окр.▲) к
 * Инициативе, даже если оружие сложено» — «даже сложено» прочитано
 * буквально: гейт только по equipped, не по занятости рук (в отличие от
 * Самой Быстрой Руки, которая именно про занятость рук).
 *
 * Второе предложение той же записи («в первый Раунд боя атакует врагов с
 * меньшей/равной вдвое Инициативой как Застигнутых Врасплох») — см.
 * sheets/attack/mods.mjs::legacyForewarnedSurprise (auto-check существующей
 * галочки «Цель Врасплох»), не здесь.
 */
export function legacyForewarnedInitiativeBonus(actor, infBonus) {
  if (!equippedLegacyWeaponWithMutation(actor, "Без Предупреждения")) return 0;
  return Math.ceil((Number(infBonus) || 0) / 2);
}

// ════════════════════════════════════════════════════════════════════════
//  «9 РЕАЛИЗУЕМЫХ + 3 БОЛЬШИХ» (после компакции)
// ════════════════════════════════════════════════════════════════════════

/** Ревёрт-флаг на самом оружии — originalRating Felling до активации Убийцы. */
export const LEGACY_KILLER_FELLING_FLAG = "legacyKillerFellingRevert";

/**
 * Убийца/fearsome 9-9 (стр. 427): «Может потратить Очко Бесчестия, чтобы до
 * конца боя дать оружию Felling(Inf.b) или +1 к рейтингу, если оно уже
 * было.» Кнопка — apps/legacy-weapon.mjs::activateKillerLegacyFelling.
 * @returns {{props: object[], originalRating: ?number}}
 */
export function killerLegacyFellingProps(weapon, infBonus) {
  const props = [...(weapon?.system?.weaponProps ?? [])];
  const idx = props.findIndex(p => p?.key === "felling");
  if (idx === -1) return { props: [...props, { key: "felling", rating: infBonus }], originalRating: null };
  const originalRating = Number(props[idx].rating) || 0;
  const next = [...props];
  next[idx] = { ...next[idx], rating: originalRating + 1 };
  return { props: next, originalRating };
}

/** Флаг буста Перебора на АКТОРЕ — {weaponId, turnsLeft}. */
export const LEGACY_EXCESS_BOOST_FLAG = "legacyExcessBoost";

/** Активен ли буст Перебора именно для этого оружия. */
export function legacyExcessBoostActive(actor, weapon) {
  const boost = actor?.getFlag?.("warhammer-dbc", LEGACY_EXCESS_BOOST_FLAG);
  return !!(boost && String(boost.weaponId) === String(weapon?.id) && (Number(boost.turnsLeft) || 0) > 0);
}

/** Тик буста — звать из combat/action-economy.mjs::resetActionEconomy на старте Хода носителя; гасит флаг по исчерпании. */
export async function tickLegacyExcessBoost(actor) {
  const boost = actor?.getFlag?.("warhammer-dbc", LEGACY_EXCESS_BOOST_FLAG);
  if (!boost) return;
  const left = (Number(boost.turnsLeft) || 0) - 1;
  if (left <= 0) await actor.unsetFlag("warhammer-dbc", LEGACY_EXCESS_BOOST_FLAG);
  else await actor.setFlag("warhammer-dbc", LEGACY_EXCESS_BOOST_FLAG, { ...boost, turnsLeft: left });
}

/** Флаг «заряженный бонус урона Душесвязанного» — гасится turn-flags.mjs (не потрачен к началу след. Хода), тратится attack.mjs на первом попадании этим оружием. */
export const LEGACY_SOULBOUND_FLAG = "legacySoulboundBonus";

/**
 * Душесвязанное/skilled 7-7 (wdbc-1rno.35, стр. 427): «Персонаж может за
 * свободное действие пройти тест на W+0, чтобы увеличить урон следующего
 * попадания оружия до начала следующего Хода на (½W.b (окр.▲)). Если он
 * псайкер, он может вместо этого пройти Психотест через W+0, чтобы
 * увеличить урон на его эPR, но если он вызовет Феномен, оружие Заклинивает
 * сразу после выстрела.» Заряжается кнопкой на листе оружия
 * (apps/legacy-weapon.mjs::activateSoulboundLegacyBonus), читается здесь.
 */
export function soulboundLegacyDamageBonus(actor, weapon, hit) {
  if (!hit) return 0;
  const flag = actor?.getFlag?.("warhammer-dbc", LEGACY_SOULBOUND_FLAG);
  if (!flag || flag.weaponId !== weapon?.id) return 0;
  return Number(flag.bonus) || 0;
}

/**
 * Гасит флаг после применения (звать ПОСЛЕ учёта бонуса в уроне, тем же
 * тактом атаки). «Заклинивает сразу после выстрела» книга привязывает к
 * самому выстрелу/удару, не к моменту Психотеста — поэтому Заклинивание
 * (если Феномен сорвался при зарядке) применяется здесь, на попадании,
 * которое как раз потратило заряженный бонус, а не сразу при активации
 * кнопки. Бонус, так и не потраченный до начала следующего Хода, гасится
 * turn-flags.mjs без Заклинивания — книга обуславливает его «выстрелом»,
 * которого в этом случае не было.
 */
export async function consumeSoulboundLegacyBonus(actor, weapon, hit) {
  if (!hit) return;
  const flag = actor?.getFlag?.("warhammer-dbc", LEGACY_SOULBOUND_FLAG);
  if (!flag || flag.weaponId !== weapon?.id) return;
  await actor.unsetFlag("warhammer-dbc", LEGACY_SOULBOUND_FLAG);
  if (flag.willJam) await weapon.update({ "system.jammed": true });
}

/** Флаг «временный AP-щит Щита Ненависти» — гасится turn-flags.mjs к началу следующего своего Хода; не «тратится» отдельным чтением — щит держится весь этот срок, сколько бы попаданий ни пришло. */
export const LEGACY_HATRED_SHIELD_FLAG = "legacyHatredShield";

// legacyHatredShieldArms («какая рука держит оружие») намеренно живёт в
// apps/legacy-weapon.mjs, не здесь: ей нужен rules/hands.mjs
// (weaponHandsRequired/getHeldHand), а тот транзитивно тянет rules/flags.mjs
// → rules/collect.mjs → rules/sources.mjs — тот самый файл, что уже
// импортирует ЭТОТ модуль (registerRuleSource на legacyWrathRules и т.д.
// выше). Импорт hands.mjs отсюда замкнул бы sources.mjs → legacy-weapon.mjs →
// hands.mjs → … → sources.mjs в цикл, на котором зависает vitest (не Node
// напрямую — молча вешает test/rules/scaffold.test.mjs). apps/ — не часть
// этого графа, там тот же импорт безопасен.

/** AP-бонус Щита Ненависти для этой зоны поглощения — 0, если флага нет или зона им не покрыта. */
export function legacyHatredShieldApForLocation(actor, armorKey) {
  const flag = actor?.getFlag?.("warhammer-dbc", LEGACY_HATRED_SHIELD_FLAG);
  if (!flag) return 0;
  if (armorKey === "body" || (Array.isArray(flag.arms) && flag.arms.includes(armorKey))) {
    return Number(flag.bonus) || 0;
  }
  return 0;
}

/** Раз-в-бой ключ (module/rules/cooldown.mjs, unit:"battle") — та же замена «боя или сцены», что у Скорой Кончины выше. */
export const LEGACY_DEADLY_TRAP_FLAG = "legacyDeadlyTrap";

/**
 * Смертельная Ловушка/vigilant 10-10 (wdbc-1rno.35, стр. 427): «Один раз за
 * бой или сцену, попадая по противнику вне своего Хода (после Избеганий, но
 * до броска на урон и щиты), персонаж может увеличить бонус к урону с
 * ½Inf.b до 2×Inf.b.» Общий бонус Оружия Наследия «+½Inf.b(окр.▲) к Dmg»
 * (стр. 426) запечён в system.damage при Возвышении, а не читается заново
 * каждой атакой (legacyBonus выше — только инструмент запекания) — поэтому
 * эта функция возвращает РАЗНИЦУ (2×Inf.b − ½Inf.b(окр.▲) от ТЕКУЩЕГО
 * Inf.b), которую вызывающая сторона (attack.mjs) добавляет ПОВЕРХ уже
 * запечённого числа для этого одного попадания. Если Inf.b изменился после
 * Возвышения оружия — запечённая часть могла отстать от текущего Inf.b, это
 * старый пробел самого запекания, не новый от этой Мутации.
 */
export function legacyDeadlyTrapDamageDelta(actor) {
  const infBonus = num(actor?.system?.characteristics?.inf?.bonus);
  return 2 * infBonus - Math.ceil(infBonus / 2);
}

/** Доступна ли кнопка «Смертельная Ловушка» на этом попадании — считает attack.mjs (там уже есть actor/hit/своя-очередь-Хода). */
export function legacyDeadlyTrapEligible({ weapon, actor, hit, isOwnTurn }) {
  return !!(hit && !isOwnTurn && takenMutationNames(weapon).has("Смертельная Ловушка")
    && isCapabilityAvailable(actor, LEGACY_DEADLY_TRAP_FLAG, "battle"));
}

/** Отмечает использование — звать по клику кнопки на карточке урона (hooks.mjs), не автоматически. */
export async function markLegacyDeadlyTrapUsed(actor) {
  await markCapabilityUsed(actor, LEGACY_DEADLY_TRAP_FLAG, "battle");
}

// ════════════════════════════════════════════════════════════════════════
//  СВЕЖАЯ СВЕРКА 21.09.2026: Тихое, Наследие Бойни, Терпение
// ════════════════════════════════════════════════════════════════════════

/**
 * Тихое/skilled 1-2 (wdbc-1rno.35, стр. 427): «Тесты на нахождение персонажа,
 * базированные на звуке оружия и криках раненных и убитых им, получают штраф
 * −30.» Область действия (решение пользователя 21.09.2026): тесты на
 * Бдительность/Awareness с выбранной целью — носителем этого оружия. Читает
 * ЦЕЛЬ теста (ctx.targetActor), не самого бросающего — обратное направление,
 * тот же примитив, что «Уравнитель» (rules/item-rules.mjs::
 * opposedTargetRerollRules): правило регистрируется на роллящего, но
 * проверяет снаряжение цели.
 */
export function legacyQuietAwarenessRules(actor, ctx = {}) {
  const target = ctx?.targetActor;
  if (!target) return [];
  if (!equippedLegacyWeaponWithMutation(target, "Тихое")) return [];
  return [{
    id: "legacyQuiet.awarenessPenalty",
    label: "Тихое: цель труднее найти по звуку её оружия — Бдительность −30",
    when: { skill: "awareness" },
    effects: [{ kind: "rollBonus", target: "all", value: -30, auto: true }]
  }];
}

/** Флаг «заряженный бонус/штраф Наследия Бойни» — весь срок жизни книга не ограничивает Ходом (в отличие от Маятника/Душесвязанного), поэтому НЕ в TURN_SCOPED_FLAGS: держится до фактически следующей атаки этим оружием, сколько бы Раундов это ни заняло. */
export const LEGACY_SLAUGHTER_FLAG = "legacySlaughterBonus";

/**
 * Наследие Бойни (H1, стр. 426): «После убийства врага этим оружием персонаж
 * получает +20 на следующую атаку им. Получает штраф −30 на нелетальные
 * Приёмы, вроде Оглушить или Обезоружить.» Регистрирует убийство — звать из
 * setDeceased (sheets/tabs/body.mjs), тем же тактом, что
 * registerLegacyDreadfulKill/triggerLegacyGleeOnFateSave.
 */
export async function registerLegacySlaughterKill(weapon) {
  if (!weapon?.actor || !legacyHistoryIs(weapon, "Наследие Бойни")) return;
  await weapon.actor.setFlag("warhammer-dbc", LEGACY_SLAUGHTER_FLAG, { weaponId: weapon.id });
}

/**
 * Дельта к порогу СЛЕДУЮЩЕЙ атаки этим оружием (решение пользователя
 * 21.09.2026 — одно окно возможностей, не два параллельных эффекта): +20
 * обычно, −30 вместо него, если это Оглушить (Приём с известным оружием —
 * sheets/attack/selection.mjs). Обезоружить/Grapple-контест
 * (combat/techniques.mjs::_showContestDialog) честно НЕ покрыт: та точка
 * входа не несёт Item оружия вовсе (см. combat/grapple.mjs:387), различить
 * «этим оружием» там нечем.
 */
export function legacySlaughterThresholdDelta(actor, weapon, maneuverKey = null) {
  const flag = actor?.getFlag?.("warhammer-dbc", LEGACY_SLAUGHTER_FLAG);
  if (!flag || flag.weaponId !== weapon?.id) return 0;
  return maneuverKey === "stun" ? -30 : 20;
}

/** Гасит флаг — звать ПОСЛЕ фактического броска атаки этим оружием (attack.mjs), независимо от исхода: книга даёт ОДНУ следующую атаку, не длящийся эффект. */
export async function consumeLegacySlaughterBonus(actor, weapon) {
  const flag = actor?.getFlag?.("warhammer-dbc", LEGACY_SLAUGHTER_FLAG);
  if (!flag || flag.weaponId !== weapon?.id) return;
  await actor.unsetFlag("warhammer-dbc", LEGACY_SLAUGHTER_FLAG);
}

/**
 * «Нелетальный боеприпас» (Наследие Бойни, стрелковая ветка) не существует
 * структурно в системе — ни поля, ни свойства (проверено, wdbc-1rno.35,
 * сверка 21.09.2026). Закрытый список по имени — решение пользователя
 * 21.09.2026, а не «0 урона»: собственный первый пример пользователя
 * (Pellet/Капсула) сам наносит урон (1d5, −2), просто книжно считается
 * нелетальным патроном — критерий «0 урона» отсеял бы его же пример.
 * Rope/Верёвка (тоже названа пользователем) в паке не найдена ни под этим,
 * ни под похожим именем — не включена, не выдумываю несуществующий предмет.
 */
const NON_LETHAL_AMMO_NAMES = [
  // itemHasName сравнивает по ОДНОЙ половине двуязычного имени — сюда
  // английская половина каждого предмета, как в packs-src.
  "Pellet", "Net", "Shardsong", "Hypergrowth", "Morpheus", "Ulysses", "Foam", "Containment Foam"
];

/** Заряженный боеприпас — из закрытого списка «нелетальных» выше. */
export function isNonLethalLegacyAmmo(ammoItem) {
  return NON_LETHAL_AMMO_NAMES.some(n => itemHasName(ammoItem, n));
}

/**
 * Наследие Бойни, стрелковая ветка: «Понижает свою Надёжность до −2 при
 * стрельбе нелетальными боеприпасами.» Не «−2 к Надёжности», а «Надёжность
 * СТАНОВИТСЯ −2» — книга задаёт абсолютное значение, не дельту; вызывающая
 * сторона (attack.mjs) обязана присвоить это возвращённое число напрямую
 * (wp.reliabilityScore = ...), не прибавить.
 */
export function legacySlaughterAmmoReliability(weapon, ammoItem) {
  if (!legacyHistoryIs(weapon, "Наследие Бойни") || !isNonLethalLegacyAmmo(ammoItem)) return null;
  return -2;
}

/** Флаг «следующий выстрел из Караула этим Терпением заряжен +30» — тот же приём, что hairTriggerUnseenPending (rules/hair-trigger.mjs), но не встречный тест, а безусловно от Мутации. */
export const LEGACY_PATIENCE_OVERWATCH_FLAG = "legacyPatienceOverwatchPending";

/** Терпение/vigilant 3-4, стрелковая ветка (wdbc-1rno.35/wdbc-1rno.41, стр. 427-428). */
export function patienceLegacyOverwatchWeapon(weapon) {
  return !!weapon && takenMutationNames(weapon).has("Терпение");
}

/** Пометить следующий выстрел из Караула — звать из combat/overwatch.mjs::resolveOverwatchFireClick, когда оружие несёт Терпение. */
export async function markPatienceLegacyOverwatchPending(actor) {
  await actor.setFlag("warhammer-dbc", LEGACY_PATIENCE_OVERWATCH_FLAG, true);
}

/** Величина заряженного бонуса — 30, если помечен, иначе 0 (для авто-галочки sheets/attack/mods.mjs). */
export function patienceLegacyOverwatchBonus(actor) {
  return actor?.getFlag?.("warhammer-dbc", LEGACY_PATIENCE_OVERWATCH_FLAG) ? 30 : 0;
}

/** Гасит пометку — звать ПОСЛЕ фактического броска атаки (attack.mjs), независимо от исхода: книга даёт ОДНОМУ выстрелу, не длящийся эффект. */
export async function consumePatienceLegacyOverwatchPending(actor) {
  if (!actor?.getFlag?.("warhammer-dbc", LEGACY_PATIENCE_OVERWATCH_FLAG)) return;
  await actor.unsetFlag("warhammer-dbc", LEGACY_PATIENCE_OVERWATCH_FLAG);
}

/**
 * Терпение, рукопашная половина (wdbc-1rno.41, стр. 427): «Если этим
 * оружием атакуют совершающего Натиск противника, используя Задержку, оно
 * всегда действует первым и получает +30 на попадание.» Детект «атакует
 * Задержкой» — решение пользователя 21.09.2026: банкованное 1 ОД
 * (combat/delay-action.mjs — «банк это буквально system.actionPoints.value,
 * урезанное до 1») плюс цель в Натиске. «Не свой Ход» — отдельная проверка
 * НЕ здесь: isActorsOwnTurn живёт в combat/delay-action.mjs, который
 * транзитивно тянет combat/action-economy.mjs, а тот уже импортирует ЭТОТ
 * файл (rollLegacyChangeBonus/tickLegacyExcessBoost) — импорт назад замкнул
 * бы цикл. Вызывающая сторона (sheets/attack/mods.mjs) обязана добавить
 * !isActorsOwnTurn(actor) сама.
 */
export function patienceLegacyMeleeChargeInterruptActive({ actor, weapon, defenderActor }) {
  if (!actor || !weapon || !defenderActor) return false;
  if (!takenMutationNames(weapon).has("Терпение")) return false;
  if (defenderActor.system?.meleeBase !== "charge") return false;
  return (Number(actor.system?.actionPoints?.value) || 0) === 1;
}
