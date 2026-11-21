// module/combat/mech1-rolls.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Общий тест Навыка для кнопок Талантов Архимагоса, Лакрималлуса, Малагры и
//  Монарха: «Stealth(P)+0», «For.Lore (Mechanicum)(I)», «Medicae−30» —
//  Навык с подменой Характеристики, модификатор книги, правила актора, бросок
//  и карточка общим сборщиком (helpers/test-card.mjs). Своя копия, а не
//  combat/trait-test.mjs: тот бросает только Характеристику.
// ════════════════════════════════════════════════════════════════════════════

import { esc, _degWord } from "../helpers/utils.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { SKILLS_DEF } from "../constants/skills.mjs";
import { findGroupEntry } from "../constants/skill-specializations.mjs";
import { CHARACTERISTICS } from "../constants/characteristics.mjs";

const num = v => Number(v) || 0;
const charTotal = (actor, key) => num(actor?.system?.characteristics?.[key]?.total);

/**
 * Итог Навыка с подменой Характеристики. null — Навыка нет, а без обучения
 * его бросать нельзя (Запретные знания).
 * @param {object} actor
 * @param {{skill?:string, group?:string, specialty?:string, char?:string}} o
 */
export function skillTotalWith(actor, { skill = "", group = "", specialty = "", char = "" } = {}) {
  const key = group || skill;
  const def = SKILLS_DEF[key] ?? {};
  const own = def.char ?? "int";
  let total;
  if (group) {
    const entry = findGroupEntry(actor, group, specialty);
    if (!entry || entry.total == null) return def.cannotUntrained ? null : charTotal(actor, own) - 20;
    total = num(entry.total);
  } else {
    const sk = actor?.system?.skills?.[skill];
    total = sk?.total != null ? num(sk.total) : charTotal(actor, own) - 20;
  }
  if (char && char !== own) total += charTotal(actor, char) - charTotal(actor, own);
  return total;
}

/** «Stealth(P)+0», «Medicae−30». */
export function skillTestLabel({ skill = "", group = "", specialty = "", char = "", mod = 0 } = {}) {
  const key = group || skill;
  const en = SKILLS_DEF[key]?.en ?? key;
  const spec = specialty ? ` (${specialty})` : "";
  const own = SKILLS_DEF[key]?.char;
  const swap = char && char !== own ? `(${CHARACTERISTICS[char]?.abbr ?? char})` : "";
  const m = num(mod);
  return `${en}${spec}${swap}${m < 0 ? "−" : "+"}${Math.abs(m)}`;
}

/**
 * Бросить тест Навыка и выложить карточку.
 * @returns {Promise<?{success:boolean, deg:number, rv:number, threshold:number}>} null — Навыка нет
 */
export async function rollMech1Test(actor, { title = "Тест", icon = "⚙️", skill = "", group = "", specialty = "", char = "",
  mod = 0, lines = [], success = "", failure = "", extraMods = [] } = {}) {
  const base = skillTotalWith(actor, { skill, group, specialty, char });
  if (base == null) {
    ui.notifications?.warn(`${actor?.name ?? ""}: нет Навыка ${skillTestLabel({ skill, group, specialty })} — тест невозможен.`);
    return null;
  }
  const key = group || skill;
  const rm = collectTestMods(actor, { kind: "skill", ...(group ? { group, specialty } : { skill }), char: char || SKILLS_DEF[key]?.char });
  const extra = extraMods.reduce((s, m) => s + num(m.value), 0);
  const threshold = base + num(mod) + rm.total + extra;
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const out = testOutcome(rv, threshold);
  const label = skillTestLabel({ skill, group, specialty, char, mod });
  const parts = [num(mod) ? `${num(mod) > 0 ? "+" : ""}${num(mod)}` : null,
    ...extraMods.map(m => `${m.label} ${num(m.value) >= 0 ? "+" : ""}${num(m.value)}`), ...rm.parts];
  await postTestCard(actor, {
    icon, title: `${esc(title)} — ${esc(actor?.name ?? "")}`,
    threshold: rollStatLine({ label, base, parts, threshold, rv }),
    lines,
    outcome: outcomeHtml(out.success, `${out.success ? "Успех" : "Провал"} — ${out.deg} ${_degWord(out.deg)}${
      out.success && success ? `. ${success}` : ""}${!out.success && failure ? `. ${failure}` : ""}`)
  }, { rolls: [roll] });
  return { ...out, rv, threshold };
}

/** Карточка без броска: одна или несколько строк. */
export async function mech1Card(actor, { icon = "⚙️", title = "", lines = [], outcome = "" } = {}) {
  return postTestCard(actor, {
    icon, title: `${esc(title)} — ${esc(actor?.name ?? "")}`,
    lines: lines.map(l => (l.startsWith("<") ? l : `<div class="roll-threshold">${l}</div>`)),
    outcome
  }, { sound: false });
}
