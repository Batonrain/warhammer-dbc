// module/combat/squeeze.mjs
// ═══════════════════════════════════════════════════════════════════════════
//  Стены и Двери (wdbc-x1nz.2, стр. 31) — живой детект протискивания сквозь
//  дверь уже половины Базы. Только НАПОМИНАНИЕ (карточка в чат) — штраф ГМ
//  вводит сам, книга нарочно не даёт числа («ключевое слово здесь «может»»).
//
//  Тот же preUpdateToken/updateToken приём, что у combat/free-attack.mjs:
//  «до» запоминаем в preUpdateToken (Map по id токена, протухает по TTL —
//  та же защита от отменённого/незавершённого драга, что там), «после»
//  сверяем в updateToken. Ограничено isBaseTrackedActor (tactical-map.mjs) —
//  только у тех, для кого вообще посчитана База, протискивание что-то значит.
// ═══════════════════════════════════════════════════════════════════════════

import { narrowestDoorCrossed, isSqueeze } from "../rules/squeeze.mjs";
import { actorBaseSizeCells, isBaseTrackedActor } from "./tactical-map.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

/** Стены-двери сцены (WALL_DOOR_TYPES: 0 none, 1 door, 2 secret — оба варианта считаются). */
function doorWallsOnScene(scene) {
  return (scene?.walls?.contents ?? []).filter(w => Number(w.door) > 0);
}

/**
 * Проверка одного перемещения: пересекло ли оно дверь уже половины Базы.
 * Принимает уже готовые данные — тестируется без canvas.
 * @returns {{doorWidthCells:number}|null}
 */
export function checkSqueeze({ fromCenter, toCenter, doorWalls, cellPx, baseSize }) {
  if (!baseSize) return null; // Размер 2+ — на откуп ГМу (wdbc-x1nz.2.20), не наше дело
  const width = narrowestDoorCrossed(fromCenter, toCenter, doorWalls, cellPx);
  if (width == null) return null;
  return isSqueeze(width, baseSize) ? { doorWidthCells: width } : null;
}

export async function postSqueezeReminder(actor, tokenName) {
  const rollMode = game.settings.get("core", "rollMode");
  const messageData = ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("run", "#ffcf4d")}${esc(tokenName)} — протискивается в проём</div>
        <div class="roll-threshold">Проём уже половины Базы (стр. 31). ГМ <b>может</b> дать штраф на тесты движения/уклонения от атак и штраф от длинного рукопашного оружия на атаку — необязательно, решает ГМ.</div>
      </div>`,
    sound: null
  }, rollMode);
  await ChatMessage.create(messageData);
}

function centerOf(x, y, widthCells, heightCells, gridSize) {
  return { x: x + (widthCells * gridSize) / 2, y: y + (heightCells * gridSize) / 2 };
}

// tokenId → { x, y, ts } — позиция ДО перемещения.
const _preMovePos = new Map();
const PRE_MOVE_TTL_MS = 5000;

function pruneStalePreMovePos(now = Date.now()) {
  for (const [id, entry] of _preMovePos) if (now - entry.ts > PRE_MOVE_TTL_MS) _preMovePos.delete(id);
}

function movesPosition(changes) {
  return Object.prototype.hasOwnProperty.call(changes, "x")
      || Object.prototype.hasOwnProperty.call(changes, "y");
}

export function initSqueezeHooks() {
  Hooks.on("preUpdateToken", (tokenDoc, changes) => {
    pruneStalePreMovePos();
    if (!movesPosition(changes)) return;
    _preMovePos.set(tokenDoc.id, { x: tokenDoc.x, y: tokenDoc.y, ts: Date.now() });
  });

  Hooks.on("updateToken", async (tokenDoc, changes, options, userId) => {
    pruneStalePreMovePos();
    const before = _preMovePos.get(tokenDoc.id);
    _preMovePos.delete(tokenDoc.id);
    // Только клиент, вызвавший перемещение, репортит протискивание — тот же
    // приём, что free-attack.mjs (иначе карточка ушла бы с каждого клиента разом).
    if (userId !== game.user.id) return;
    if (!before || !movesPosition(changes)) return;

    const actor = tokenDoc.actor;
    if (!isBaseTrackedActor(actor)) return;
    const baseSize = actorBaseSizeCells(actor);
    if (!baseSize) return;

    const scene = tokenDoc.parent;
    const gridSize = scene?.grid?.size || 100;
    const fromCenter = centerOf(before.x, before.y, tokenDoc.width, tokenDoc.height, gridSize);
    const toCenter   = centerOf(tokenDoc.x, tokenDoc.y, tokenDoc.width, tokenDoc.height, gridSize);
    const doorWalls  = doorWallsOnScene(scene);

    const result = checkSqueeze({ fromCenter, toCenter, doorWalls, cellPx: gridSize, baseSize });
    if (result) await postSqueezeReminder(actor, tokenDoc.name);
  });

  Hooks.on("deleteToken", tokenDoc => _preMovePos.delete(tokenDoc.id));
}
