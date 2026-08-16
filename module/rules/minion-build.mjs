// module/rules/minion-build.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Счёт при создании Миньона (корбук стр. 111-113): бюджеты, потолки, слоты и
//  производные величины.
//
//  Здесь нет ни Foundry, ни листа — только числа. Генератор (apps/minion-
//  creator.mjs) показывает то, что насчитано тут, а панель СОЦИУМа берёт
//  отсюда же счётчик слотов: два места считают одно и то же, и разъехаться им
//  негде.
//
//  Правило книги о перерасходе мягкое: «Готово» не запирается, перерасход
//  только виден. Поэтому функции возвращают остаток со знаком, а не «можно
//  или нельзя»: решение принимает окно, а не расчёт.
// ════════════════════════════════════════════════════════════════════════════

import { MINION_GROUPS, MINION_TIERS, GROUP_CHAR_LIMITS, MINION_INFAMY_CAP,
         MINION_WOUNDS, FRAGILE_TRAITS, DAEMON_CORRUPTION, MINION_TALENT_FLAG,
         MINION_TALENT_NAMES, tierBudget } from "../constants/minions.mjs";

const num = v => Number(v) || 0;

/** Бонус характеристики — её десятки, как везде в системе. */
const bonusOf = total => Math.floor(num(total) / 10);

/**
 * Бесчестие. В системе это Характеристика `inf`, а не отдельное поле: и
 * требования Таланта, и доля Миньона, и Магнитуда Орды считаются от неё.
 */
const infamyOf = actor => num(actor?.system?.characteristics?.inf?.total);

// ── Слоты: сколько Миньонов куплено и сколько из них уже заведено ──────────

/** Талант ли это «Миньон Хаоса» — по машинному флагу, иначе по имени. */
export function isMinionTalent(item) {
  if (item?.type !== "talent") return false;
  const slot = item?.flags?.["warhammer-dbc"]?.[MINION_TALENT_FLAG];
  if (slot?.group || slot?.tier) return true;
  return MINION_TALENT_NAMES.some(n => String(item?.name || "").includes(n));
}

/** Пара «группа + сила» из Таланта. Невыбранное остаётся пустым. */
export function minionSlotOf(item) {
  const slot = item?.flags?.["warhammer-dbc"]?.[MINION_TALENT_FLAG] || {};
  return { group: slot.group || "", tier: slot.tier || "" };
}

/**
 * Купленные слоты Хозяина: по одному на каждый экземпляр Таланта. Талант
 * берётся несколько раз, и каждый раз — свой Миньон (стр. 111).
 */
export function minionSlots(items = []) {
  return [...items].filter(isMinionTalent).map((item, index) => ({
    id: item.id ?? `slot-${index}`,
    talentId: item.id ?? "",
    talentName: item.name || "",
    ...minionSlotOf(item)
  }));
}

/**
 * Раскладка слотов по занятости. Миньон занимает слот своей пары «группа +
 * сила»; если пары не совпали ни с одним слотом, он считается сверх плана —
 * такое бывает у миньонов, заведённых руками до покупки Таланта.
 */
export function slotUsage(items = [], minions = []) {
  const slots = minionSlots(items).map(slot => ({ ...slot, minion: null }));
  const extra = [];

  for (const minion of minions) {
    const group = minion?.system?.minionGroup || minion?.system?.minionType || "";
    const tier  = minion?.system?.minionTier  || "";
    const exact = slots.find(s => !s.minion && s.group === group && s.tier === tier);
    // Слот без выбранной пары подходит любому: Талант куплен, но чей он —
    // хозяин ещё не решил.
    const any   = exact || slots.find(s => !s.minion && !s.group && !s.tier);
    if (any) any.minion = minion;
    else extra.push(minion);
  }

  return { slots, free: slots.filter(s => !s.minion), extra };
}

// ── Максимум Миньонов (стр. 111) ──────────────────────────────────────────

/**
 * Сколько Миньонов Хозяин может держать одновременно: бонус характеристики
 * своей группы, а при нескольких группах — наименьший из бонусов. Считаем по
 * группам, которые у него есть на руках: уйдёт человек — потолок поднимется.
 */
export function minionCapacity(master, groups = []) {
  const used = [...new Set(groups.filter(g => MINION_GROUPS[g]))];
  if (!used.length) return 0;
  const chars = master?.system?.characteristics ?? {};
  return Math.min(...used.map(g => bonusOf(chars[MINION_GROUPS[g].masterChar]?.total)));
}

/** Сколько Миньонов какой группы у Хозяина — для шапки блока СОЦИУМа. */
export function groupTally(minions = []) {
  const tally = {};
  for (const minion of minions) {
    const group = minion?.system?.minionGroup || minion?.system?.minionType || "";
    if (!MINION_GROUPS[group]) continue;
    tally[group] = (tally[group] || 0) + 1;
  }
  return tally;
}

// ── Требования Таланта (стр. 111) ─────────────────────────────────────────

/**
 * Выполняет ли Хозяин требования Таланта выбранной пары: значение
 * характеристики группы, Бесчестие и надбавка Навыка группы. Возвращаем
 * список невыполненного, а не «да/нет»: игроку нужно знать, чего не хватило.
 */
export function talentRequirements(master, group, tier) {
  const groupDef = MINION_GROUPS[group];
  const tierDef  = MINION_TIERS[tier];
  if (!groupDef || !tierDef) return { ok: false, missing: ["Не выбраны группа и сила Миньона."] };

  const sys = master?.system ?? {};
  const charTotal = num(sys.characteristics?.[groupDef.masterChar]?.total);
  const infamy    = infamyOf(master);
  const missing = [];

  if (charTotal < tierDef.req.char) {
    missing.push(`${groupDef.masterChar.toUpperCase()} ${charTotal} — нужно ${tierDef.req.char}`);
  }
  if (tierDef.req.infamy && infamy < tierDef.req.infamy) {
    missing.push(`Бесчестие ${infamy} — нужно ${tierDef.req.infamy}`);
  }
  // Навык проверяем подсказкой: степень владения хранится по-разному у разных
  // Навыков (обычный, групповой, специализация), и загонять сюда её разбор
  // значило бы дублировать skills.mjs. Требование показываем всегда.
  const skillNote = `${groupDef.reqSkill} +${tierDef.req.skill}`;

  return { ok: !missing.length, missing, skillNote };
}

// ── Бюджеты создания ──────────────────────────────────────────────────────

/** Пределы Характеристик выбранной пары: общий потолок уровня и рамки группы. */
export function charLimits(group, tier) {
  const budget = tierBudget(tier);
  const limits = GROUP_CHAR_LIMITS[group] || {};
  return { cap: budget?.chars?.cap ?? 0, max: limits.max || {}, min: limits.min || {} };
}

/**
 * Что не так с раскладкой Характеристик: перебор очков, выход за потолок
 * уровня, за рамки группы. Пустой список — всё по книге.
 */
export function charIssues(chars = {}, group, tier) {
  const { cap, max, min } = charLimits(group, tier);
  const issues = [];

  for (const [key, value] of Object.entries(chars)) {
    const v = num(value);
    if (cap && v > cap)               issues.push(`${key.toUpperCase()} ${v} — потолок ${cap}`);
    if (max[key] && v > max[key])     issues.push(`${key.toUpperCase()} ${v} — у этой группы не выше ${max[key]}`);
    if (min[key] && v < min[key])     issues.push(`${key.toUpperCase()} ${v} — у этой группы не ниже ${min[key]}`);
  }
  return issues;
}

/** Остаток очков Характеристик (для Человека их нет — он бросает кубы). */
export function charPointsLeft(chars = {}, group, tier) {
  const budget = tierBudget(tier);
  if (!budget || group === "human") return null;
  const spent = Object.values(chars).reduce((sum, v) => sum + num(v), 0);
  return budget.chars.points - spent;
}

/**
 * Бросок Характеристик Человека: `count` бросков `base+2d10`, наименьшие
 * отбрасываются, остаётся девять значений. Кубы приходят снаружи (roll2d10) —
 * так проверяется без случайности.
 */
export function rollHumanChars(tier, roll2d10) {
  const spec = tierBudget(tier)?.chars?.roll;
  if (!spec) return [];
  const rolls = Array.from({ length: spec.count }, () => spec.base + num(roll2d10()));
  rolls.sort((a, b) => b - a);
  return rolls.slice(0, rolls.length - spec.drop);
}

/**
 * Остаток Очков Навыков. Взятие Навыка на стартовом уровне стоит очко,
 * подъём на ступень выше — `upCost`. Больше `upLimit` подъёмов книга не даёт,
 * и перебор возвращается отдельно, а не молча вычитается.
 */
export function skillPointsLeft(entries = [], tier, converted = 0) {
  const spec = tierBudget(tier)?.skills;
  if (!spec) return { left: 0, ups: 0, upLimit: 0 };
  const ups = entries.filter(e => e?.upgraded).length;
  const spent = entries.length + ups * spec.upCost;
  return { left: spec.points + num(converted) - spent, ups, upLimit: spec.upLimit };
}

/** Остаток Очков Талантов с учётом того, что часть могли обменять на Навыки. */
export function talentPointsLeft(entries = [], tier, { toSkills = 0, fromTraits = 0 } = {}) {
  const spec = tierBudget(tier)?.talents;
  if (!spec) return { left: 0, maxTier: null, overTier: [] };
  const spent = entries.reduce((sum, e) => sum + (num(e?.cost) || 1), 0);
  const overTier = spec.maxTier
    ? entries.filter(e => num(e?.tier) > spec.maxTier).map(e => e?.name || "?")
    : [];
  return { left: spec.points + num(fromTraits) - num(toSkills) - spent, maxTier: spec.maxTier, overTier };
}

/** Остаток Очков Трейтов: обмен идёт только наружу — в Таланты, и никогда обратно. */
export function traitPointsLeft(entries = [], tier, { toTalents = 0, fromGear = 0 } = {}) {
  const spec = tierBudget(tier)?.traits;
  if (!spec) return 0;
  const spent = entries.reduce((sum, e) => sum + (num(e?.cost) || 1), 0);
  return spec.points + num(fromGear) - num(toTalents) - spent;
}

// ── Производные величины готового Миньона ─────────────────────────────────

/** Раны: T.b × 2 + 2 × Уровень, а хрупкие Трейты дают +5 вместо смерти на нуле. */
export function minionWounds({ toughness = 0, tier, traits = [] } = {}) {
  const tierDef = MINION_TIERS[tier];
  if (!tierDef || tierDef.isHorde) return 0;
  const fragile = traits.some(t => FRAGILE_TRAITS.some(f => String(t).includes(f)));
  return bonusOf(toughness) * MINION_WOUNDS.toughnessMult
       + MINION_WOUNDS.perTier * tierDef.talentTier
       + (fragile ? MINION_WOUNDS.fragileBonus : 0);
}

/** Магнитуда Орды Миньонов: бонус Бесчестия Хозяина × 5. Ран у неё нет. */
export function hordeMagnitude(master) {
  return bonusOf(infamyOf(master)) * MINION_TIERS.horde.magnitudePerInfBonus;
}

/**
 * Бесчестие Миньона: половина хозяйского, не выше 30. У Превосходящего потолка
 * нет — его предел «две трети хозяйского», и он растёт сам, поэтому здесь это
 * стартовое значение, а не запрет.
 */
export function minionInfamy(master, tier) {
  const masterInf = infamyOf(master);
  if (MINION_TIERS[tier]?.infamyShare) return Math.floor(masterInf * MINION_TIERS[tier].infamyShare);
  return Math.min(MINION_INFAMY_CAP, Math.floor(masterInf / 2));
}

/** Порча: у демона она задана книгой, у прочих её назначает ГМ. */
export function minionCorruption(group) {
  return group === "daemon" ? DAEMON_CORRUPTION : 0;
}

/** Базовая Лояльность — ЗНАЧЕНИЕ характеристики Хозяина, не бонус (стр. 113). */
export function minionLoyalty(master, group) {
  const charKey = MINION_GROUPS[group]?.masterChar;
  if (!charKey) return 0;
  return num(master?.system?.characteristics?.[charKey]?.total);
}

/**
 * Речь Миньона (стр. 113): молчание при F ниже 10 и понимание одних команд при
 * I ниже 10. Возвращаем подпись для листа, а не запрет.
 */
export function speechNote(chars = {}) {
  if (num(chars.fel) < 10) return "Говорить не может, но речь понимает.";
  if (num(chars.int) < 10) return "Понимает только команды, которым обучен.";
  return "";
}
