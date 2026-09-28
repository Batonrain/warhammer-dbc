// module/combat/fire-point.mjs
// ════════════════════════════════════════════════════════════════════════
//  Огневая Точка (Хавок) — Foundry-обвязка к module/rules/fire-point.mjs.
//  Включают: переброс стрелковой атаки за Очко Бесчестия (меню Очков на
//  карточке атаки, hooks.mjs::_attachFateContextMenu) и Закрепление
//  (combat/brace-weapon.mjs::declareBrace). Гасят: сдвиг токена (кроме
//  сдвига после Отскока — combat/recoil.mjs::performRecoil ставит метку) и
//  Состояние «Повален».
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import {
  FIRE_POINT_FLAG, hasFirePoint, firePointState, firePointAfterMove, firePointBreaksOnProne
} from "../rules/fire-point.mjs";

const NS = "warhammer-dbc";

/** Занять Огневую Точку (идемпотентно — уже занятую не трогает). */
export async function activateFirePoint(actor, reason = "") {
  if (!hasFirePoint(actor)) return false;
  if (firePointState(actor)?.active) return false;
  await actor.setFlag(NS, FIRE_POINT_FLAG, { active: true, recoil: false });
  await postTestCard(actor, {
    icon: rollIcon("target", "#c9a86a"),
    title: `${esc(actor.name)} — Огневая Точка`,
    lines: [`<div class="roll-threshold">${reason ? `${esc(reason)}. ` : ""}Все стрелковые атаки можно перебрасывать без траты Очка (меню Очков на карточке атаки, ПКМ), пока Хавок не сдвинется (кроме Отскока), не заляжет и не будет сбит с ног.</div>`]
  }, { sound: false });
  return true;
}

/** Снять Огневую Точку. */
export async function clearFirePoint(actor, why = "") {
  if (!firePointState(actor)) return;
  await actor.unsetFlag(NS, FIRE_POINT_FLAG);
  if (why) ui.notifications?.info(`${actor.name}: Огневая Точка потеряна — ${why}.`);
}

/** Отскок (стр. 12): ближайший сдвиг токена точку не гасит. */
export async function markFirePointRecoil(actor) {
  const state = firePointState(actor);
  if (!state?.active) return;
  await actor.setFlag(NS, FIRE_POINT_FLAG, { ...state, recoil: true });
}

export function initFirePointHooks() {
  Hooks.on("updateToken", async (tokenDoc, changes, options, userId) => {
    if (userId !== game.user.id) return;
    const moved = ("x" in changes) || ("y" in changes);
    const actor = tokenDoc?.actor;
    const state = firePointState(actor);
    const verdict = firePointAfterMove(state, moved);
    if (verdict === "break") await clearFirePoint(actor, "сдвинулся с места");
    else if (verdict === "reanchor") await actor.setFlag(NS, FIRE_POINT_FLAG, { ...state, recoil: false });
  });

  Hooks.on("updateActor", async (actor, changes, options, userId) => {
    if (userId !== game.user.id) return;
    if (!changes?.system?.conditions || !("prone" in changes.system.conditions)) return;
    if (firePointBreaksOnProne(firePointState(actor), actor.system?.conditions?.prone)) {
      await clearFirePoint(actor, "залёг или сбит с ног");
    }
  });
}
