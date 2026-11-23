// module/combat/minion-gm-control.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Перехват Миньона ГМом (корбук стр. 113, wdbc-8x31x): «При Провале теста на
//  лояльность в бою ГМ перехватывает контроль над Миньоном до конца боя».
//
//  Раньше система писала это строкой карточки и прав не трогала. Теперь права
//  игроков на актора Миньона на время боя опускаются до «Наблюдателя» (лист и
//  токен видны, двигать и бросать нельзя), а прежние права запоминаются флагом
//  и возвращаются сами, когда бой удалён. Менять права может только ГМ:
//  бросил ГМ — перехват сразу, бросил игрок — на карточке кнопка для ГМа.
// ════════════════════════════════════════════════════════════════════════════

const SYSTEM = "warhammer-dbc";
export const GM_CONTROL_FLAG = "gmControl";
const OWNER = 3, OBSERVER = 2;

/**
 * Чистая часть: права на время перехвата. Каждый игрок с правами выше
 * «Наблюдателя» опускается до него; права по умолчанию (`default`) тоже.
 * @param {Record<string,number>} ownership  actor.ownership
 * @param {(id:string)=>boolean} isGM        id пользователя — ГМ?
 * @returns {Record<string,number>}
 */
export function seizedOwnership(ownership = {}, isGM = () => false) {
  const out = {};
  for (const [id, lvl] of Object.entries(ownership ?? {})) {
    if (id === "default") out[id] = Math.min(Number(lvl) || 0, OBSERVER);
    else if (isGM(id)) out[id] = lvl;
    else out[id] = Number(lvl) >= OWNER ? OBSERVER : lvl;
  }
  return out;
}

/** Перехвачен ли Миньон сейчас. */
export function isSeized(actor) {
  return !!actor?.getFlag?.(SYSTEM, GM_CONTROL_FLAG);
}

/**
 * Забрать Миньона под контроль ГМа до конца текущего боя.
 * @returns {Promise<boolean>} true — права изменены
 */
export async function seizeMinion(actor, { combatId = globalThis.game?.combat?.id ?? null } = {}) {
  if (!actor || !globalThis.game?.user?.isGM) return false;
  if (isSeized(actor)) return true;
  const saved = foundry.utils.deepClone(actor.ownership ?? {});
  const isGM = id => !!globalThis.game.users?.get(id)?.isGM;
  await actor.update({
    ownership: seizedOwnership(saved, isGM),
    [`flags.${SYSTEM}.${GM_CONTROL_FLAG}`]: { ownership: saved, combatId }
  });
  return true;
}

/** Вернуть права одному Миньону. */
export async function releaseMinion(actor) {
  const data = actor?.getFlag?.(SYSTEM, GM_CONTROL_FLAG);
  if (!data) return false;
  // Восстанавливаем целиком: ключи, которых раньше не было, удаляются (-=).
  const restore = { ...(data.ownership ?? {}) };
  for (const id of Object.keys(actor.ownership ?? {})) if (!(id in restore)) restore[`-=${id}`] = null;
  await actor.update({ ownership: restore, [`flags.${SYSTEM}.-=${GM_CONTROL_FLAG}`]: null });
  return true;
}

/** Бой удалён — вернуть права всем Миньонам, перехваченным в нём (или без метки боя). */
export async function releaseSeizedMinions(combat) {
  if (!globalThis.game?.user?.isGM) return 0;
  let n = 0;
  for (const actor of globalThis.game.actors ?? []) {
    const data = actor.getFlag?.(SYSTEM, GM_CONTROL_FLAG);
    if (!data) continue;
    if (data.combatId && combat?.id && data.combatId !== combat.id) continue;
    if (await releaseMinion(actor)) n++;
  }
  return n;
}
