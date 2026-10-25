// module/rules/dragon-knight.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Драконий Рыцарь / Dragon Knight (Талант Всадника, Sahara 3-cross-actor-5482;
//  DoomBC — Основная книга): «Если персонаж и скакун действуют в одну
//  Инициативу, за полудействие он может пройти Survival−10, чтобы дать скакуну
//  +3×Успехи на все Атаки или Избегания до начала их следующего Хода (выбирая до
//  броска).»
//
//  Бонус достаётся СКАКУНУ — отдельному актору, поэтому живёт меткой на нём
//  (flags.warhammer-dbc.dragonKnightBuff = { mode, value }), а читает её общий
//  сбор ситуативных правил (rules/situational.mjs) — как у Предусмотрительности.
//  Ставит метку тест всадника (combat/mount.mjs::dragonKnightTest), снимает начало
//  следующего Хода всадника (hooks.mjs → combat/mount.mjs::clearDragonKnight).
//
//  Чистый модуль без импортов: его читает situational.mjs.
// ════════════════════════════════════════════════════════════════════════════

export const DRAGON_KNIGHT_FLAG = "dragonKnightBuff";
const NS = "warhammer-dbc";

/** +3 за каждый Успех теста Survival−10. */
export const dragonKnightValue = successes => 3 * Math.max(0, Math.trunc(Number(successes) || 0));

/**
 * Правило бонуса для актора-скакуна по метке. Атаки — область «attack»; Избегания —
 * Уклонение и Парирование (список областей: срабатывает один раз).
 */
export function dragonKnightRules(actor) {
  const buff = actor?.getFlag?.(NS, DRAGON_KNIGHT_FLAG) ?? actor?.flags?.[NS]?.[DRAGON_KNIGHT_FLAG];
  const value = Number(buff?.value) || 0;
  if (!value) return [];
  const attack = buff.mode === "attack";
  const label = `🐉 Драконий Рыцарь: +${value} на ${attack ? "Атаки" : "Избегания"} скакуна`;
  return [{
    id: "situational.dragonKnight", label, when: {},
    effects: [{ kind: "rollBonus", target: attack ? "attack" : ["skill:dodge", "skill:parry"], value, auto: true, label }]
  }];
}
