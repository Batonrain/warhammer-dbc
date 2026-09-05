// module/combat/bone-song.mjs
// ════════════════════════════════════════════════════════════════════════
//  Bone Song/Костяная Песня (Талант Певцов Кости, wdbc-sk8s): «За Полное
//  действие... Одна психокостяная техника в радиусе W м восстанавливает
//  1d10+F.b структуры и столько же AP и избавляется от всех поломок; либо
//  радиус 10 м — вся техника восстанавливает 1d5+½F.b структуры и AP и одну
//  поломку. Начиная от техники Размера 4 и больше объём восстановления
//  снижается на их Размер+1, если у персонажа нет Мастера на пути Певца
//  Кости. До F.b раз за сессию.» (числа масштабирования — правки автора
//  книги от 31.08.2026, снявшие блокировку с wdbc-sk8s).
//
//  «AP» — Armour Points техники: движок пока не отслеживает разъедание/
//  потерю AP у техники (combat/damage.mjs::armorCorrosion — только у
//  Персонажа/NPC, _creature.mjs), восстанавливать пока нечего — не
//  смоделировано, см. isBoneSongApAvailable ниже.
//  «Поломки» — system.damageStates (живой список ГМа на листе техники,
//  sheets/vehicle-sheet.mjs) — снимается целиком (одиночная цель) или по
//  одной записи с каждой техники (область), без приоритета какую убрать.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "../rules/predicates.mjs";
import { isThrottleCountAvailable, incrementThrottleCount } from "../rules/cooldown.mjs";
import { tokensWithinRadius } from "../rules/aoe-target.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";

const FLAG = "boneSong";

/** Владеет ли актор Талантом Bone Song / Костяная Песня. */
export function hasBoneSong(actor) {
  return !!actor?.items?.some(i => i.type === "talent" && itemHasName(i, "Bone Song"));
}

/** Мастер ли актор на Пути Певца Кости (module/constants/aeldari-paths.mjs::bonesinger). */
export function isBonesingerMaster(actor) {
  const paths = actor?.system?.paths;
  return Array.isArray(paths) && paths.some(p => p?.key === "bonesinger" && p?.grade === "master");
}

/** Лимит использований за сессию — F.b (минимум 1). */
export function boneSongMax(actor) {
  return Math.max(1, Number(actor?.system?.characteristics?.fel?.bonus) || 0);
}

export function boneSongAvailable(actor) {
  return hasBoneSong(actor) && isThrottleCountAvailable(actor, FLAG, "session", boneSongMax(actor));
}

/**
 * Снижение объёма восстановления для техники Размера 4+ без Мастера на
 * Пути Певца Кости — Размер+1 (книжное «Размер+1», не Размер×1). 0, если
 * Размер < 4 или у певца есть Мастер.
 */
export function boneSongSizeReduction(actor, size) {
  const s = Number(size) || 0;
  if (s < 4 || isBonesingerMaster(actor)) return 0;
  return s + 1;
}

async function repairOne(vehicleActor, rawAmount, reduction, { clearAll } = {}) {
  const amount = Math.max(0, rawAmount - reduction);
  const struct = vehicleActor.system.structure || {};
  const newValue = Math.min(Number(struct.max) || 0, (Number(struct.value) || 0) + amount);
  const update = { "system.structure.value": newValue };

  const states = foundry.utils.deepClone(vehicleActor.system.damageStates || []);
  if (states.length) {
    update["system.damageStates"] = clearAll ? [] : states.slice(1);
  }
  await vehicleActor.update(update);
  return { name: vehicleActor.name, amount, clearedStates: clearAll ? states.length : Math.min(1, states.length) };
}

async function spendAndCount(actor) {
  await incrementThrottleCount(actor, FLAG, "session", boneSongMax(actor));
}

/** Одиночная цель (radius W м = WP актора в метрах) — берётся из game.user.targets. */
export async function applyBoneSongSingle(actor, targetActor) {
  await spendAndCount(actor);
  const felBonus = Number(actor.system?.characteristics?.fel?.bonus) || 0;
  const roll = await new Roll(`1d10+${felBonus}`).evaluate();
  const size = Number(targetActor.system?.size) || 0;
  const reduction = boneSongSizeReduction(actor, size);
  const { name, amount, clearedStates } = await repairOne(targetActor, roll.total, reduction, { clearAll: true });

  await postTestCard(actor, {
    icon: rollIcon("wrench", "#7fd3ff"), title: `Костяная Песня — ${esc(name)}`,
    lines: [
      `<div class="roll-threshold">1d10+F.b = <b>${roll.total}</b>${reduction ? ` − ${reduction} (Размер ${size})` : ""} → <b>+${amount}</b> Структуры${clearedStates ? ", все поломки сняты" : ""}</div>`,
      `<div class="roll-threshold" style="font-size:0.85em;opacity:.8;">AP техники: не отслеживается движком, восстанавливать нечего.</div>`
    ]
  }, { sound: false });
}

/** Область (радиус 10 м) — вся техника в радиусе casterToken, один общий бросок. */
export async function applyBoneSongArea(actor, casterToken) {
  await spendAndCount(actor);
  const felBonus = Number(actor.system?.characteristics?.fel?.bonus) || 0;
  const halfFel = Math.ceil(felBonus / 2);
  const roll = await new Roll(`1d5+${halfFel}`).evaluate();
  const inRange = tokensWithinRadius(casterToken, 10, { actorType: "vehicle" });

  const lines = [];
  for (const tokenDoc of inRange) {
    const vehicleActor = tokenDoc.actor;
    const size = Number(vehicleActor.system?.size) || 0;
    const reduction = boneSongSizeReduction(actor, size);
    const { name, amount, clearedStates } = await repairOne(vehicleActor, roll.total, reduction, { clearAll: false });
    lines.push(`${esc(name)}: +${amount} Структуры${reduction ? ` (−${reduction}, Размер ${size})` : ""}${clearedStates ? ", 1 поломка снята" : ""}`);
  }

  await postTestCard(actor, {
    icon: rollIcon("wrench", "#7fd3ff"), title: "Костяная Песня — область (радиус 10 м)",
    lines: [
      `<div class="roll-threshold">1d5+½F.b = <b>${roll.total}</b> каждой технике</div>`,
      ...(lines.length ? lines.map(l => `<div>${l}</div>`) : ["<div><i>Нет техники в радиусе</i></div>"]),
      `<div class="roll-threshold" style="font-size:0.85em;opacity:.8;">AP техники: не отслеживается движком, восстанавливать нечего.</div>`
    ]
  }, { sound: false });
}
