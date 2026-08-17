// module/rules/elite-requirements.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Требования и цена Элитного архетипа (корбук стр. 114-164).
//
//  Требования делятся на два рода, и разница не косметическая:
//
//    основные — раса, субраса, Черта, Покровительство. Это «кто ты есть»:
//        не выполнено — архетипа нет в списке доступных вовсе, потому что
//        человеку не стать Ведьмой Культа, сколько опыта ни трать;
//    прочие  — Навыки, Порча, Бесчестие, Характеристика, потраченный опыт и
//        свободная строка. Это «чего ты добился»: не выполнено — красным, но
//        взять можно, потому что ГМ вправе разрешить исключение.
//
//  Требуемые Таланты идут третьим списком и считаются как прочие: провалить
//  выбор из-за одного недостающего Таланта — слишком строго, а видеть, чего не
//  хватает, нужно.
//
//  Цена: каждый следующий Элитный архетип удваивается — ×2 за второй, ×4 за
//  третий, ×8 за четвёртый. Считается от базовой цены самого архетипа.
//
//  Здесь нет ни Foundry, ни компендиумов: на вход идут описание требований и
//  «снимок» персонажа. Поэтому правило проверяется без запуска мира.
// ════════════════════════════════════════════════════════════════════════════

import { WARP_GODS } from "../constants/veil.mjs";
import { CHARACTERISTICS } from "../constants/characteristics.mjs";
import { SKILL_RANKS } from "../constants/characteristics.mjs";

/** Покровительства для выбора: боги Варпа плюс «любое». */
export const PATRON_ANY = "any";
export const PATRON_OPTIONS = [
  { key: PATRON_ANY, label: "Любое" },
  ...WARP_GODS.map(g => ({ key: g.key, label: g.label }))
];

/** Виды записей основного блока — «кто ты есть». */
export const PRIMARY_KINDS = [
  { key: "race",    label: "Раса",            drop: "race" },
  { key: "subrace", label: "Субраса",         drop: "subrace" },
  { key: "trait",   label: "Черта",           drop: "trait" },
  { key: "patron",  label: "Покровительство", drop: null }
];

/** Виды записей прочего блока — «чего ты добился». */
export const SECONDARY_KINDS = [
  { key: "skill",          label: "Умение" },
  { key: "corruption",     label: "Порча" },
  { key: "infamy",         label: "Бесчестие" },
  { key: "characteristic", label: "Характеристика" },
  { key: "xp",             label: "Опыт" },
  { key: "other",          label: "Другое" }
];

/** Пустая заготовка требований — её же кладёт схема предмета. */
export const blankEliteReq = () => ({ primary: [], secondary: [], talents: [] });

const num = v => Number(v) || 0;
const rankIdx = rank => Math.max(0, ["untrained", "knows", "trained", "veteran", "expert"].indexOf(rank || "untrained"));

/**
 * Цена архетипа для персонажа: каждый следующий вдвое дороже предыдущего.
 * @param {number} base   цена самого архетипа
 * @param {number} taken  сколько Элитных архетипов у персонажа уже есть
 */
export function eliteCost(base, taken = 0) {
  const b = Math.max(0, num(base));
  return b * Math.pow(2, Math.max(0, num(taken)));
}

/** Подпись множителя для подсказки: «×4 — третий Элитный архетип». */
export function eliteCostNote(taken = 0) {
  const n = Math.max(0, num(taken));
  if (!n) return "";
  const words = ["первый", "второй", "третий", "четвёртый", "пятый", "шестой"];
  return `×${Math.pow(2, n)} — ${words[n] || `${n + 1}-й`} Элитный архетип`;
}

// ── Проверка одной записи ───────────────────────────────────────────────────

/**
 * Снимок персонажа для проверки. Отдельным объектом, а не актором: правило
 * должно считаться и в тестах, и там, где актора ещё нет.
 *
 * { race, subrace, patron, traits: [имена], talents: [{name, specialization}],
 *   skills: { ключ: ранг }, groupSkills: { ключ: [{specKey|specialty, rank}] },
 *   corruption, infamy, chars: { ключ: значение }, spentXP }
 */
function primaryOk(entry, who) {
  switch (entry?.kind) {
    case "race":    return !entry.key || who.race === entry.key;
    case "subrace": return !entry.key || who.subrace === entry.key;
    case "trait": {
      const want = String(entry.name || "").toLowerCase();
      return !want || (who.traits || []).some(t => String(t).toLowerCase().includes(want));
    }
    case "patron":
      // «Любое» значит «хоть какое-то»: у безбожника Покровительства нет вовсе.
      if (!entry.key) return true;
      return entry.key === PATRON_ANY ? !!who.patron : who.patron === entry.key;
    default: return true;
  }
}

function secondaryOk(entry, who) {
  switch (entry?.kind) {
    case "skill": {
      const want = rankIdx(entry.rank);
      if (entry.scope === "group") {
        const list = who.groupSkills?.[entry.skillKey] || [];
        return list.some(e =>
          (!entry.specKey || e.specKey === entry.specKey || e.specialty === entry.specKey)
          && rankIdx(e.rank) >= want);
      }
      return rankIdx(who.skills?.[entry.skillKey]) >= want;
    }
    case "corruption":     return num(who.corruption) >= num(entry.value);
    case "infamy":         return num(who.infamy) >= num(entry.value);
    case "characteristic": return num(who.chars?.[entry.charKey]) >= num(entry.value);
    case "xp":             return num(who.spentXP) >= num(entry.value);
    // Свободную строку машина не проверяет — её читает ГМ. Не «провалено», но
    // и не «выполнено»: такое требование помечается отдельно.
    case "other":          return null;
    default: return true;
  }
}

function talentOk(entry, who) {
  const name = String(entry?.name || "").toLowerCase();
  const spec = String(entry?.specialization || "").toLowerCase();
  if (!name) return true;
  return (who.talents || []).some(t =>
    String(t?.name || "").toLowerCase().includes(name)
    && (!spec || String(t?.specialization || "").toLowerCase() === spec));
}

/** Человеческая подпись записи — для подсказки «чего не хватает». */
export function describeEliteReq(entry) {
  switch (entry?.kind) {
    case "race":    return `Раса: ${entry.name || entry.key || "?"}`;
    case "subrace": return `Субраса: ${entry.name || entry.key || "?"}`;
    case "trait":   return `Черта: ${entry.name || "?"}`;
    case "patron":  return `Покровительство: ${PATRON_OPTIONS.find(p => p.key === entry.key)?.label || "?"}`;
    case "skill":   return `${entry.label || entry.skillKey}${entry.specKey ? ` (${entry.specKey})` : ""} ${SKILL_RANKS[entry.rank]?.label || ""}`.trim();
    case "corruption":     return `Порча ${entry.value}`;
    case "infamy":         return `Бесчестие ${entry.value}`;
    case "characteristic": return `${CHARACTERISTICS[entry.charKey]?.abbr || entry.charKey} ${entry.value}`;
    case "xp":             return `Потрачено опыта: ${entry.value}`;
    case "other":          return entry.text || "—";
    default: return entry?.name || "—";
  }
}

/**
 * Полная проверка. Возвращает состояние по каждому блоку и общий вывод:
 *   available — показывать ли архетип в списке (основной блок выполнен);
 *   warn      — есть ли невыполненное среди прочих требований и Талантов.
 */
export function checkEliteRequirements(req, who = {}) {
  const r = req || blankEliteReq();

  const primaryUnmet = (r.primary || []).filter(e => !primaryOk(e, who)).map(describeEliteReq);

  const secondaryUnmet = [];
  const manual = [];
  for (const e of r.secondary || []) {
    const res = secondaryOk(e, who);
    if (res === null) manual.push(describeEliteReq(e));
    else if (!res) secondaryUnmet.push(describeEliteReq(e));
  }

  const talentsUnmet = (r.talents || []).filter(e => !talentOk(e, who)).map(describeEliteReq);

  return {
    available: primaryUnmet.length === 0,
    warn: secondaryUnmet.length > 0 || talentsUnmet.length > 0,
    primaryUnmet, secondaryUnmet, talentsUnmet, manual,
    unmet: [...primaryUnmet, ...secondaryUnmet, ...talentsUnmet]
  };
}
