// module/combat/recharge.mjs
// ─────────────────────────────────────────────────────────────────────────────
//  ПЕРЕЗАРЯДКА (weapon-properties.mjs::recharge) — «нельзя стрелять в
//  следующий Ход»: выстрел ставит system.needsRecharge=true, и ровно ОДИН
//  собственный Ход носителя после выстрела остаётся заблокированным — не
//  «до начала следующего Хода» (это сняло бы блок сразу, будто Перезарядки
//  и не было), а «весь следующий Ход целиком».
//
//  system.rechargeTurnsRemaining — счётчик оставшихся стартов Хода носителя,
//  которые должны молча пройти, прежде чем needsRecharge снимется. Выстрел
//  (attack.mjs) ставит его в 1; на первом же старте Хода после выстрела
//  needsRecharge ЕЩЁ true (этот Ход — тот самый заблокированный), счётчик
//  уходит в 0; на СЛЕДУЮЩЕМ старте Хода needsRecharge наконец снимается.
//  Тот же такт вызова, что и processPrismaTurnStart — начало Хода носителя
//  (module/hooks.mjs).
// ─────────────────────────────────────────────────────────────────────────────

/** Гейт кнопки «Атака» на листе (tab-combat.hbs, тот же приём, что jammed). */
export async function processRechargeTurnStart(actor) {
  const weapons = (actor?.items ?? []).filter(i => i.type === "weapon" && i.system?.needsRecharge);
  for (const item of weapons) {
    const remaining = Number(item.system.rechargeTurnsRemaining) || 0;
    if (remaining > 0) {
      await item.update({ "system.rechargeTurnsRemaining": remaining - 1 });
    } else {
      await item.update({ "system.needsRecharge": false });
    }
  }
}
