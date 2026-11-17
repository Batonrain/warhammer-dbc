// module/rules/dark-apostle.mjs
// ════════════════════════════════════════════════════════════════════════
//  Тёмный Апостол (Элитный архетип Космодесанта Хаоса, глава 3, Sahara 1-54b9) —
//  чистая логика без Foundry. Foundry-обвязка — combat/dark-apostle.mjs.
//
//  Предвестник Ереси: ×10 целей социального воздействия (Команда, Вдохновить Гнев),
//  переброс провала за Очко Бесчестия с +10 (hooks.mjs, меню Очков), обращение
//  друга (Charm+0 против W+0) и Правоверный (Очко + Charm+10): метка faithful на NPC,
//  +30 к сопротивлению убеждению (встречный тест, sheets/actor-sheet.mjs).
//
//  Литания Хаоса: Очко Бесчестия, один из пяти бонусов подчинённым под Командным
//  Присутствием до конца боя. Метка litanyBlessing пишется каждому подчинённому,
//  читатели смотрят только на свою метку (атака, Трудный Ландшафт); бонус
//  Слаанеш — правило самого Апостола (+30 на Командование); Кхорн и Тзинч
//  выдают подчинённым временные предметы (Frenzy и Hatred (Все!), Fanatic).
//
//  Способности опознаются по имени предмета ИЛИ по ключу записи Конструктора
//  (rules/item-marker.mjs), как в rules/rubric-sorcerer.mjs. Файл подключён к
//  rules/sources.mjs: ничего из combat/, flags.mjs и character.mjs не импортирует.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";
import { itemHasKey } from "./item-marker.mjs";
import { findGroupEntry } from "../constants/skill-specializations.mjs";
import { woundLossAfter, woundDeathThreshold } from "./wounds.mjs";

export const FAITHFUL_FLAG = "faithful";
export const LITANY_FLAG = "litany";
export const BLESSING_FLAG = "litanyBlessing";
export const LITANY_GRANT_FLAG = "litanyGrant";
export const MORTAL_SHIELD_FLAG = "mortalShield";
export const MORTAL_USAGE = "darkApostle.mortalInstrument";
export const LAY_ON_HANDS_USAGE = "darkApostle.layOnHands";
export const MONUMENTS_FLAG = "monuments";

export const HARBINGER_TARGET_MULT = 10;
export const HARBINGER_REROLL_BONUS = 10;
export const CONVERT_TEST_MOD = 0;
export const FAITHFUL_TEST_MOD = 10;
export const FAITHFUL_RESIST_BONUS = 30;
export const TRUE_PRAYER_MOD = 0;
export const MARTYR_MOD = 0;
export const MARTYR_PICK_SUCCESSES = 4;
export const LITANY_COMMAND_BONUS = 30;
export const LITANY_EXTREME_THRESHOLD = 9;
export const LAY_ON_HANDS_ROLLS = 3;
export const LAY_ON_HANDS_RITUAL_MINUTES = 5;

export const FRENZY_PACK_ID = "FP1xN9yNXHr9vWw8";
export const HATRED_PACK_ID = "x4C4FheBkX5nS2Wt";
export const FANATIC_PACK_ID = "unN0w9BzbfYfiEXK";

export const LITANY_GODS = [
  { key: "undivided", label: "Неделимый", effect: "все атаки подчинённых получают свойство Extreme (9/−1)" },
  { key: "slaanesh", label: "Слаанеш", effect: "все тесты Командования Апостола на подчинённых получают +30" },
  { key: "nurgle", label: "Нургл", effect: "подчинённые автоматически проходят тесты Трудного Ландшафта" },
  { key: "khorne", label: "Кхорн", effect: "подчинённые получают Таланты Frenzy и Hatred (Все!)" },
  { key: "tzeentch", label: "Тзинч", effect: "подчинённые получают Трейт Fanatic" }
];

const hasAbility = (actor, key, name, type) =>
  [...(actor?.items ?? [])].some(i => i?.type === type && (itemHasName(i, name) || itemHasKey(i, key)));

export const hasHarbingerOfHeresy = actor => hasAbility(actor, "ability.harbingerOfHeresy", "Harbinger of Heresy", "trait");
export const hasDarkDevotion = actor => hasAbility(actor, "ability.darkDevotion", "Dark Devotion", "trait");
export const hasTruePrayer = actor => hasAbility(actor, "ability.truePrayer", "True Prayer", "talent");
export const hasLayOnHands = actor => hasAbility(actor, "ability.layOnHands", "Lay On Hands", "talent");
export const hasLitanyOfChaos = actor => hasAbility(actor, "ability.litanyOfChaos", "Litany of Chaos", "talent");
export const hasMartyr = actor => hasAbility(actor, "ability.martyr", "Martyr", "talent");
export const hasMortalInstrument = actor => hasAbility(actor, "ability.mortalInstrument", "Mortal Instrument", "talent");

const flagOf = (doc, key) => doc?.getFlag?.("warhammer-dbc", key) ?? doc?.flags?.["warhammer-dbc"]?.[key] ?? null;
const currentCombatId = () => globalThis.game?.combat?.id ?? "";

// ── Предвестник Ереси ─────────────────────────────────────────────────────

/** Множитель числа целей социального воздействия: ×10 у носителя Предвестника Ереси. */
export const harbingerTargetMult = actor => (hasHarbingerOfHeresy(actor) ? HARBINGER_TARGET_MULT : 1);

/** Надбавка к порогу переброса за Очко Бесчестия при социальном взаимодействии. */
export function harbingerRerollBonus(actor, ctx = {}) {
  if (!hasHarbingerOfHeresy(actor) || !ctx?.social) return 0;
  return HARBINGER_REROLL_BONUS;
}

/** uuid подчинённых под Командным Присутствием: «Под моим Присутствием» и Отряды, где Апостол Командир или Лидер. */
export function subordinateUuids(apostle, allActors = []) {
  const out = new Set();
  for (const f of apostle?.system?.followers ?? []) if (f?.uuid) out.add(f.uuid);
  for (const a of allActors) {
    if (a?.type !== "squad") continue;
    const posts = a.system?.posts ?? {};
    if (posts.commander?.uuid !== apostle?.uuid && posts.leader?.uuid !== apostle?.uuid) continue;
    for (const m of a.system?.members ?? []) if (m?.uuid) out.add(m.uuid);
  }
  out.delete(apostle?.uuid);
  return out;
}

/** Подчинён ли target Апостолу (по uuid или по мировому id актора). */
export function isSubordinateOf(apostle, target, allActors = []) {
  if (!target?.uuid || target.uuid === apostle?.uuid) return false;
  const uuids = subordinateUuids(apostle, allActors);
  return uuids.has(target.uuid) || (!!target.id && uuids.has(`Actor.${target.id}`));
}

/** Акторы-подчинённые: по uuid через resolve (fromUuidSync), без дублей. */
export function subordinateActors(apostle, allActors = [], resolve = () => null) {
  const out = new Map();
  for (const uuid of subordinateUuids(apostle, allActors)) {
    const doc = resolve(uuid);
    const actor = doc?.actor ?? doc ?? null;
    if (actor?.uuid && !out.has(actor.uuid)) out.set(actor.uuid, actor);
  }
  return [...out.values()];
}

export const faithfulOf = actor => flagOf(actor, FAITHFUL_FLAG);
export const isFaithful = actor => !!faithfulOf(actor);
export const isFaithfulOf = (actor, apostle) => !!apostle?.uuid && faithfulOf(actor)?.apostleUuid === apostle.uuid;

/**
 * +30 на сопротивление убеждению: сторона, защищающая свою веру в социальном
 * встречном тесте (инициатор — социальный навык), если она Правоверный.
 */
export function faithfulResistBonus(defender, { social = false } = {}) {
  return social && isFaithful(defender) ? FAITHFUL_RESIST_BONUS : 0;
}

/** Итог Forbidden Lore (Heresy); нет записи Навыка — null (тест невозможен). */
export function heresyLoreTotal(actor) {
  const entry = findGroupEntry(actor, "forbiddenLore", "Heresy");
  return !entry || entry.total == null ? null : Number(entry.total) || 0;
}

/** Порог теста Forbidden Lore (Heresy)+mod; null — Навыка нет. */
export function heresyThreshold(actor, mod = 0, modsTotal = 0) {
  const lore = heresyLoreTotal(actor);
  return lore == null ? null : lore + (Number(mod) || 0) + (Number(modsTotal) || 0);
}

/** Итог Charm; нет Навыка — Общительность. */
export function charmTotal(actor) {
  const skill = actor?.system?.skills?.charm;
  if (skill && skill.total != null) return Number(skill.total) || 0;
  return Number(actor?.system?.characteristics?.fel?.total) || 0;
}

/** Порог обращения/посвящения: Charm + mod (+0 — обращение, +10 — Правоверный). */
export const charmThreshold = (actor, mod = 0, modsTotal = 0) =>
  charmTotal(actor) + (Number(mod) || 0) + (Number(modsTotal) || 0);

/** Итог цели W для встречной стороны. */
export const willTotal = actor => Number(actor?.system?.characteristics?.wp?.total) || 0;

// ── Литания Хаоса ─────────────────────────────────────────────────────────

export const litanyGodDef = key => LITANY_GODS.find(g => g.key === key) ?? null;

/** Какие литании доступны: Апостол Пантеона — любую из пяти, посвящённый одному Богу — только его. */
export function litanyOptions(actor) {
  const patron = String(actor?.system?.patronGod ?? "");
  const own = LITANY_GODS.find(g => g.key === patron && g.key !== "undivided");
  return own ? [own] : [...LITANY_GODS];
}

/** Метка Апостола о действующей литании (только в том бою, где она произнесена). */
export function activeLitany(actor, combatId = currentCombatId()) {
  const l = flagOf(actor, LITANY_FLAG);
  return l && l.god && (l.combatId ?? "") === (combatId ?? "") ? l : null;
}

/** Бог действующей литании на подчинённом (метка litanyBlessing); пусто — нет. */
export function blessingGod(actor, combatId = currentCombatId()) {
  const b = flagOf(actor, BLESSING_FLAG);
  return b && b.god && (b.combatId ?? "") === (combatId ?? "") ? String(b.god) : "";
}

/** Все атаки подчинённого получают Extreme (9/−1): литания Неделимого. */
export const litanyGivesExtreme = actor => blessingGod(actor) === "undivided";

/** Подчинённый автоматически проходит тесты Трудного Ландшафта: литания Нургла. */
export const litanyAutoPassesTerrain = actor => blessingGod(actor) === "nurgle";

/** Какие временные предметы выдаёт литания: id в компендиуме и пак. */
export function litanyGrantsFor(god) {
  if (god === "khorne") return [
    { pack: "talents", id: FRENZY_PACK_ID, kind: "frenzy" },
    { pack: "talents", id: HATRED_PACK_ID, kind: "hatredAll" }
  ];
  if (god === "tzeentch") return [{ pack: "traits", id: FANATIC_PACK_ID, kind: "fanatic" }];
  return [];
}

/** Цель Hatred (Все!) — тот же вид, что у Гвоздей Мясника (rules/predicates.mjs::hatredTargetsOf). */
export const HATRED_ALL_TARGET = Object.freeze({ kind: "all", ref: "", value: "", name: "Все!", img: "" });

/**
 * Данные временного предмета из шаблона компендиума: метка выдачи, бесплатный и непокупной.
 * Hatred получает цель «Все!».
 */
export function litanyGrantItemData(template, kind, apostle) {
  const base = JSON.parse(JSON.stringify(template));
  delete base._id; delete base._stats; delete base.ownership; delete base.folder;
  base.system = { ...(base.system ?? {}), purchased: false, granted: false, cost: 0 };
  if (kind === "hatredAll") {
    base.name = "Hatred / Ненависть (Все!)";
    base.system.targets = [{ ...HATRED_ALL_TARGET }];
    base.system.specialization = "Все!";
  }
  base.flags = {
    ...(base.flags ?? {}),
    "warhammer-dbc": {
      ...(base.flags?.["warhammer-dbc"] ?? {}),
      [LITANY_GRANT_FLAG]: { apostleUuid: apostle?.uuid ?? "", apostleName: apostle?.name ?? "", kind }
    }
  };
  return base;
}

/** Метка выдачи литании на предмете? */
export const isLitanyGrant = item => !!flagOf(item, LITANY_GRANT_FLAG);

/** Метка Апостола и подчинённого при произнесении литании. */
export function litanyMarks(god, apostle, combatId, recipients = []) {
  return {
    apostle: { god, combatId: combatId ?? "", names: recipients.map(r => r.name) },
    blessing: { god, apostleUuid: apostle?.uuid ?? "", apostleName: apostle?.name ?? "", combatId: combatId ?? "" }
  };
}

/** Правила Апостола: литания Слаанеш — +30 на Командование, пока она действует. */
export function darkApostleRules(actor) {
  if (!hasLitanyOfChaos(actor)) return [];
  const l = activeLitany(actor);
  if (l?.god !== "slaanesh") return [];
  return [{
    id: "darkApostle.litany.slaanesh",
    label: "Литания Слаанеш: +30 на тесты Командования",
    when: {},
    effects: [{ kind: "rollBonus", target: "skill:command", value: LITANY_COMMAND_BONUS, label: "💜 Литания Слаанеш", auto: true }]
  }];
}

// ── Возложение Рук ────────────────────────────────────────────────────────

/**
 * Что нужно, чтобы благословить цель: Порча, недостающая до следующего Порога Мутации, не выше Cor
 * самого Апостола. Чистая арифметика: пороги подсчитывает вызывающий (rules/character.mjs::nextMutationThreshold).
 * @returns {{ok:boolean, reason?:string, needed?:number}}
 */
export function layOnHandsPlan({ apostleCor = 0, targetCor = 0, nextThreshold = null, ready = true, willing = true } = {}) {
  if (!willing) return { ok: false, reason: "Цель не согласна: Возложение Рук — только добровольным." };
  if (!ready) return { ok: false, reason: "Эту цель уже благословляли за последний месяц." };
  if (nextThreshold == null) return { ok: false, reason: "У цели нет следующего Порога Мутации." };
  const needed = Math.max(1, (Number(nextThreshold) || 0) - (Number(targetCor) || 0));
  if (needed > (Number(apostleCor) || 0)) {
    return { ok: false, reason: `Нужно дать ${needed} Порчи — больше Cor Апостола (${Number(apostleCor) || 0}).`, needed };
  }
  return { ok: true, needed };
}

/**
 * Записи таблицы Мутаций, достижимые тремя бросками ± Inf.b Апостола (вместо Inf цели).
 * @param {(roll:number)=>string} byRoll mutationByRoll
 */
export function layOnHandsPool(rolls, infB, byRoll) {
  const shifts = Array.from({ length: Math.max(0, Number(infB) || 0) * 2 + 1 }, (_, i) => i - Math.max(0, Number(infB) || 0));
  const names = new Set();
  for (const r of rolls) for (const s of shifts) names.add(byRoll((Number(r) || 0) + s));
  return names;
}

// ── Мученик ───────────────────────────────────────────────────────────────

/** Кто выбирает демона: 4+ Успеха — Апостол, 1–3 — ГМ. */
export const martyrChooser = successes => (Number(successes) >= MARTYR_PICK_SUCCESSES ? "apostle" : "gm");

// ── Смертный Инструмент ───────────────────────────────────────────────────

/** Смертельный ли удар: после потери Ран критические Раны достигают порога гибели (Макс Ран + 7). */
export function isLethalBlow(system, net) {
  const w = system?.wounds ?? {};
  const max = Number(w.effectiveMax ?? w.max) || 0;
  const ablative = Math.max(0, Number(w.ablative) || 0);
  const remaining = Math.max(0, (Number(net) || 0) - ablative);
  if (remaining <= 0) return false;
  const after = woundLossAfter(w.value, w.critical, remaining);
  return after.critical >= woundDeathThreshold(max);
}

/** Мистический щит: удар смертелен и метка щита есть — урон отражён. */
export function mortalShieldAbsorbs(actor, net) {
  return !!flagOf(actor, MORTAL_SHIELD_FLAG) && isLethalBlow(actor?.system, net);
}
