// module/combat/gm-relay.mjs
// ════════════════════════════════════════════════════════════════════════
//  ЗАПИСЬ В ЧУЖОГО АКТОРА-ЦЕЛЬ ЧЕРЕЗ ГМа (Sahara riding-the-momentum, п. 2).
//
//  Захват, Повал, Жокей, Удушение, Вдохновить Гнев пишут в актора-ЦЕЛЬ с
//  клиента инициатора. Игрок почти никогда не «владеет» NPC, на которого
//  действует, — запись падала на проверке прав Foundry, причём УЖЕ ПОСЛЕ
//  записи на самого игрока: он оказывался в Захвате, а противник — нет.
//
//  Тот же приём, что relayItemUpdate (helpers/utils.mjs) и updateOrRelay
//  (combat/command-state.mjs): владелец/ГМ пишет сам, иначе правка уходит
//  активному ГМу системным сокетом. Сокет открыт ЛЮБОМУ клиенту, поэтому ГМ
//  принимает не произвольную правку, а узкий список (checkTargetWrite):
//    • update — только Состояния «Борьба»/«Ничком» и флаги Захвата/Жокея;
//    • addFatigue — Усталость хватки Удушения (1…20);
//    • inspireHatred — по сокету идёт только цель Ненависти, предмет собирает сам
//      ГМ из шаблона компендиума; нужен Талант Inspire Wrath у инициатора.
//  Просящий обязан владеть актором-инициатором (ГМ сверяет сам).
//
//  Порядок у вызывающего: сперва запись в цель (writeToTarget вернул false —
//  записать некому, инициатора не трогаем), потом запись в себя. Так отказ не
//  оставляет игрока в Захвате в одиночку.
// ════════════════════════════════════════════════════════════════════════

import { hasInspireWrath, inspiredHatredData, HATRED_PACK_ID } from "../rules/inspire-wrath.mjs";

const NS = "warhammer-dbc";

/** Действие сокета (warhammer-dbc.mjs). */
export const TARGET_WRITE_ACTION = "targetActorWrite";

/** Флаги Захвата/Жокея, которые разрешено писать в цель (имена — grapple.mjs, jockey.mjs; сверяет тест). */
export const RELAY_TARGET_FLAGS = Object.freeze([
  "grapplePartnerUuid", "grappleRole", "grappleHands", "grappleHeldHands", "grappleTail",
  "grappleSqueezePending", "grappleSqueezeActive", "pinDownHold",
  "jockeyMountedBy", "jockeyRiding", "leapUpDenied"
]);
/** Состояния, которые можно наложить/снять на цель из этих приёмов. */
export const RELAY_TARGET_CONDITIONS = Object.freeze(["grappling", "prone"]);
/** Верхняя граница Усталости за одну запись: Удушение даёт единицы, не десятки. */
export const RELAY_FATIGUE_MAX = 20;

const FLAG_PREFIX = `flags.${NS}.`;
const COND_PREFIX = "system.conditions.";

/**
 * Допустима ли запись. Чистая функция: контекст (владеет ли просящий
 * инициатором, есть ли у того Талант) приходит снаружи.
 *
 * @param {{kind:string}} op
 * @param {{initiatorOwned?:boolean, initiator?:object}} ctx
 * @returns {{ok:boolean, reason?:string}}
 */
export function checkTargetWrite(op, ctx = {}) {
  if (!op || typeof op !== "object") return { ok: false, reason: "нет операции" };
  if (!ctx.initiatorOwned) return { ok: false, reason: "просящий не владеет инициатором" };

  if (op.kind === "update") {
    const data = op.data;
    if (!data || typeof data !== "object" || !Object.keys(data).length) return { ok: false, reason: "пустая правка" };
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith(COND_PREFIX)) {
        const name = key.slice(COND_PREFIX.length);
        if (!RELAY_TARGET_CONDITIONS.includes(name) || typeof value !== "boolean") {
          return { ok: false, reason: `Состояние вне списка: ${key}` };
        }
        continue;
      }
      if (key.startsWith(FLAG_PREFIX)) {
        const rest = key.slice(FLAG_PREFIX.length);
        const removal = rest.startsWith("-=");
        const name = removal ? rest.slice(2) : rest;
        if (!RELAY_TARGET_FLAGS.includes(name)) return { ok: false, reason: `флаг вне списка: ${key}` };
        if (removal ? value !== null : !["string", "number", "boolean"].includes(typeof value)) {
          return { ok: false, reason: `недопустимое значение: ${key}` };
        }
        continue;
      }
      return { ok: false, reason: `путь вне списка: ${key}` };
    }
    return { ok: true };
  }

  if (op.kind === "addFatigue") {
    const n = Number(op.amount);
    if (!Number.isInteger(n) || n < 1 || n > RELAY_FATIGUE_MAX) return { ok: false, reason: "Усталость вне 1…20" };
    return { ok: true };
  }

  // Вдохновить Гнев: по сокету идёт ТОЛЬКО цель Ненависти, а сам предмет ГМ собирает из шаблона
  // компендиума (performTargetWrite) — клиент не может подложить в «Hatred» свои эффекты и Механику.
  if (op.kind === "inspireHatred") {
    if (!hasInspireWrath(ctx.initiator)) return { ok: false, reason: "у инициатора нет Inspire Wrath" };
    if (!validHatredTarget(op.target)) return { ok: false, reason: "недопустимая цель Ненависти" };
    return { ok: true };
  }

  return { ok: false, reason: `неизвестный вид: ${op.kind}` };
}

/** Виды цели, которые выбирает игрок (apps/target-choice.mjs::TARGET_CHOICE_KINDS) и поля записи цели. */
const HATRED_TARGET_KINDS = ["faction", "race", "feature", "patron", "all"];
const HATRED_TARGET_FIELDS = ["kind", "ref", "value", "name", "img"];

/** Цель Ненависти — плоский объект известных строковых полей разумной длины. */
export function validHatredTarget(t) {
  if (!t || typeof t !== "object" || Array.isArray(t)) return false;
  if (!HATRED_TARGET_KINDS.includes(t.kind)) return false;
  return Object.entries(t).every(([k, v]) => HATRED_TARGET_FIELDS.includes(k) && typeof v === "string" && v.length <= 200);
}

/** Шаблон Hatred из компендиума (описание и значок); недоступен — null, предмет будет минимальным. */
export async function hatredTemplate() {
  try {
    const doc = await globalThis.fromUuid?.(`Compendium.${NS}.talents.Item.${HATRED_PACK_ID}`);
    return doc?.toObject?.() ?? null;
  } catch { return null; }
}

/** Исполнить запись на клиенте, у которого есть право (ГМ или владелец цели). */
export async function performTargetWrite(target, op, initiator = null) {
  if (op.kind === "update") return target.update(op.data);
  if (op.kind === "addFatigue") {
    const { addFatigue } = await import("../sheets/tabs/conditions.mjs");
    return addFatigue(target, Number(op.amount));
  }
  if (op.kind === "inspireHatred") {
    const item = inspiredHatredData(op.target, { uuid: initiator?.uuid ?? "", name: initiator?.name ?? "" }, await hatredTemplate());
    return target.createEmbeddedDocuments("Item", [item]);
  }
  return null;
}

/**
 * Записать в актора-цель. Свой/ГМ — пишет сам, иначе просит активного ГМа.
 *
 * @param {Actor} target     цель записи
 * @param {object} op        { kind:"update", data } | { kind:"addFatigue", amount } | { kind:"inspireHatred", target }
 * @param {Actor} initiator  кто действует (владельца сверяет ГМ)
 * @returns {Promise<boolean>} false — записать некому (нет ГМ в игре): вызывающий прерывает приём
 */
export async function writeToTarget(target, op, initiator) {
  if (!target || !op) return false;
  // У живого документа isOwner — всегда булево; «=== false» (а не falsy) лишь
  // оставляет прежний путь голым подставным акторам без этого поля в тестах.
  if (game.user?.isGM || target.isOwner !== false) {
    await performTargetWrite(target, op, initiator);
    return true;
  }
  if (!game.users?.activeGM) {
    ui.notifications?.warn(`⚠️ ${target.name} не ваш, а Мастера нет в игре — записать на него действие некому.`);
    return false;
  }
  game.socket?.emit("system.warhammer-dbc", {
    action: TARGET_WRITE_ACTION, userId: game.user.id,
    initiatorUuid: initiator?.uuid ?? "", targetUuid: target.uuid, op
  });
  return true;
}

/** Сокет (ГМ): применить запись, присланную игроком. Сверяет всё, что нельзя доверять клиенту. */
export async function applyTargetWriteRelay(data, requester) {
  const initiator = data?.initiatorUuid ? await fromUuid(data.initiatorUuid).catch(() => null) : null;
  const target = data?.targetUuid ? await fromUuid(data.targetUuid).catch(() => null) : null;
  const targetActor = target?.actor ?? target;
  if (!initiator || !targetActor || typeof targetActor.update !== "function") return false;
  const initiatorOwned = !!requester?.isGM || !!initiator.testUserPermission?.(requester, "OWNER");
  const verdict = checkTargetWrite(data?.op, { initiatorOwned, initiator });
  if (!verdict.ok) {
    console.warn(`Warhammer DBC | ${TARGET_WRITE_ACTION} отклонён: ${verdict.reason}`, data?.op);
    return false;
  }
  await performTargetWrite(targetActor, data.op, initiator);
  return true;
}
