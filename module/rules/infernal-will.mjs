// module/rules/infernal-will.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Инфернальная Воля (Общие мутации, d100 44; core.json «44 | Инфернальная
//  Воля»; wdbc-1rno.22) — чистая арифметика броска Шока. Сам бросок и
//  применение строки — combat/fear.mjs::rollInfernalWillShock, срабатывание
//  по «4+ Провала теста Навыка» — общий триггер rules/fail-degree-triggers.mjs.
//
//  Книга: «Если он Неделимый, он может уменьшать результат по таблице Шока на
//  половину своего Cor (окр.▲). Если он имеет Покровительство Бога, он может
//  уменьшать результат на свой полный Cor, но только если бросок был вызван
//  Провалами на дружественный ему Навык».
//
//  Решения владельца 02.10.2026 (там, где книга молчит):
//   - бросок 1d100 + 10×(Провалы−1), как у Страха (Q-1);
//   - Важные персонажи Infamy НЕ вычитают — это часть правила Страха (Q-2);
//   - «Неделимый» — и Покровитель «Неделимый», и персонаж без Покровителя,
//     как уже считает constants/patronage.mjs::godRelationCat (Q-3);
//   - дружественный Навык — Навык его Бога плюс «всегда дружественные»
//     Common Lore и Trade (Q-4);
//   - «может уменьшать» — автоматически: таблица растёт по тяжести, снижение
//     всегда в пользу игрока; итог ≤0 — Шока нет (Q-5).
//  Cor здесь — само значение Порчи (system.corruption.value), не Cor.b: книга
//  пишет «Cor 1-35 / Cor 36-55» в тех же единицах.
// ════════════════════════════════════════════════════════════════════════════

import { skillGodOf } from "../constants/patronage.mjs";
import { GROUP_SKILLS_DEF } from "../constants/skills.mjs";
import { CHAOS_PATRONS_MAP } from "../constants/chaos-patron.mjs";

/** Имя Возможности, которую несёт запись мутации в паке. */
export const INFERNAL_WILL_FLAG = "mutation.infernalWill";

/** Неделимый — и Покровитель «Неделимый», и персонаж без Покровителя (Q-3). */
const isUndivided = (patronGod) => !patronGod || patronGod === "undivided";

/**
 * Дружественен ли Навык проваленного теста Богу-Покровителю (Q-4).
 *
 * @param {string} patronGod ключ Бога (khorne/nurgle/slaanesh/tzeentch)
 * @param {{skill?:string, group?:string, specialty?:string}} ctx контекст теста
 */
export function infernalWillFriendlySkill(patronGod, ctx = {}) {
  const key = ctx.skill || ctx.group || "";
  if (!key) return false;
  if (GROUP_SKILLS_DEF[key]?.alwaysAlly) return true;
  if (isUndivided(patronGod)) return false;
  return skillGodOf(key, ctx.specialty || "") === patronGod;
}

/**
 * На сколько снижается результат броска Шока и почему.
 *
 * @returns {{value:number, label:string}}
 */
export function infernalWillReduction(actor, ctx = {}) {
  const cor = Math.max(0, Number(actor?.system?.corruption?.value) || 0);
  const patronGod = actor?.system?.patronGod || "";
  if (isUndivided(patronGod)) {
    return { value: Math.ceil(cor / 2), label: `Неделимый: −½Cor (окр.▲), Cor ${cor}` };
  }
  const god = CHAOS_PATRONS_MAP[patronGod]?.gen ?? patronGod;
  if (infernalWillFriendlySkill(patronGod, ctx)) {
    return { value: cor, label: `Покровительство ${god}, Навык дружественный: −Cor, Cor ${cor}` };
  }
  return { value: 0, label: `Покровительство ${god}, Навык не дружественный — снижения нет` };
}

/** Итог броска Шока: 1d100 + 10×(Провалы−1) − снижение (Q-1, Q-5). */
export function infernalWillShockTotal(d100, deg, reduction = 0) {
  const fails = Math.max(1, Number(deg) || 1);
  return (Number(d100) || 0) + 10 * (fails - 1) - (Number(reduction) || 0);
}
