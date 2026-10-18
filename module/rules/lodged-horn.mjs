// module/rules/lodged-horn.mjs
// ════════════════════════════════════════════════════════════════════════
//  РОГ ЧУМОНОСА (Majestic Horns, субмутация 7, Нургл) — wdbc-1rno.10.
//
//  Книга: персонаж может обломать рог при атаке, оставив его в ране; рог
//  работает как свойство Piercing, и пока он в ране, цель автоматически
//  проваливает все тесты T с 3 Провалами. Отломанный рог регенерирует через
//  3 часа.
//
//  Как собрано, чтобы не заводить второе «застрявшее в ране»:
//   • рану с рогом ведёт готовое Проникающее — system.piercingWounds[локация],
//     кнопка «Извлечь снаряд» (combat/damage.mjs::extractPiercingWound);
//   • у цели лишь метка, какая из ран — рог: flags.warhammer-dbc.lodgedHorn =
//     { armorKey }. Рог «в ране», только пока Проникающее в этой локации не
//     снято, поэтому извлечённый снаряд гасит эффект сам, без отдельной чистки;
//   • у владельца — flags.warhammer-dbc.hornRegrowAt (worldTime), до которого
//     рогами бить нельзя.
//
//  Без Foundry: чистые функции над актором-как-данными.
// ════════════════════════════════════════════════════════════════════════

export const NS = "warhammer-dbc";
/** Метка на оружии «Обломить Рог»: попадание оставляет рог в ране. */
export const LODGES_HORN_FLAG = "lodgesHorn";
/** Метка на обоих оружиях Рога Чумоноса: их блокирует отрастание. */
export const PLAGUE_HORN_FLAG = "plagueHorn";
/** Метка на цели: { armorKey } — в какой локации рог. */
export const LODGED_HORN_FLAG = "lodgedHorn";
/** Метка на владельце: worldTime, до которого рог не отросла. */
export const HORN_REGROW_FLAG = "hornRegrowAt";
/** 3 часа — игровых секунд. */
export const HORN_REGROW_SECONDS = 3 * 60 * 60;

const flag = (doc, key) => doc?.getFlag?.(NS, key);

/** В ране цели сейчас торчит рог (метка есть, а Проникающее в этой локации ещё не снято). */
export function hasLodgedHorn(actor) {
  const mark = flag(actor, LODGED_HORN_FLAG);
  if (!mark?.armorKey) return false;
  return (Number(actor?.system?.piercingWounds?.[mark.armorKey]) || 0) > 0;
}

/** Оружие оставляет рог в ране. */
export const lodgesHorn = weapon => !!flag(weapon, LODGES_HORN_FLAG);

/** Оружие — рог Чумоноса (любой из двух видов). */
export const isPlagueHorn = weapon => !!flag(weapon, PLAGUE_HORN_FLAG);

/** Сколько секунд игрового времени осталось до отрастания рога (0 — рог на месте). */
export function hornRegrowLeft(owner, now) {
  const until = Number(flag(owner, HORN_REGROW_FLAG)) || 0;
  return Math.max(0, until - (Number(now) || 0));
}

/** Целые часы/минуты для подписи («2 ч 15 мин»). */
export function regrowLabel(seconds) {
  const m = Math.ceil((Number(seconds) || 0) / 60);
  const h = Math.floor(m / 60);
  return h ? `${h} ч ${m % 60} мин` : `${m} мин`;
}
