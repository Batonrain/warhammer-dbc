// module/combat/crit-talents-actions.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Действия Талантов Стойкости над Критическим Эффектом (глава 3): Последний
//  Рывок, Не Умирать, Боль — Лишь Иллюзия. Разметка кнопок и гашение —
//  combat/crit-talents.mjs; клики разбирает hooks.mjs (renderChatMessageHTML).
//
//  Каждое действие — раз на карточку (combat/card-once.mjs): двойной клик не тратит
//  Очко и не бросает тест дважды, чужую карточку помечает ГМ.
//
//  ── Последний Рывок: допущение владельца о способе «отложить» ─────────────────
//  Эффекты Критического Эффекта у нас — кнопки (пилюли Состояний, урон в
//  Характеристики, «Выронить», смерть): сами по себе ничего не применены. «Отложить»
//  читается так: при успехе T+0 кнопки гаснут, а их описания кладутся флагом на
//  носителя; в конце ЕГО Хода (hooks.mjs, updateCombat) в чат падает напоминание с
//  теми же живыми кнопками и общей «Применить отложенные эффекты». Общая кнопка
//  применяет пилюли, урон в Характеристики и «Выронить»; смерть и тест «смерть от
//  шока» остаются отдельными кнопками — их нажимают осознанно. Вне боя Хода нет —
//  напоминание выкладывается сразу.
// ════════════════════════════════════════════════════════════════════════════

import { getCriticalEffect } from "../../critical-tables.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, testCardHtml, outcomeHtml } from "../helpers/test-card.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";
import { CAST_OUT_OF_DEATH_CAPABILITY } from "../rules/cast-out-of-death.mjs";
import { LOCATION_TO_SIDE } from "../rules/useless-limbs.mjs";
import {
  hasResilienceTalent, painIllusionLevel, FINAL_PUSH_CHAR, PAIN_ILLUSION_CHAR, FINAL_PUSH_FLAG
} from "../rules/resilience-talents.mjs";
import { actorHasInfamyPoint, actorInfamyPath, spendFromInfamyPool } from "../apps/infamy-points.mjs";
import { runCardOnce, markCardOnce } from "./card-once.mjs";
import { rollResilienceTest } from "./resilience-test.mjs";
import { combatOfActor } from "./actor-combat.mjs";
import { parseCritEffectPills, critPillsHtml, deathButtonHtml, dropButtonHtml, shockDeathButtonHtml,
         applyCritEffectPill } from "./crit-effect-parser.mjs";
import { critCharDamageHtml, applyCharDamageButton } from "./char-damage-button.mjs";
import { sweetSufferingHtml } from "./sweet-suffering.mjs";
import { dropFromHand } from "./limb-loss.mjs";
import { dimCritEffects, collectCritEffects, CRIT_TALENT_FLAGS as F } from "./crit-talents.mjs";

const NS = "warhammer-dbc";

// ── Не Умирать ──────────────────────────────────────────────────────────────

/**
 * Не Умирать: тратит Очко Бесчестия — все эффекты Критического Эффекта гаснут, урон остаётся.
 * @returns {Promise<boolean>} true — Очко потрачено
 */
export async function useNeverDie(actor, { message, block } = {}) {
  if (!hasResilienceTalent(actor, "neverDie")) {
    ui.notifications?.warn(`${actor?.name ?? "?"}: нет Таланта «Не Умирать».`);
    return false;
  }
  return runCardOnce(message, F.neverDieUsed, async () => {
    if (!actorHasInfamyPoint(actor)) {
      ui.notifications?.warn(`${actor.name}: нет Очков Бесчестия.`);
      return false;
    }
    const path = actorInfamyPath(actor);
    const spend = await spendFromInfamyPool(actor, 1, path);
    if (!spend) return false;   // Пустота Парии и т. п. — трата не состоялась
    if (spend.poolSpent) await actor.update({ [path]: spend.poolValue });
    const n = dimCritEffects(block, "Проигнорировано: Не Умирать");
    await postTestCard(actor, testCardHtml({
      icon: rollIcon("spark", "#ff6b6b"), title: `Не Умирать — ${esc(actor.name)}`,
      lines: [`<div class="roll-threshold">Потрачено Очко Бесчестия${spend.tempSpent ? " (из временного запаса)" : ""}. Все эффекты Критического Эффекта проигнорированы${n ? ` (кнопок погашено: ${n})` : ""}. Урон остаётся — Раны уже списаны.</div>`],
      outcome: outcomeHtml(true, "Критический Эффект проигнорирован")
    }), { sound: false, ignoreRollMode: true });
    return true;
  }, "Не Умирать с этой карточки уже использовано.");
}

// ── Боль — Лишь Иллюзия ─────────────────────────────────────────────────────

/** Блок пересчитанного Критического Эффекта — те же кнопки, что у исходного, но без кнопок Талантов. */
function reducedBlockHtml(actor, { text, level, newLevel, hitLocation, netDamage }) {
  const side = LOCATION_TO_SIDE[hitLocation] || "";
  const pills = parseCritEffectPills(text);
  const cannotDie = hasRuleFlag(actor, CAST_OUT_OF_DEATH_CAPABILITY);
  const drop = dropButtonHtml(text, actor.uuid, side);
  return `<div class="dmg-critical-block">
    <b>Критический эффект ослаблен</b> · уровень ${level} → ${newLevel} · ${esc(hitLocation)}
    <div class="roll-crit-effect">${text}</div>
    ${critPillsHtml(pills, actor.uuid, netDamage, { side })}
    ${critCharDamageHtml(text, actor.uuid)}
    ${drop}
    ${sweetSufferingHtml(actor, { pills, hasCharDamage: /урона\s+в\s+[A-Za-z]/u.test(text), hasDrop: !!drop })}
    ${cannotDie ? "" : deathButtonHtml(text, actor.uuid, "")}
    ${shockDeathButtonHtml(text, actor.uuid, { blocked: cannotDie })}
  </div>`;
}

/**
 * Боль — Лишь Иллюзия: тест W+0, уровень Критического Эффекта падает на число Успехов
 * (не ниже 1). Строка таблицы пересчитывается, новый эффект выкладывается отдельной
 * карточкой с живыми кнопками; исходные кнопки гаснут.
 * @param {{message:ChatMessage, block:Element, level:number, damageType:string, hitLocation:string, netDamage:number}} o
 */
export async function usePainIllusion(actor, { message, block, level, damageType, hitLocation, netDamage = 0 } = {}) {
  if (!hasResilienceTalent(actor, "painIsAnIllusion")) {
    ui.notifications?.warn(`${actor?.name ?? "?"}: нет Таланта «Боль — Лишь Иллюзия».`);
    return false;
  }
  return runCardOnce(message, "painTried", async () => {
    const test = await rollResilienceTest(actor, PAIN_ILLUSION_CHAR, {
      title: "Боль — Лишь Иллюзия", charLabel: "W",
      successText: "Успех ({deg}) — эффект слабеет", failText: "Провал — Критический Эффект остаётся"
    });
    if (!test.success) return true;   // попытка израсходована
    const newLevel = painIllusionLevel(level, test.deg);
    const text = newLevel < level ? getCriticalEffect(damageType, hitLocation, newLevel) : null;
    if (!text) {
      await postTestCard(actor, testCardHtml({
        icon: rollIcon("shield", "#8fd0ff"), title: `Боль — Лишь Иллюзия — ${esc(actor.name)}`,
        lines: [`<div class="roll-threshold">Эффект уже на минимальном уровне (${level}) — ослаблять нечего.</div>`]
      }), { sound: false });
      return true;
    }
    await markCardOnce(message, F.painIllusionUsed);
    dimCritEffects(block, "Эффект ослаблен: Боль — Лишь Иллюзия");
    await postTestCard(actor, testCardHtml({
      icon: rollIcon("shield", "#8fd0ff"), title: `Боль — Лишь Иллюзия — ${esc(actor.name)}`,
      lines: [`<div class="roll-threshold">Уровень Критического Эффекта: <b>${level}</b> → <b>${newLevel}</b> (−${test.deg} Усп., не ниже 1). Исходные кнопки погашены — применяйте эффект ниже.</div>`],
      sections: [reducedBlockHtml(actor, { text, level, newLevel, hitLocation, netDamage })]
    }), { sound: false });
    return true;
  }, "Боль — Лишь Иллюзия с этой карточки уже испытана.", { persist: false });
}

// ── Последний Рывок ─────────────────────────────────────────────────────────

/** Кнопки отложенных эффектов + общая «применить» — карточка конца Хода (или сразу, вне боя). */
function deferredCardSection(actor, items) {
  const buttons = items.map(i => i.html).join("");
  return `<div class="wh-crit-pills wh-final-push-deferred">${buttons}</div>
    <div class="wh-crit-pills"><button type="button" class="wh-final-push-apply-btn" data-actor-uuid="${esc(actor.uuid)}"
      title="Применить пилюли Состояний, урон в Характеристики и «Выронить»; смерть — отдельными кнопками">
      ${rollIcon("run", "#ffb84d")} Применить отложенные эффекты</button></div>`;
}

async function postDeferredCard(actor, items, { immediate }) {
  await postTestCard(actor, testCardHtml({
    icon: rollIcon("run", "#ffb84d"), title: `Последний Рывок — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">${immediate
      ? "Вне боя Хода нет — отложенные Критические Эффекты можно применить сразу."
      : "Ход закончен — время применить отложенные Критические Эффекты."}</div>`],
    sections: [deferredCardSection(actor, items)]
  }), { sound: false, ignoreRollMode: true });
}

/**
 * Последний Рывок: тест T+0; при успехе эффекты карточки откладываются до конца Хода носителя.
 * @returns {Promise<boolean>} true — тест брошен (попытка израсходована)
 */
export async function useFinalPush(actor, { message, block } = {}) {
  if (!hasResilienceTalent(actor, "finalPush")) {
    ui.notifications?.warn(`${actor?.name ?? "?"}: нет Таланта «Последний Рывок».`);
    return false;
  }
  return runCardOnce(message, "finalPushTried", async () => {
    const test = await rollResilienceTest(actor, FINAL_PUSH_CHAR, {
      title: "Последний Рывок", charLabel: "T",
      successText: "Успех — Критические Эффекты отложены до конца Хода",
      failText: "Провал — Критические Эффекты применяются сразу"
    });
    if (!test.success) return true;
    const items = collectCritEffects(block);
    await markCardOnce(message, F.finalPushUsed);
    dimCritEffects(block, "Отложено до конца Хода: Последний Рывок");
    if (!items.length) return true;
    if (!combatOfActor(actor)) {
      await postDeferredCard(actor, items, { immediate: true });
      return true;
    }
    const prev = actor.getFlag?.(NS, FINAL_PUSH_FLAG)?.items ?? [];
    await actor.setFlag(NS, FINAL_PUSH_FLAG, { items: [...prev, ...items] });
    return true;
  }, "Последний Рывок с этой карточки уже испытан.", { persist: false });
}

/** Конец Хода носителя (hooks.mjs, updateCombat): отложенные эффекты — напоминанием в чат. */
export async function finalPushTurnEnd(actor) {
  const flag = actor?.getFlag?.(NS, FINAL_PUSH_FLAG);
  if (!flag?.items?.length) return false;
  await actor.unsetFlag(NS, FINAL_PUSH_FLAG);
  await postDeferredCard(actor, flag.items, { immediate: false });
  return true;
}

/** Конец боя: отложенное, не дожившее до конца Хода носителя, не пропадает молча — выкладывается напоминанием. */
export async function finalPushCombatEnd(combat) {
  for (const combatant of combat?.combatants ?? []) {
    if (combatant.actor) await finalPushTurnEnd(combatant.actor);
  }
}

/**
 * «Применить отложенные эффекты»: пилюли, урон в Характеристики и «Выронить» — по очереди.
 * Смерть и тест «смерть от шока» не трогает.
 * @param {Array<{kind:string, data:object}>} items описания (как их снял collectCritEffects)
 * @returns {Promise<number>} сколько применено
 */
export async function applyDeferredEffects(actor, items) {
  let n = 0;
  for (const { kind, data } of items ?? []) {
    if (kind === "apply") {
      await applyCritEffectPill(actor, {
        key: data.condKey, formula: data.formula || null, permanent: data.permanent === "1",
        sourceDamage: data.sourceDamage != null && data.sourceDamage !== "" ? Number(data.sourceDamage) : null,
        side: data.side || "", healMod: Number(data.healMod) || 0
      });
    } else if (kind === "charDmg") {
      await applyCharDamageButton(actor, {
        keys: String(data.keys || "").split(",").filter(Boolean), formula: data.formula || "",
        amount: data.amount === "" || data.amount == null ? null : Number(data.amount),
        permanent: data.permanent === "1", source: data.source || ""
      });
    } else if (kind === "drop") {
      await dropFromHand(actor, data.side, { reason: "крит-эффект (отложен Последним Рывком)" });
    } else continue;
    n++;
  }
  return n;
}
