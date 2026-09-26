// module/combat/limb-loss.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Foundry-обвязка над module/rules/limb-loss.mjs (стр. 30-31, wdbc-1rno.6;
//  по сторонам — wdbc-x1nz.2.100):
//   • потеря части тела на стороне (крит, лечение) — lostSideFields;
//   • розыгрыш просроченных таймеров Гангрены обрубков по updateWorldTime;
//   • «выронить из руки» — потерянная или бесполезная рука не держит то, что
//     держала (wdbc-x1nz.2.100), и крит-строки «Цель роняет всё, что держит
//     в этой руке».
// ════════════════════════════════════════════════════════════════════════════

import { dueLimbLossGangreneSides, BODY_SIDE_SHORT, lostSideKey,
         lossOfLimbTarget, lossOfLimbSideKey, mutationLossFields } from "../rules/limb-loss.mjs";
import { itemHasName } from "../rules/predicates.mjs";
import { conditionApplyFields } from "../sheets/tabs/conditions.mjs";
import { getHeldHand, handsOccupied, isWristMounted, weaponHandsRequired } from "../rules/hands.mjs";
import { isHandShield } from "./hand-shield.mjs";
import { CONDITIONS_DEF } from "../constants/conditions.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";

const NS = "warhammer-dbc";

/**
 * Просроченные таймеры обрубков — по каждой стороне свой бросок 1d10
 * (книжные «80%, 1-8 на 1d10» — Гангрена), снятие таймера и карточка в чат.
 * GM-гейт — тот же, что apps/wrapped-in-chaos.mjs::sweepSweetMistExpiry.
 */
export async function sweepLimbLossGangrene(worldTime) {
  if (!game.users?.activeGM || game.user?.id !== game.users.activeGM.id) return;
  for (const actor of game.actors ?? []) {
    for (const { key, side } of dueLimbLossGangreneSides(actor.system, worldTime)) {
      const roll = await new Roll("1d10").evaluate();
      const gangrene = roll.total <= 8;
      const updates = { [`system.lostLimbs.${lostSideKey(key, side)}.gangreneAt`]: 0 };
      if (gangrene) Object.assign(updates, conditionApplyFields("gangrene", null, actor));
      await actor.update(updates);

      const def = CONDITIONS_DEF[key];
      await ChatMessage.create(ChatMessage.applyRollMode({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="wh-roll-result">
          <div class="roll-header">${rollIcon("skull", gangrene ? "#ff6b6b" : "#9fd08a")}${esc(actor.name)} — Обрубок (${esc(def?.label || key)}, ${BODY_SIDE_SHORT[side]})</div>
          <div class="roll-threshold">Обрубок не был обработан вовремя — проверка Гангрены (80%, 1-8 на 1d10): бросок <b>${roll.total}</b></div>
          <div class="roll-outcome">${gangrene
            ? `<span class="roll-failure">Обрубок загноился — наложена Гангрена.</span>`
            : `<span class="roll-success">Пронесло — заживление обошлось без осложнений.</span>`}</div>
        </div>`,
        rolls: [roll],
        sound: CONFIG.sounds.dice
      }, game.settings.get("core", "rollMode")));
    }
  }
}

/**
 * Что выпадает из руки на стороне side ("right"/"left") — чистый отбор по
 * уже пересчитанному актору (звать ПОСЛЕ update, лишившего руку):
 *   • предметы, назначенные этой руке (heldHand); закреплённое на запястье
 *     (когти, нартеций) и щит — только если рука целиком (wrist:true) —
 *     потерянная кисть оставляет запястье, щит садится на обрубок;
 *   • если после этого рук всё равно не хватает (двуручное, предметы без
 *     назначенной руки) — лишнее по одному, двуручное первым.
 */
export function itemsToDrop(actor, side, { wrist = true } = {}) {
  const equipped = [...(actor?.items ?? [])].filter(i => i.type === "weapon" && i.system?.equipped);
  const drop = equipped.filter(i => getHeldHand(i) === side
    && (wrist || (!isWristMounted(i, actor) && !isHandShield(i))));
  const dropIds = new Set(drop.map(i => i.id));
  const rest = equipped.filter(i => !dropIds.has(i.id) && weaponHandsRequired(i, actor) > 0)
    .sort((a, b) => weaponHandsRequired(b, actor) - weaponHandsRequired(a, actor));
  for (const item of rest) {
    if (!handsOccupiedWithout(actor, dropIds).over) break;
    if (!getHeldHand(item) || weaponHandsRequired(item, actor) >= 2) { drop.push(item); dropIds.add(item.id); }
  }
  return drop;
}

/** handsOccupied без набора предметов — handsOccupied умеет исключать один, здесь — несколько. */
function handsOccupiedWithout(actor, ids) {
  // Тень актора: всё от настоящего (прототип), кроме списка предметов.
  const shadow = Object.create(actor);
  Object.defineProperty(shadow, "items", { value: [...(actor.items ?? [])].filter(i => !ids.has(i.id)) });
  return handsOccupied(shadow);
}

/**
 * Выронить из руки на стороне: equipped:false без траты ОД (это не «Сложить»,
 * предмет просто выпал), карточка в чат. Вернёт имена выроненного.
 */
export async function dropFromHand(actor, side, { wrist = true, reason = "" } = {}) {
  if (!actor || !side) return [];
  const drop = itemsToDrop(actor, side, { wrist });
  if (!drop.length) return [];
  await actor.updateEmbeddedDocuments("Item", drop.map(i => ({ _id: i.id, "system.equipped": false })));
  const names = drop.map(i => i.name);
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("warn", "#d9a066")}${esc(actor.name)} роняет (${BODY_SIDE_SHORT[side]} рука)</div>
      <div class="roll-threshold">${names.map(esc).join(", ")}${reason ? ` — ${esc(reason)}` : ""}</div>
    </div>`
  }, game.settings.get("core", "rollMode")));
  return names;
}

// ── Мутация Loss of Limb / Потеря Конечности (wdbc-1rno.6.1) ────────────────

/** Флаг предмета-мутации: подпись строки субмутации, уже применённой к актору. */
const LOSS_OF_LIMB_APPLIED = "lossOfLimbApplied";

export function isLossOfLimbMutation(item) {
  return item?.type === "mutation" && itemHasName(item, "Loss of Limb");
}

/**
 * Привести потерю на акторе к выпавшей субмутации (бросок на листе
 * мутации, apps/submutations.mjs) — без таймера Гангрены и Кровотечения
 * (обрубок «давно затянулся»). Смена строки возвращает прежнюю часть тела,
 * если её потерю до сих пор держит именно мутация; удаление мутации —
 * тоже. Потерянное кистью/рукой — выпадает из руки.
 */
export async function syncLossOfLimbMutation(item, { removed = false } = {}) {
  const actor = item?.actor;
  if (!actor || !isLossOfLimbMutation(item)) return;
  const prevLabel = item.getFlag?.(NS, LOSS_OF_LIMB_APPLIED) || "";
  const prev = lossOfLimbTarget(prevLabel);
  const label = removed ? "" : String(item.system?.submutation?.label ?? "");
  const target = lossOfLimbTarget(label);
  if (!removed && lossOfLimbSideKey(prev) === lossOfLimbSideKey(target)) return;

  const patch = {};
  const prevKey = lossOfLimbSideKey(prev);
  if (prevKey && actor.system?.lostLimbs?.[prevKey]?.mutation) Object.assign(patch, mutationLossFields(prev, false));
  if (target) Object.assign(patch, mutationLossFields(target, true));
  if (Object.keys(patch).length) await actor.update(patch);
  if (!removed) {
    if (target) await item.setFlag(NS, LOSS_OF_LIMB_APPLIED, label);
    else if (prevLabel) await item.unsetFlag(NS, LOSS_OF_LIMB_APPLIED);
  }
  if (!target) return;

  const what = target.fingers ? "Пальцы" : (CONDITIONS_DEF[target.key]?.label ?? target.key);
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("skull", "#b48cff")}${esc(actor.name)} — Потеря Конечности (мутация)</div>
      <div class="roll-threshold"><b>${esc(what)}</b> (${BODY_SIDE_SHORT[target.side]}) — обрубок давно затянулся: без Кровотечения и Гангрены. Восстановить — только Best.Q бионикой${target.fingers ? ". Атаки оружием в этой руке: −10" : ""}.</div>
    </div>`
  }, game.settings.get("core", "rollMode")));
  if (target.key === "lostHands" || target.key === "lostArms")
    await dropFromHand(actor, target.side, { wrist: target.key === "lostArms", reason: "мутация" });
}
