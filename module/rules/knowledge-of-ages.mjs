// module/rules/knowledge-of-ages.mjs
// ════════════════════════════════════════════════════════════════════════
//  Knowledge of Ages / Знания Веков (Общие мутации, d100 −3…0, wdbc-1rno.23).
//  [книга] core.json, «–3..0 | Знания Веков»: «Персонаж без траты опыта
//  изучает любой Навык по своему выбору до +30 и получает Талант Mastery для
//  этого Навыка. Когда персонаж использует способности Бесчестия «Усиление»,
//  «Успех» или «Переброс» для этого Навыка, он может бросить 1d10 – на 9-10 он
//  не тратит Очко Бесчестия, но на 1 он входит в Ступор на 1 Раунд».
//
//  Первая половина (Навык +30 и Mastery) — запись Конструктора kind:"skill"
//  specKey:"__choice_any__" + grantsMastery (apps/mechanics.mjs). Здесь —
//  вторая: исход 1d10 и опознание «этого Навыка».
//
//  «Этот Навык» нигде на мутации не записан: выбор игрока при получении сразу
//  уходит в ранг Навыка и в Талант Mastery. Зато Mastery создаётся
//  Конструктором с метками grantedByItem = id мутации и abilityEntryId
//  «<id записи>:mastery», а его привязка лежит в system.aptSource (ключ
//  masteryTargets: «dodge», «forbiddenLore:daemons»). По ним Навык и
//  восстанавливается — и у старых персонажей, получивших мутацию до этой
//  правки, тоже.
//
//  Foundry не нужен: работает на любых объектах предметов с полями id/type/
//  flags/system. Кнопка и бросок — apps/knowledge-of-ages.mjs.
// ════════════════════════════════════════════════════════════════════════

import { masteryTarget, masteryTargets } from "./mastery-targets.mjs";
import { specOptions } from "../constants/skill-specializations.mjs";

const NS = "warhammer-dbc";

export const KNOWLEDGE_OF_AGES_CAPABILITY = "mutation.knowledgeOfAges";

/**
 * Способности Очков Бесчестия, на которые действует бросок (ключи
 * DP_INFAMY_ABILITIES, constants/demon-prince.mjs). [книга] — ровно эти три.
 */
export const KNOWLEDGE_OF_AGES_ABILITIES = new Set(["boost", "reroll", "success"]);

/**
 * Исход 1d10. [книга] 9-10 — Очко не тратится; 1 — Ступор на 1 Раунд.
 * @param {number} d10
 * @returns {{refund:boolean, stupor:boolean}}
 */
export function knowledgeOfAgesOutcome(d10) {
  const v = Number(d10) || 0;
  return { refund: v >= 9, stupor: v === 1 };
}

/**
 * Тратит ли актор именно Очки Бесчестия. [книга] — «способности Бесчестия»:
 * Очко Судьбы (не-Хаосит, получивший мутацию) или Очко Боли (Друкхари) — не
 * они. Тот же выбор слова, что helpers/utils.mjs::fateTerm.
 */
export function spendsInfamyPoints(actor) {
  if (actor?.type === "demonPrince") return true;
  return actor?.system?.alignment === "heretic" && actor?.system?.race !== "drukhari";
}

const flagsOf = item => item?.flags?.[NS] ?? {};

/** Несёт ли предмет запись Конструктора с capability Знаний Веков. */
function carriesKnowledgeOfAges(item) {
  const mech = flagsOf(item).mechanics;
  if (!Array.isArray(mech)) return false;
  return mech.some(g => (g?.entries ?? []).some(e =>
    e?.kind === "capability" && e.capabilityKey === KNOWLEDGE_OF_AGES_CAPABILITY));
}

/** Ключ привязки Mastery: aptSource, либо обратный поиск по подписи. */
function masteryKeyOf(talent) {
  const apt = String(talent?.system?.aptSource ?? "").trim();
  if (apt && masteryTarget(apt)) return apt;
  const label = String(talent?.system?.specialization ?? "").trim();
  if (!label) return "";
  return masteryTargets().find(t => t.label === label)?.key ?? "";
}

/**
 * Ключи Навыков (формата masteryTargets), добытых Знаниями Веков.
 * @param {Iterable<object>} items предметы актора (массив или Коллекция)
 * @returns {string[]} без повторов; пусто — привязку восстановить не из чего
 */
export function knowledgeOfAgesSkillKeys(items) {
  const list = Array.from(items ?? []);
  const sources = new Set(list.filter(carriesKnowledgeOfAges).map(i => i.id).filter(Boolean));
  if (!sources.size) return [];
  const keys = new Set();
  for (const it of list) {
    if (it?.type !== "talent") continue;
    const f = flagsOf(it);
    if (!sources.has(f.grantedByItem)) continue;
    if (!String(f.abilityEntryId ?? "").endsWith(":mastery")) continue;
    const key = masteryKeyOf(it);
    if (key) keys.add(key);
  }
  return [...keys];
}

const norm = s => String(s ?? "").trim().toLowerCase();

/** Подпись строки группового Навыка — та ли это специализация. */
function specialtyMatches(group, spec, specialty) {
  const want = norm(specialty);
  if (!want) return false;
  const opt = specOptions(group).find(o => o.key === spec);
  if (!opt) return want === norm(spec);
  return [opt.key, opt.label, opt.ru, opt.display].some(v => v && norm(v) === want);
}

/**
 * Тот ли это Навык. `ctx` — флаг skillTest карточки теста с листа
 * (sheets/actor-sheet.mjs::_runTest): {skill, group, specialty}.
 * @param {string[]} keys результат knowledgeOfAgesSkillKeys
 * @param {{skill?:string, group?:string, specialty?:string}|null} ctx
 */
export function knowledgeOfAgesCoversTest(keys, ctx) {
  if (!ctx || !Array.isArray(keys) || !keys.length) return false;
  return keys.some(key => {
    const t = masteryTarget(key);
    if (!t) return false;
    if (!t.group) return !!ctx.skill && ctx.skill === t.key;
    if (ctx.group !== t.group) return false;
    return !t.spec || specialtyMatches(t.group, t.spec, ctx.specialty);
  });
}
