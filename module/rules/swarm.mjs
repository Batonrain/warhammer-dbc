// module/rules/swarm.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Рой (Swarm) — dbc-114, 14.11.2026, чистая логика без Foundry.
//
//  «Атаки без свойств Blast/Flame/Spray/Scatter наносят ему только половину урона (окр. вверх)
//  до Поглощения.»
//
//  Не смоделировано здесь: «нельзя Захватить, сбить с ног, связать», «не получает Критических
//  Эффектов — уничтожен при Ранах ниже 0», протискивание, «Pen естественного оружия +X».
// ════════════════════════════════════════════════════════════════════════════

export const SWARM_CAP = "damage.swarmHalf";

/** Пробивает ли атака Рой полным уроном: есть Blast, Flame, Spray или Scatter. */
export function swarmIgnoresHalving({ blast = 0, flame = false, spray = false, scatter = false } = {}) {
  return (Number(blast) || 0) > 0 || !!flame || !!spray || !!scatter;
}

/** Урон по Рою до Поглощения: половина (окр. вверх) от обычной атаки, полный — от Blast/Flame/Spray/Scatter. */
export function swarmDamage(rawDamage, props = {}) {
  const raw = Number(rawDamage) || 0;
  return swarmIgnoresHalving(props) ? raw : Math.ceil(raw / 2);
}
