// module/apps/infamy-success.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ТРАТА ОЧКА БЕСЧЕСТИЯ «УСПЕХ» ИЗ МЕНЮ КАРТОЧКИ ТЕСТА (решение владельца 27.10.2026).
//
//  Книга (корбук 438): «Успех» — +1 Успех к УСПЕШНОМУ тесту (Тзинч на Cor 20+ — 1d5 Успехов). Раньше
//  трата жила только на полосе Очков и писала в чат текст — Успех к карточке теста никто не дописывал.
//  Теперь тем же способом, что «Переброс» и «+10» (hooks.mjs, правый клик по карточке), пункт меню
//  «Успех» тратит Очко и дописывает Успехи в ЭТУ карточку:
//    • атака (flags.attack) — переигрывается тем же кубом с opts.extraDeg (combat/attack.mjs), новая карточка;
//    • прочий тест — новая карточка с теми же кубом и порогом и степенями + Успехи.
//  С Сфокусированным Гневом рукопашная атака по Ненавистной цели получает ещё +1 Успех
//  (rules/focused-wrath.mjs). Раз на карточку (combat/card-once.mjs, ключ infamySuccessAdded).
// ════════════════════════════════════════════════════════════════════════════

import { successBonusOutcome } from "../rules/fate-bonus.mjs";
import { spendInfamyAbility } from "./infamy-points.mjs";
import { runCardOnce, cardOnceUsed, markCardOnce } from "../combat/card-once.mjs";
import { focusedWrathOnAttack } from "../combat/focused-wrath.mjs";
import { postTestCard, testCardHtml, outcomeHtml, rollStatLine } from "../helpers/test-card.mjs";
import { _degWord } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { attackIsMelee } from "../combat/weapon-profiles.mjs";

const NS = "warhammer-dbc";
export const INFAMY_SUCCESS_FLAG = "infamySuccessAdded";

/**
 * Порог из текста карточки («Порог … <b>45</b>»). У карточки «+10» строка «Порог: <b>база</b> → <b>поднятый</b>» —
 * берём поднятый (тот, по которому тест реально решён).
 */
function thresholdFromContent(message) {
  const m = String(message?.content ?? "").match(/Порог.*?<b>(\d+)<\/b>(?:\s*→\s*<b>(\d+)<\/b>)?/);
  return m ? parseInt(m[2] ?? m[1]) : null;
}

/**
 * Можно ли дописать Успех в эту карточку: тест успешен и Успех ещё не дописывали.
 * @returns {?{kind:"attack"|"test", rv:number, threshold:number, deg:number}}
 */
export function successTarget(message) {
  if (!message || cardOnceUsed(message, INFAMY_SUCCESS_FLAG)) return null;
  const flags = message.flags?.[NS] ?? {};
  const atk = flags.attack;
  if (atk) {
    // Карточка, с которой атаку уже переиграли (Переброс / Успех), устарела: Успех к ней дал бы лишнюю копию урона.
    if (cardOnceUsed(message, "attackRerolled")) return null;
    const o = successBonusOutcome({ rv: atk.rv, threshold: atk.threshold, extra: 0 });
    // Попадание — по самой карточке (flags.attack.hit); куб с порогом — только для старых карточек без поля.
    const hit = typeof atk.hit === "boolean" ? atk.hit : !!o;
    return hit ? { kind: "attack", rv: Number(atk.rv), threshold: Number(atk.threshold), deg: o?.degrees ?? 1 } : null;
  }
  // Карточка «Успех за Очко Бесчестия»: следующий Успех складывается с уже добавленными.
  const prev = flags.successCard;
  if (prev && Number.isFinite(Number(prev.deg))) {
    return { kind: "test", rv: Number(prev.rv), threshold: Number(prev.threshold), deg: Number(prev.deg) };
  }
  const rv = message.rolls?.[0]?.total;
  const threshold = thresholdFromContent(message);
  if (rv == null || threshold == null) return null;
  const o = successBonusOutcome({ rv, threshold, extra: 0 });
  return o ? { kind: "test", rv, threshold, deg: o.degrees } : null;
}

/**
 * Потратить Очко «Успех» и дописать Успехи в карточку.
 * @param {Actor} actor      кто тратит
 * @param {ChatMessage} message  карточка теста
 * @returns {Promise<boolean>} true — Успех дописан
 */
export async function spendSuccessOnCard(actor, message) {
  const target = successTarget(message);
  if (!target) { ui.notifications?.warn("К этой карточке Успех не дописать: тест провален, не распознан или Успех уже добавлен."); return false; }
  return runCardOnce(message, INFAMY_SUCCESS_FLAG, async () => {
    const out = {};
    if (!await spendInfamyAbility(actor, "success", out)) return false;
    let extra = out.successBonus ?? 1;
    let wrath = false;
    const atk = message.flags?.[NS]?.attack ?? null;
    if (atk) {
      const atkActor = game.actors?.get(atk.actorId) ?? actor;
      const item = atkActor?.items?.get(atk.itemId);
      const melee = item ? attackIsMelee(item.system, { forceMelee: atk.opts?.forceMelee, profile: atk.opts?.profile }) : true;
      // Сфокусированный Гнев: «Успех: еще +1 Успех» — рукопашная атака по Ненавистной цели.
      if (await focusedWrathOnAttack(atkActor, atk, melee)) { extra += 1; wrath = true; }
      if (item) {
        const { _executeAttackRoll } = await import("../combat/attack.mjs");
        // Старая карточка переиграна: Переброс/Успех с неё больше не предлагаются.
        await markCardOnce(message, "attackRerolled");
        await _executeAttackRoll(atkActor, item, atk.charKey, atk.threshold, atk.rofMode, atk.aimTarget,
          { ...(atk.opts || {}), forcedRoll: atk.rv, skipAmmo: true, extraDeg: (Number(atk.opts?.extraDeg) || 0) + extra });
        ui.notifications?.info(`✦ ${actor.name} тратит Очко Бесчестия: +${extra} Успех${wrath ? " (Сфокусированный Гнев)" : ""} к атаке.`);
        return true;
      }
    }
    const deg = target.deg + extra;
    const skillTest = message.flags?.[NS]?.skillTest ?? null;
    await postTestCard(actor, testCardHtml({
      icon: rollIcon("chart", "#ffd37f"), title: "Успех за Очко Бесчестия",
      lines: [
        `<div class="roll-damage-meta">+${extra} Успех${wrath ? " (Сфокусированный Гнев)" : ""} к успешному тесту</div>`,
        rollStatLine({ threshold: target.threshold, rv: target.rv })
      ],
      outcome: outcomeHtml(true, `Успех — ${deg} ${_degWord(deg)}`)
    }), { rolls: message.rolls ?? [], speaker: message.speaker, sound: false,
      flags: { [NS]: { successCard: { rv: target.rv, threshold: target.threshold, deg },
        ...(skillTest ? { skillTest: { ...skillTest, success: true, deg } } : {}) } } });
    return true;
  }, "К этой карточке Успех уже добавлен.");
}
