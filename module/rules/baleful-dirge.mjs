// module/rules/baleful-dirge.mjs
// Baleful Dirge / Мрачный Плач (Таланты, «Социальные»): «До начала следующего
// Хода персонажа все существа в 30м, слышащие его, в начале своего Хода
// проходят W+0 или получают −10 на все тесты кроме Т. Штраф длится, пока
// персонаж поёт или пока цель не пройдёт W.»
//
// Певец ставит себе метку «поёт» (бой и Раунд); провалившая W цель — метку
// «под Плачем» с uuid певца. Штраф — правило rules/library/baleful-dirge.mjs по
// предикату underBalefulDirge: метка есть и певец пел в этом или прошлом Раунде.
// Чистая часть без Foundry: певца резолвит переданная функция.

export const DIRGE_SINGING_FLAG = "balefulDirgeSinging";
export const DIRGE_TARGET_FLAG = "balefulDirge";
export const DIRGE_RADIUS = 30;

const NS = "warhammer-dbc";

/** Поёт ли певец сейчас: вне боя — пока метка стоит; в бою — пел в этом или прошлом Раунде. */
export function dirgeSinging(singer, combat) {
  const f = singer?.flags?.[NS]?.[DIRGE_SINGING_FLAG];
  if (!f) return false;
  if (!combat?.id || !f.combatId) return !combat?.id === !f.combatId;
  return f.combatId === combat.id && (Number(combat.round) || 0) - (Number(f.round) || 0) <= 1;
}

/** Штраф Плача действует на актора. */
export function underBalefulDirge(actor, {
  combat = globalThis.game?.combat?.started ? globalThis.game.combat : null,
  resolve = u => globalThis.fromUuidSync?.(u) ?? null
} = {}) {
  const f = actor?.flags?.[NS]?.[DIRGE_TARGET_FLAG];
  if (!f?.byUuid) return false;
  const singer = resolve(f.byUuid);
  return !!singer && dirgeSinging(singer, combat);
}
