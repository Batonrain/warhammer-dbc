// module/combat/master-of-executions.mjs
// ════════════════════════════════════════════════════════════════════════
//  Мастер Казней (Sahara 1-54b9): Туманоходец, Туманный Прыжок, Спаситель Туманов, Взор Охотника.
//  Чистая часть — rules/master-of-executions.mjs. Целеустремлённый Охотник живёт в окнах броска
//  (sheets/actor-sheet.mjs, sheets/squad-sheet.mjs) и в стартовом расстройстве (sheets/tabs/disorders.mjs).
//
//  • Движение по Таланту (combat/talent-move.mjs) зовёт prepareMistwalker / prepareMistLeap ДО переноса токена
//    и plan.after() ПОСЛЕ него. Туманоходец: запрет в Терминаторской броне и Экзо-Костюме, «не дальше от достойной
//    цели» (достойными считаются выцеленные враги и отмеченная добыча), выход из Захвата. Туманный Прыжок: цель —
//    выцеленный токен, дальность — Unnatural Senses (P м, P км у отмеченной добычи), решение ГМа «достойна ли
//    добыча», перенос в базовый контакт и состояние Натиска (База «Натиск», ОД списываются на броске атаки).
//  • Спаситель Туманов: обмен местами с согласным или Беспомощным союзником — при телепорте Туманоходца и после
//    перехвата удара Fanatic (кнопка в карточке атаки). Чужой токен двигает ГМ-релей (gm-relay.mjs, saviorSwap).
//  • Взор Охотника: шёпот владельцу и ГМу со списком душ в зоне Unnatural Senses и их грубой силой по Inf.
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { tokenCenter } from "./facing.mjs";
import { pxPerMeter } from "./templates.mjs";
import { teleportToken } from "./token-teleport.mjs";
import { writeToTarget } from "./gm-relay.mjs";
import { markedPreyOf, markedPreyActive } from "./marked-prey.mjs";
import { trophyWorthyDecision } from "./trophy-kill.mjs";
import { chargeAttackGate } from "./free-shot.mjs";
import { markMoveDegreeThisTurn } from "./movement-actions.mjs";
import { displaceToken } from "../rules/movement-path.mjs";
import { MELEE_STANCES } from "../constants/combat.mjs";
import { FAST_MOVE_FLAG } from "../rules/hard-target.mjs";
import { actorInf } from "../rules/trophy-points.mjs";
import { knockbackWithinLimit } from "../rules/noise-marine.mjs";
import {
  hasMistSavior, hasMistwalker, hasHunterSight, wearsTerminatorOrExo, mistwalkerAnchorOk, unnaturalSensesRange,
  baseContactPoint, basesInContact, topLeftFor, swapNeedsConsent, swapLimitMeters, soulTier
} from "../rules/master-of-executions.mjs";

const NS = "warhammer-dbc";
const warn = text => globalThis.ui?.notifications?.warn(`⚠️ ${text}`);
const gridSize = () => globalThis.canvas?.grid?.size || globalThis.canvas?.scene?.grid?.size || 100;

const docOf = t => t?.document ?? t;
const targetedTokens = () => [...(globalThis.game?.user?.targets ?? [])].map(docOf).filter(Boolean);
const isDeceased = actor => !!actor?.getFlag?.(NS, "deceased");
/** Союзник — токен дружественного отношения или персонаж игрока. */
const isAlly = doc => doc?.disposition === 1 || !!doc?.actor?.hasPlayerOwner;
const sameToken = (a, b) => !!a && !!b && (a === b || (a.id && a.id === b.id));

/** Расстояние между центрами токенов в метрах. */
function distanceM(a, b) {
  const ca = tokenCenter(a), cb = tokenCenter(b);
  if (!ca || !cb) return null;
  return Math.hypot(ca.x - cb.x, ca.y - cb.y) / (pxPerMeter() || 1);
}

/** Токен отмеченной добычи на сцене (если отметка есть и токен найден). */
function markedPreyToken(actor, sceneTokens) {
  const mark = markedPreyOf(actor);
  if (!mark) return null;
  return [...(sceneTokens ?? [])].find(t => t.id && (t.uuid === mark.tokenUuid || t.actor?.uuid === mark.targetUuid)) ?? null;
}

/** Передвинуть токен союзника в центр — запись идёт через ГМ-релей (чужой токен). */
export async function sendAllyToSpot(actor, allyTokenDoc, center) {
  const tl = topLeftFor(allyTokenDoc, center, gridSize());
  return writeToTarget(allyTokenDoc.actor, { kind: "saviorSwap", tokenUuid: allyTokenDoc.uuid, x: tl.x, y: tl.y }, actor);
}

/** Исполнение записи saviorSwap на клиенте ГМа/владельца (combat/gm-relay.mjs::performTargetWrite). */
export async function performSaviorSwapWrite(target, op, initiator) {
  const tokenDoc = await globalThis.fromUuid?.(op.tokenUuid).catch(() => null);
  const grid = tokenDoc?.parent?.grid;
  const sameActor = tokenDoc?.actor && (tokenDoc.actor.uuid === target.uuid || tokenDoc.actor.id === target.id);
  if (!tokenDoc || !grid || !sameActor) return null;
  const mine = [...(tokenDoc.parent.tokens ?? [])].find(t => t.actor && (t.actor.uuid === initiator?.uuid || t.actor.id === initiator?.id));
  if (!mine) return null;
  // Двигать можно только согласного союзника (того же отношения или персонажа игрока) или Беспомощного.
  const friendly = tokenDoc.disposition === mine.disposition || !!tokenDoc.actor.hasPlayerOwner;
  if (!friendly && swapNeedsConsent(tokenDoc.actor)) return null;
  // Инициатор уже стоит на месте союзника (его перенос идёт первым) — иначе обмена не было.
  const size = Number(grid.size) || 100;
  if (Math.hypot((Number(mine.x) || 0) - (Number(tokenDoc.x) || 0), (Number(mine.y) || 0) - (Number(tokenDoc.y) || 0)) > size * 1.5) return null;
  if (!knockbackWithinLimit(tokenDoc, { x: op.x, y: op.y }, grid, swapLimitMeters(initiator))) return null;
  return displaceToken(tokenDoc, { x: Math.round(op.x), y: Math.round(op.y) }, { forced: true, walls: false, options: { animate: false } });
}

/** Вопрос про обмен местами: "swap" | "tele" | null (отмена). */
async function askSwap(ally, needConsent) {
  const consent = needConsent
    ? "Цель должна быть согласна — подтверждаете вы."
    : "Цель Беспомощна — согласие не нужно.";
  return foundry.applications.api.DialogV2.wait({
    window: { title: "Спаситель Туманов" },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<p style="margin:4px 6px;">Поменяться местами с <b>${esc(ally.name ?? ally.actor?.name ?? "союзником")}</b>? ${esc(consent)}</p>`,
    rejectClose: false,
    buttons: [
      { action: "swap", label: "Поменяться местами", default: true, callback: () => "swap" },
      { action: "tele", label: "Обычный телепорт", callback: () => "tele" },
      { action: "cancel", label: "Отмена", callback: () => null }
    ]
  });
}

/**
 * Туманоходец: проверки до переноса и дела после. Куда прыгать, решает вызывающий (диалог точки) — кроме обмена
 * местами, где точка — позиция союзника.
 * @returns {Promise<{ok:boolean, point?:object, checkPoint?:Function, after?:Function}>}
 */
export async function prepareMistwalker(actor, tokenDoc, { meters } = {}) {
  if (wearsTerminatorOrExo(actor)) {
    warn("Туманоходец: в Терминаторской броне или Экзо-Костюме телепортироваться нельзя.");
    return { ok: false };
  }
  const targets = targetedTokens().filter(t => !sameToken(t, tokenDoc));
  const allies = targets.filter(isAlly);
  const sceneTokens = tokenDoc?.parent?.tokens ?? [];
  const anchors = [...targets.filter(t => !isAlly(t)), markedPreyToken(actor, sceneTokens)].filter(Boolean);
  const anchorsUnique = anchors.filter((t, i) => anchors.findIndex(o => sameToken(o, t)) === i);
  const fromCenter = tokenCenter(tokenDoc);

  let swapAlly = null;
  if (hasMistSavior(actor) && allies.length) {
    const ally = allies.find(a => {
      const d = distanceM(tokenDoc, a);
      return d !== null && (meters?.unlimited || d <= (meters?.meters ?? 0));
    });
    if (ally) {
      const choice = await askSwap(ally, swapNeedsConsent(ally.actor));
      if (choice !== "swap" && choice !== "tele") return { ok: false };
      if (choice === "swap") swapAlly = ally;
    }
  }

  const before = anchorsUnique.map(t => distanceM(tokenDoc, t));
  return {
    ok: true,
    point: swapAlly ? tokenCenter(swapAlly) : undefined,
    checkPoint: point => {
      const after = anchorsUnique.map(t => {
        const c = tokenCenter(t);
        return Math.hypot(c.x - point.x, c.y - point.y) / (pxPerMeter() || 1);
      });
      return mistwalkerAnchorOk(before, after)
        ? null
        : "Туманоходец: нельзя заканчивать телепорт дальше от ближайшей достойной цели (выцеленной или отмеченной), чем начал.";
    },
    after: async res => {
      const lines = [];
      if (actor.system?.conditions?.grappling) {
        const { endGrapple } = await import("./grapple.mjs");
        await endGrapple(actor);
        lines.push("Вышел из Захвата.");
      }
      lines.push("Путы с себя снимите вручную — в системе их нет.");
      if (swapAlly) {
        if (!res.ok || res.stopped) lines.push(`Обмен с ${swapAlly.name ?? swapAlly.actor?.name}: путь перегородила стена — союзник остался на месте.`);
        else {
          const sent = await sendAllyToSpot(actor, swapAlly, fromCenter);
          lines.push(sent
            ? `Поменялся местами с ${swapAlly.name ?? swapAlly.actor?.name} (Спаситель Туманов).`
            : `Союзника переставить некому (нет ГМа) — поставьте ${swapAlly.name ?? swapAlly.actor?.name} на прежнее место вручную.`);
        }
      }
      return lines;
    }
  };
}

/**
 * Туманный Прыжок: цель, дальность, решение ГМа, Натиск — до переноса; состояние Натиска — после.
 * @returns {Promise<{ok:boolean, point?:object, skipTeleport?:boolean, after?:Function}>}
 */
export async function prepareMistLeap(actor, tokenDoc) {
  if (!hasMistwalker(actor)) { warn("Туманный Прыжок: нужен Трейт Mistwalker."); return { ok: false }; }
  if (wearsTerminatorOrExo(actor)) {
    warn("Туманный Прыжок: Трейт Mistwalker в Терминаторской броне или Экзо-Костюме не работает.");
    return { ok: false };
  }
  if (actor.system?.conditions?.prone) { warn("Повален — Натиск, а с ним Туманный Прыжок, недоступен. Сначала встаньте."); return { ok: false }; }
  const stance = MELEE_STANCES[actor.system?.meleeStance || "standard"];
  if (stance?.noCharge) { warn(`Туманный Прыжок: в Стойке «${stance.label}» Натиск недоступен.`); return { ok: false }; }
  const prey = targetedTokens().find(t => !sameToken(t, tokenDoc) && !isAlly(t));
  if (!prey?.actor) { warn("Туманный Прыжок: выцельте добычу (T) — токен на сцене."); return { ok: false }; }
  if (prey.parent !== tokenDoc.parent) { warn("Туманный Прыжок: добыча на другой сцене."); return { ok: false }; }
  if (isDeceased(prey.actor)) { warn("Туманный Прыжок: цель уже убита."); return { ok: false }; }

  const marked = markedPreyActive(actor, prey.actor);
  const range = unnaturalSensesRange(actor, { km: marked });
  const d = distanceM(tokenDoc, prey);
  if (d === null || d > range) {
    warn(`Туманный Прыжок: добыча дальше действия Unnatural Senses (${marked ? `${range / 1000} км` : `${range} м`}).`);
    return { ok: false };
  }
  if (!marked) {
    const decision = await trophyWorthyDecision({
      title: "Туманный Прыжок: достойна ли добыча?",
      intro: `${actor.name}: прыжок к добыче за 1 Очко Трофеев.`, victimName: prey.actor.name, askInf: false, okLabel: "Достойна — прыгнуть"
    });
    if (!decision) return { ok: false };
  }
  const gate = await chargeAttackGate(actor);
  if (!gate.ok) { warn(`${actor.name}: тест Подавления (Прикрывающий Огонь) провален — Натиск не удался.`); return { ok: false }; }

  const size = gridSize();
  const contact = baseContactPoint(tokenDoc, prey, size);
  const here = tokenCenter(tokenDoc);
  const alreadyIn = basesInContact(tokenDoc, prey, size);
  return {
    ok: true,
    point: alreadyIn ? here : { x: contact.x, y: contact.y },
    skipTeleport: alreadyIn,
    after: async res => {
      const lines = [];
      if (actor.system?.conditions?.grappling) {
        const { endGrapple } = await import("./grapple.mjs");
        await endGrapple(actor);
        lines.push("Вышел из Захвата.");
      }
      if (res?.stopped) {
        lines.push(`Путь к ${prey.actor.name} перегородила стена — до добычи не дошёл, Натиск не засчитан.`);
        return lines;
      }
      await actor.update({ "system.meleeBase": "charge", [`flags.${NS}.${FAST_MOVE_FLAG}`]: true });
      await markMoveDegreeThisTurn(actor, "full");
      return [
        ...lines,
        `В базовом контакте с ${prey.actor.name}${alreadyIn ? " (уже стоял вплотную)" : ""}. Прыжок считается Натиском: База «Натиск» выбрана, 2 ОД спишутся на броске атаки.`
      ];
    }
  };
}

/**
 * Спаситель Туманов после перехвата удара Fanatic: Fanatic и цель атаки меняются местами (телепортом).
 * @param {Actor} actor Fanatic-носитель
 * @param {string} targetTokenUuid токен цели атаки
 */
export async function fanaticSavior(actor, targetTokenUuid) {
  if (!hasMistSavior(actor)) { warn("Нужен Талант Mist Savior."); return false; }
  const mine = actor.getActiveTokens?.(false, true)?.[0];
  const target = targetTokenUuid ? await globalThis.fromUuid?.(targetTokenUuid).catch(() => null) : null;
  if (!mine?.parent || !target?.actor || target.parent !== mine.parent) { warn("Спаситель Туманов: не найден токен или цель."); return false; }
  const limit = swapLimitMeters(actor);
  const d = distanceM(mine, target);
  if (d === null || d > limit) { warn(`Спаситель Туманов: цель дальше ${limit} м.`); return false; }
  if (swapNeedsConsent(target.actor)) {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Спаситель Туманов" }, classes: ["warhammer-dbc", "wh-holo"], rejectClose: false,
      content: `<p style="margin:4px 6px;">${esc(target.actor.name)} согласен(на) поменяться местами с ${esc(actor.name)}? (Беспомощной цели согласие не нужно.)</p>`
    });
    if (!ok) return false;
  }
  const from = tokenCenter(mine);
  const res = await teleportToken(mine, tokenCenter(target), { maxMeters: limit + 1 });
  if (!res.ok || res.stopped) { warn("Спаситель Туманов: перенос не удался (стена или отказ ядра)."); return false; }
  const sent = await sendAllyToSpot(actor, target, from);
  await postTestCard(actor, {
    icon: rollIcon("bolt", "#9ad7ff"), title: `Спаситель Туманов — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">${esc(actor.name)} принимает удар на себя и меняется местами с ${esc(target.actor.name)}${sent ? "" : " (союзника переставить некому — поставьте его вручную)"}.</div>`]
  }, { sound: false });
  return true;
}

/** Зона и список душ Взора Охотника — чистая часть для тестов и карточки. */
export function huntersSightRows(actor, tokenDoc) {
  const range = unnaturalSensesRange(actor);
  const sceneTokens = [...(tokenDoc?.parent?.tokens ?? [])];
  const markedTok = markedPreyToken(actor, sceneTokens);
  const rows = [];
  for (const t of sceneTokens) {
    if (!t.actor || t.hidden || sameToken(t, tokenDoc) || t.actor.id === actor.id || isDeceased(t.actor)) continue;
    const d = distanceM(tokenDoc, t);
    const marked = !!markedTok && sameToken(markedTok, t);
    if (d === null || (d > range && !marked)) continue;
    rows.push({ name: t.name || t.actor.name, distance: d, tier: soulTier(actorInf(t.actor)), marked });
  }
  return { range, rows: rows.sort((a, b) => a.distance - b.distance) };
}

/** Взор Охотника: шёпот владельцу и ГМу — души в зоне Unnatural Senses и их сила. */
export async function useHuntersSight(actor) {
  if (!hasHunterSight(actor)) return warn("Нужна Черта Hunter Sight.");
  const tokenDoc = actor.getActiveTokens?.(false, true)?.[0];
  if (!tokenDoc?.parent) return warn("Взор Охотника: нужен токен на сцене.");
  const { range, rows } = huntersSightRows(actor, tokenDoc);
  const users = [...(game.users ?? [])].filter(u => u.isGM || actor.testUserPermission?.(u, "OWNER")).map(u => u.id);
  await postTestCard(actor, {
    icon: rollIcon("target", "#c9a24a"), title: `Взор Охотника — ${esc(actor.name)} (до ${Math.round(range)} м)`,
    lines: [
      ...(rows.length
        ? rows.map(r => `<div class="roll-threshold">${esc(r.name)} — ${esc(r.tier.label)} (Inf ${r.tier.inf}), ${Math.round(r.distance)} м${r.marked ? ", отмеченная добыча" : ""}</div>`)
        : ["<div class=\"roll-threshold\"><i>Душ в зоне нет.</i></div>"]),
      `<div class="roll-threshold" style="font-size:.85em;opacity:.8;">Сила: слабая — Inf ниже 30, заметная — 30–59, могучая — 60–79, великая — 80+. Достойна ли душа трофея, решает ГМ.</div>`
    ]
  }, { whisper: users, sound: false });
}
