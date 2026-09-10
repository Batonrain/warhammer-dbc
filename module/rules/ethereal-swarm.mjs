// module/rules/ethereal-swarm.mjs
// ════════════════════════════════════════════════════════════════════════
//  Ethereal Swarm / Эфирная Стая (Дар Тзинч, wdbc-1rno): «За полное действие
//  ...проявить вокруг себя Inf.b нематериальных призрачных Крикунов, что
//  кружатся вокруг него в течение Cor.b минут. Когда он получает попадание,
//  после Избеганий, но до бросков на урон и щиты, он может пройти тест на
//  Cor+0, чтобы влить частицу своей Порчи в одного из крикунов, придав ему
//  реальность. В случае Успеха Крикун получает попадание вместо чемпиона и
//  изгоняется в Варп. Это действие считается как реакция, но не тратит
//  Реакций персонажа».
//
//  Призыв — kind:"script" на самом предмете (Дар несёт capabilityKey
//  gift.tzeentch.etherealSwarm просто зонтиком без цены — тот же путь
//  миграции, что Eye of Challenge/Akashic Library/Wish Granter/Red Sun,
//  см. test/rules/capability-cost-in-packs.test.mjs; цена в 2 ОД переехала
//  на саму script-запись). Потребление ОДНОГО Крикуна — кнопка в карточке
//  атаки (combat/defense.mjs::_performEtherealSwarm), НЕ через spendReaction:
//  книга прямо оговаривает «не тратит Реакций», в отличие от Сжатия
//  (rules/compression.mjs), которое тратит.
//
//  Хранится на защищающемся: flags.warhammer-dbc.etherealSwarm =
//  {count, expiresAt} — expiresAt в секундах game.time.worldTime (тот же
//  приём длительности «X минут», что demon-destabilize.mjs), не привязано к
//  Раунду/Ходу (книга даёт минуты, не боевые единицы). Вне активного мира
//  worldTime всё равно монотонно растёт — конвенция подходит.
// ════════════════════════════════════════════════════════════════════════

const FLAG_KEY = "etherealSwarm";
export const ETHEREAL_SWARM_CAPABILITY = "gift.tzeentch.etherealSwarm";

/** Текущий остаток стаи — null, если не призывалась, пуста или истекла. */
export function activeSwarm(actor, worldTime) {
  const entry = actor?.getFlag?.("warhammer-dbc", FLAG_KEY);
  if (!entry || !(Number(entry.count) > 0)) return null;
  if (Number(worldTime) >= Number(entry.expiresAt || 0)) return null;
  return entry;
}

/** Призвать свежую стаю — count Крикунов на minutes минут от текущего worldTime. */
export async function summonSwarm(actor, count, minutes, worldTime) {
  await actor.setFlag("warhammer-dbc", FLAG_KEY, {
    count: Math.max(0, Math.trunc(Number(count) || 0)),
    expiresAt: Number(worldTime) + Math.max(0, Number(minutes) || 0) * 60
  });
}

/** Списать одного Крикуна (успешное поглощение попадания). */
export async function consumeSwarmScreamer(actor) {
  const entry = actor?.getFlag?.("warhammer-dbc", FLAG_KEY);
  if (!entry || !(Number(entry.count) > 0)) return;
  await actor.setFlag("warhammer-dbc", FLAG_KEY, { ...entry, count: entry.count - 1 });
}
