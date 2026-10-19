// module/rules/awareness-talents.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ТАЛАНТЫ ВНИМАТЕЛЬНОСТИ (глава 3, группа «Внимательность») — чистая логика.
//
//  Одиннадцать Талантов. Уже были сделаны раньше (rules/unseen-talents.mjs,
//  wdbc-1rno.2): Шестое Чувство и вторая половина Боя Вслепую (Избегать
//  Незримых атак −20); Часовой — Преимущество на Awareness радиокнопкой
//  (Конструктор, kind:"reroll"). Здесь — остальное:
//
//    Усиленные Чувства — галочка +10 на Awareness и Scrutiny на каждое
//      выбранное чувство (решение владельца 17.10.2026: только эти два Навыка).
//    Дегустатор — галочки +20 (нюх) и +40 (вкус) на Awareness: распознать яд.
//    Воролов — галочка: +½P.b (окр.▲) Успехов к успешному тесту.
//    Служба Безопасности — галочка: «Unnatural P (+2)» = +1 Успех, если
//      бросали P.
//    Аналитический Взгляд — галочка: бросок I вместо P («Бросок с:» сам
//      переключается), Успехи удваиваются.
//    Бой Вслепую (первая половина) — штраф Ослепления в окне рукопашной атаки
//      (sheets/attack/mods.mjs) и на WS-тестах (Парирование; правило
//      conditions.blinded.blindFighting в rules/library/conditions.mjs) вдвое меньше.
//    Слепое Зрение — «Unnatural Senses (P.b) без шлема»: штрафы Ослепления не
//      действуют (rules/blindness.mjs, rules/predicates.mjs::blindsightActive).
//
//  Система не знает, какой именно это тест Awareness (свободное действие или
//  осмотр, мина или маскировка) — поэтому то, что зависит от этого, подаётся
//  галочками (askOnly), а Успехи добавляются после броска по отмеченным
//  галочкам (awarenessTalentDegrees, вызывается листом).
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName, helmetWorn } from "./predicates.mjs";
import { unnaturalRating, unnaturalDegreeBonus } from "./unnatural-characteristic.mjs";

/** Короткий ключ → { ключ Возможности, имя Таланта }. */
export const AWARENESS_TALENTS = {
  analyticalEye:   { key: "awareness.core.analyticalEye",   name: "Analytical Eye" },
  blindFighting:   { key: "awareness.core.blindFighting",   name: "Blind Fighting" },
  heightenedSenses:{ key: "awareness.core.heightenedSenses",name: "Heightened Senses" },
  securityDetail:  { key: "awareness.core.securityDetail",  name: "Security Detail" },
  taster:          { key: "awareness.core.taster",          name: "Taster" },
  thiefcatcher:    { key: "awareness.core.thiefcatcher",    name: "Thiefcatcher" }
};

// Только по имени предмета, без hasAbility: тот тянет rules/flags.mjs → collect →
// sources, а этот файл сам подключён к sources.mjs (круг импортов подвесил
// загрузку rules/scaffold). Тот же приём, что у rules/hatred.mjs и
// rules/unseen-talents.mjs.
export function hasAwarenessTalent(actor, id) {
  const t = AWARENESS_TALENTS[id];
  return !!t && [...(actor?.items ?? [])].some(i => i?.type === "talent" && itemHasName(i, t.name));
}

/** id правил-галочек — по ним лист после броска узнаёт, что отмечено. */
export const AWARENESS_RULE_IDS = {
  analyticalEye:  "awareness.analyticalEye",
  thiefcatcher:   "awareness.thiefcatcher",
  securityDetail: "awareness.securityDetail"
};

// ── Усиленные Чувства ───────────────────────────────────────────────────────

/** Пять чувств: ключ, подпись и все написания в данных (англ./рус.). */
export const SENSES = [
  { key: "sight",   label: "Зрение",    names: ["sight", "зрение"] },
  { key: "hearing", label: "Слух",      names: ["hearing", "слух"] },
  { key: "smell",   label: "Обоняние",  names: ["smell", "обоняние"] },
  { key: "taste",   label: "Вкус",      names: ["taste", "вкус"] },
  { key: "touch",   label: "Осязание",  names: ["touch", "осязание"] }
];

/**
 * Какие чувства выбраны у предметов «Усиленные Чувства» актора. Несколько
 * предметов (по одному на чувство) и «все пять» в одном (Heightened Senses
 * (All) у Архетипов) складываются без повторов. Предмет без распознанной
 * специализации даёт общую запись.
 * @returns {{key:string,label:string}[]}
 */
export function heightenedSensesOf(actor) {
  const out = new Map();
  for (const item of actor?.items ?? []) {
    if (!itemHasName(item, "Heightened Senses")) continue;
    const spec = String(item.system?.specialization ?? "").toLowerCase();
    const parts = spec.split(/[,/;]/).map(s => s.trim()).filter(Boolean);
    const isAll = parts.includes("all") || parts.includes("все");
    const found = SENSES.filter(s => isAll || parts.some(p => s.names.some(n => p === n || p.startsWith(n))));
    if (!found.length) out.set("any", { key: "any", label: "чувство" });
    for (const s of found) out.set(s.key, { key: s.key, label: s.label });
  }
  return [...out.values()];
}

// ── Правила-галочки для окна теста ─────────────────────────────────────────

const isAwarenessCtx = ctx => ctx?.kind === "skill" && String(ctx.skill ?? "").toLowerCase() === "awareness";
const isScrutinyCtx = ctx => ctx?.kind === "skill" && String(ctx.skill ?? "").toLowerCase() === "scrutiny";

/**
 * Источник правил «awarenessTalents» (rules/sources.mjs): галочки и штрафы,
 * которые дают Таланты Внимательности, для ТЕКУЩЕГО теста.
 */
export function awarenessTalentRules(actor, ctx = {}) {
  const rules = [];
  const awareness = isAwarenessCtx(ctx);

  if (awareness || isScrutinyCtx(ctx)) {
    for (const sense of heightenedSensesOf(actor)) {
      rules.push({
        id: `awareness.heightenedSenses.${sense.key}`,
        label: `Усиленные Чувства (${sense.label})`,
        when: {},
        effects: [{ kind: "rollBonus", target: ["skill:awareness", "skill:scrutiny"], value: 10, askOnly: true }]
      });
    }
  }

  if (awareness) {
    if (hasAwarenessTalent(actor, "taster")) {
      rules.push({
        id: "awareness.taster.smell", label: "Дегустатор: распознать яд на нюх", when: {},
        effects: [{ kind: "rollBonus", target: "skill:awareness", value: 20, askOnly: true }]
      }, {
        id: "awareness.taster.taste", label: "Дегустатор: распознать яд на вкус", when: {},
        effects: [{ kind: "rollBonus", target: "skill:awareness", value: 40, askOnly: true }]
      });
    }
    if (hasAwarenessTalent(actor, "thiefcatcher")) {
      rules.push({
        id: AWARENESS_RULE_IDS.thiefcatcher, when: {},
        label: "Воролов: изменённая внешность, слияние с толпой или Sleight of Hand (+½P.b Успехов)",
        effects: [{ kind: "rollBonus", target: "skill:awareness", value: 0, askOnly: true }]
      });
    }
    if (hasAwarenessTalent(actor, "securityDetail")) {
      rules.push({
        id: AWARENESS_RULE_IDS.securityDetail, when: {},
        label: "Служба Безопасности: поиск скрытых существ, оружия, мин, ловушек (Unnatural P +2)",
        effects: [{ kind: "rollBonus", target: "skill:awareness", value: 0, askOnly: true }]
      });
    }
    if (hasAwarenessTalent(actor, "analyticalEye")) {
      rules.push({
        id: AWARENESS_RULE_IDS.analyticalEye, when: {},
        label: "Аналитический Взгляд: осмотр не свободным действием (I вместо P, Успехи ×2)",
        effects: [{ kind: "rollBonus", target: "skill:awareness", value: 0, askOnly: true, setChar: "int" }]
      });
    }
  }

  return rules;
}

/**
 * Половина штрафа (Бой Вслепую, рукопашная). Положительные и нулевые
 * значения не трогает. Округление к нулю: −5, −10, −15 у книжных −10/−20/−30.
 */
export function halvePenalty(value) {
  const v = Number(value) || 0;
  return v < 0 ? -Math.floor(Math.abs(v) / 2) : v;
}

// ── Успехи после броска ─────────────────────────────────────────────────────

/**
 * Что добавляют отмеченные галочки к Успехам уже успешного теста.
 *
 * Порядок: Аналитический Взгляд удваивает Успехи самого теста (вместе с
 * Unnatural и прочим, что уже вошло в `deg`), затем Воролов и Служба
 * Безопасности прибавляют своё. Ассистенты считаются листом после этого.
 * [допущение владельца 17.10.2026: книга порядок не называет]
 *
 * @param {object} actor
 * @param {{checkedRuleIds?:string[], success:boolean, deg:number, charKey?:string}} p
 * @returns {{deg:number, lines:string[]}}
 */
export function awarenessTalentDegrees(actor, { checkedRuleIds = [], success, deg, charKey } = {}) {
  if (!success) return { deg, lines: [] };
  const checked = new Set(checkedRuleIds);
  let out = Number(deg) || 0;
  const lines = [];

  if (checked.has(AWARENESS_RULE_IDS.analyticalEye) && hasAwarenessTalent(actor, "analyticalEye")) {
    const doubled = out * 2;
    lines.push(`🔍 Аналитический Взгляд: Успехи ×2 (${out} → ${doubled})`);
    out = doubled;
  }
  if (checked.has(AWARENESS_RULE_IDS.thiefcatcher) && hasAwarenessTalent(actor, "thiefcatcher")) {
    const pb = Number(actor?.system?.characteristics?.per?.bonus) || 0;
    const add = Math.ceil(pb / 2);
    if (add > 0) {
      lines.push(`🕵️ Воролов: +${add} (½ P.b, окр.▲)`);
      out += add;
    }
  }
  if (checked.has(AWARENESS_RULE_IDS.securityDetail) && hasAwarenessTalent(actor, "securityDetail")) {
    if (String(charKey ?? "per") === "per") {
      const own = unnaturalRating(actor, "per");
      const add = unnaturalDegreeBonus(own + 2) - unnaturalDegreeBonus(own);
      if (add > 0) {
        lines.push(`🛡️ Служба Безопасности: Unnatural P (+2), +${add}`);
        out += add;
      }
    } else {
      lines.push("🛡️ Служба Безопасности действует только на тест P — бросали другой Характеристикой, Успехи не добавлены");
    }
  }
  return { deg: out, lines };
}

// ── Слепое Зрение ───────────────────────────────────────────────────────────

export { helmetWorn };
