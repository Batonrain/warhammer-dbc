// module/combat/delayed-blast.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ОЧЕРЕДЬ «ВЗРЫВ ЧЕРЕЗ N РАУНДОВ» — поток (правила и числа — rules/delayed-blast.mjs).
//
//  • scheduleDelayedBlast — записать взрыв в очередь актора (флаг);
//  • processDelayedBlastsTurnStart — начало Хода владельца (hooks.mjs, updateCombat,
//    пишет ГМ): срок −1, дошедшие до 0 взрываются;
//  • detonateDelayedBlast — карточка взрыва: бросок урона, кнопки «Разместить шаблон»
//    и «Применить урон» (те же, что у гранаты, combat/draw-action.mjs), предметы-
//    источники уничтожаются (system.destroyed, магазин оружия обнуляется).
//
//  Запись переживает конец боя (раундов вне боя нет): отсчёт продолжится с первого
//  Хода владельца в следующем бою — ГМ может взорвать её сам, убрав запись из флага.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import {
  DELAYED_BLASTS_FLAG, makeDelayedBlast, tickDelayedBlasts, pendingDelayedBlasts
} from "../rules/delayed-blast.mjs";

const NS = "warhammer-dbc";

/** Поставить взрыв в очередь актора. Возвращает запись. */
export async function scheduleDelayedBlast(actor, fields) {
  const entry = makeDelayedBlast({ id: foundry.utils.randomID(), ...fields });
  await actor.setFlag(NS, DELAYED_BLASTS_FLAG, [...pendingDelayedBlasts(actor), entry]);
  return entry;
}

/**
 * Взрыв: один бросок урона, кнопки места и применения урона, предметы уничтожены.
 * @param {Actor} actor  владелец записи (чьё оружие взорвалось)
 * @param {object} entry запись очереди (rules/delayed-blast.mjs::makeDelayedBlast)
 * @param {{reason?:string}} [o]
 */
export async function detonateDelayedBlast(actor, entry, { reason = "" } = {}) {
  const e = makeDelayedBlast(entry);
  const weaponName = esc(e.weaponName);
  const actorName = esc(actor.name);
  const dmgRoll = await new Roll(e.damage).evaluate();
  const total = dmgRoll.total;
  const templateBtn = e.blast > 0 ? `
    <button class="wh-place-template-btn" type="button"
      data-shape="circle" data-meters="${e.blast}"
      data-weapon-name="${weaponName}" data-attacker-uuid="${actor.uuid}" data-item-uuid="">
      🎯 Разместить шаблон (${e.blast} м) и отметить цели
    </button>` : "";
  const dmgBtn = `
    <button class="wh-apply-dmg-btn" type="button"
      data-damage="${total}" data-penetration="${e.pen}"
      data-damage-type="${esc(e.damageType)}" data-damage-subtype="${esc(e.damageSubtype)}"
      data-hit-location="Торс" data-weapon-name="${weaponName}"
      data-weapon-uuid="" data-attacker="${actorName}" data-attacker-uuid="${actor.uuid}"
      data-felling="0" data-primitive="0" data-ignore-shield="0" data-warp-soak="0"
      data-lance="0" data-sanctified="0"
      data-blast="${e.blast}" data-flame="0" data-power-field="0" data-spray="0"
      data-devastating="0" data-weapon-range="0" data-melee="0" data-burst="0"
      data-corrosive="0" data-entropy="0" data-touch-of-pain="0" data-crippling="0" data-piercing="0"
      data-haywire="" data-haywire-dmg2="" data-through-shot="0" data-has-extreme="0">
      Применить урон: <b>${total}</b> → Торс <span class="roll-hit-extra">(отметьте всех в радиусе ${e.blast} м — «Всем»)</span>
    </button>`;
  const dice = await dmgRoll.render();
  await postTestCard(actor, {
    icon: rollIcon("burst", "#ff8a4d"),
    title: `${esc(e.label)} — ${actorName}`,
    lines: [
      `<div class="roll-threshold" style="color:#ffb86b;">💥 ${reason ? `${esc(reason)} ` : ""}Взрыв: ${total} Dmg, Pen ${e.pen}, Blast(${e.blast}). Батарея, оружие и нож уничтожены.</div>`
    ],
    sections: [
      `<div class="roll-apply-dmg-section">${templateBtn}${dmgBtn}</div>`,
      `<details class="roll-dice-details"><summary>${rollIcon("chart", "#8fd0ff")}Показать кубы</summary>${dice}</details>`
    ]
  }, { rolls: [dmgRoll] });

  // Уничтожение: оружие и нож — system.destroyed (без удаления, ГМ может вернуть), магазин оружия пуст,
  // заряженная батарея-боеприпас списана.
  for (const id of e.itemIds) {
    const it = actor.items.get(id);
    if (!it) continue;
    const upd = { "system.destroyed": true };
    if (it.type === "weapon" && (Number(it.system?.magazineMax) || 0) > 0) upd["system.magazineCur"] = 0;
    await it.update(upd);
    const ammoId = it.system?.loadedAmmoId;
    const ammo = ammoId ? actor.items.get(ammoId) : null;
    if (ammo) {
      const qty = Number(ammo.system?.quantity) || 1;
      if (qty > 1) await ammo.update({ "system.quantity": qty - 1 });
      else await ammo.delete();
    }
  }
  return total;
}

/**
 * Начался Ход комбатанта: срок записей его актора −1, дошедшие взрываются.
 * Пишет ГМ (hooks.mjs). Дополнительные Ходы того же актора (extraTurnSource) срок не убавляют.
 */
export async function processDelayedBlastsTurnStart(combatant) {
  const actor = combatant?.actor;
  if (!actor || combatant.getFlag?.(NS, "extraTurnSource")) return;
  const list = pendingDelayedBlasts(actor);
  if (!list.length) return;
  const { remaining, due } = tickDelayedBlasts(list);
  if (remaining.length) await actor.setFlag(NS, DELAYED_BLASTS_FLAG, remaining);
  else await actor.unsetFlag(NS, DELAYED_BLASTS_FLAG);
  for (const entry of due) await detonateDelayedBlast(actor, entry);
}
