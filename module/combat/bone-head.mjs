// module/combat/bone-head.mjs
// ════════════════════════════════════════════════════════════════════════════
//  BONE-Head / Костеголов (Огрин) — Foundry-обвязка над rules/bone-head.mjs:
//
//  • payIntTestAction — «любой тест I занимает минимум Полное действие»:
//    зовётся из sheets/actor-sheet.mjs::_runTest до броска;
//  • рекорд поля Haywire (rememberHaywireField) и хук движения токена —
//    «…или пока не покинет поле»: вышел за радиус — Сбой импланта и Ступор
//    от этого поля снимаются сами.
// ════════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "../rules/flags.mjs";
import {
  INT_FULL_ACTION_FLAG, INT_TEST_AP_COST, HAYWIRE_FIELD_FLAG, leftHaywireField
} from "../rules/bone-head.mjs";
import { isEncounterActive, hasActionEconomy, isOwnTurn, spendActionPoints } from "./action-economy.mjs";
import { clearConditionDuration } from "./condition-effects.mjs";
import { conditionRemoveFields } from "../sheets/tabs/conditions.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";

const NS = "warhammer-dbc";

/**
 * Списать Полное действие за тест I у Костеголова. В бою и в свой Ход —
 * 2 ОД (не хватает — false, тест не бросается); вне боя или не в свой Ход
 * (тест по просьбе ГМа, встречный) — ничего не тратит.
 *
 * @returns {Promise<boolean>} можно ли бросать
 */
export async function payIntTestAction(actor, charKey) {
  if (String(charKey).toLowerCase() !== "int") return true;
  if (!isEncounterActive() || !hasActionEconomy(actor) || !isOwnTurn(actor)) return true;
  if (!hasRuleFlag(actor, INT_FULL_ACTION_FLAG)) return true;
  if (await spendActionPoints(actor, INT_TEST_AP_COST, { physical: false })) return true;
  globalThis.ui?.notifications?.warn?.(`⚠️ ${actor.name}: BONE-Head — тест I занимает Полное действие (${INT_TEST_AP_COST} ОД), ОД не хватает.`);
  return false;
}

/** Центр токена в пикселях сцены. */
function tokenCenter(tokenDoc) {
  const size = Number(tokenDoc?.parent?.grid?.size) || 100;
  return {
    x: (Number(tokenDoc?.x) || 0) + (Number(tokenDoc?.width) || 1) * size / 2,
    y: (Number(tokenDoc?.y) || 0) + (Number(tokenDoc?.height) || 1) * size / 2
  };
}

/** Токен актора на текущей сцене (связанный — любой из активных). */
function sceneTokenOf(actor) {
  if (actor?.token) return actor.token;
  const t = actor?.getActiveTokens?.()?.[0];
  return t?.document ?? null;
}

/**
 * Запомнить поле, сбившее имплант: центр — там, где стоял сбитый в момент
 * попадания (поле создаётся «при попадании» вокруг цели), радиус — X у
 * Haywire (X), метры. Haywire (0) «привязан к цели» — выйти из него нельзя,
 * поле не запоминаем. dazed — наложен ли этим полем Ступор (7+): снимать
 * при выходе только его, а не чужой.
 */
export async function rememberHaywireField(actor, { radius = 0, dazed = false } = {}) {
  const token = sceneTokenOf(actor);
  const r = Number(radius) || 0;
  if (!token || r <= 0) {
    if (actor?.getFlag?.(NS, HAYWIRE_FIELD_FLAG)) await actor.unsetFlag(NS, HAYWIRE_FIELD_FLAG);
    return;
  }
  const c = tokenCenter(token);
  await actor.setFlag(NS, HAYWIRE_FIELD_FLAG, {
    sceneId: token.parent?.id ?? "", x: c.x, y: c.y, radius: r, dazed: !!dazed
  });
}

/**
 * Проверка после перемещения токена: вышел из поля — снять Сбой импланта (и
 * Ступор, если его наложило это поле). Сбоя уже нет (срок вышел, сняли
 * рукой) — погасить запомненное поле.
 */
export async function checkHaywireFieldExit(tokenDoc) {
  const actor = tokenDoc?.actor;
  const field = actor?.getFlag?.(NS, HAYWIRE_FIELD_FLAG);
  if (!field) return;
  if (!actor.system?.conditions?.implantHaywire) {
    await actor.unsetFlag(NS, HAYWIRE_FIELD_FLAG);
    return;
  }
  if (field.sceneId && tokenDoc.parent?.id !== field.sceneId) return;
  const grid = tokenDoc.parent?.grid ?? {};
  if (!leftHaywireField(field, tokenCenter(tokenDoc), { gridSize: grid.size, gridDistance: grid.distance })) return;

  const removed = ["Сбой импланта"];
  await clearConditionDuration(actor, "implantHaywire");
  const patch = { ...conditionRemoveFields("implantHaywire"), [`flags.${NS}.-=${HAYWIRE_FIELD_FLAG}`]: null };
  if (field.dazed && actor.system?.conditions?.dazed) {
    await clearConditionDuration(actor, "dazed");
    Object.assign(patch, conditionRemoveFields("dazed"));
    removed.push("Ступор");
  }
  await actor.update(patch);
  await postTestCard(actor, {
    icon: rollIcon("bolt", "#8fd0ff"), title: `${esc(actor.name)} — вышел из поля Haywire`,
    lines: [`<div class="roll-threshold">BONE-Head: снято — ${removed.join(", ")}.</div>`]
  }, { sound: false });
}

/** Хук движения: проверяет только клиент, двинувший токен (как squeeze.mjs). */
export function initBoneHeadHooks() {
  Hooks.on("updateToken", async (tokenDoc, changes, options, userId) => {
    if (userId !== game.user.id) return;
    if (!Object.hasOwn(changes, "x") && !Object.hasOwn(changes, "y")) return;
    await checkHaywireFieldExit(tokenDoc);
  });
}
