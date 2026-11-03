// module/combat/noise-marine.mjs
// ════════════════════════════════════════════════════════════════════════
//  Шумовой Десантник (Элитный архетип, глава 3, Sahara 1-54b9) — Foundry-
//  обвязка к чистой логике rules/noise-marine.mjs. Грозный Вопль и Сладкая
//  Какофония — отдельно, combat/dread-wail.mjs.
//
//   • Боль Это Наслаждение — hook в конвейер урона (damage.mjs), конец Хода
//     носителя и конец боя (hooks.mjs).
//   • Песнь Отчаянья — тумблер на вкладке БОЙ; флаг гаснет с началом Хода
//     носителя (rules/turn-flags.mjs); оружие читает combat/attack.mjs.
//   • Стена Диссонанса — кнопка на вкладке БОЙ: Очко Бесчестия + полудействие,
//     тест S−30 у врагов в радиусе, провал — Ничком и отброс.
//   • Спой Мне! — диалог пытки (Interrogate+0 против W+0).
//   • Дистиллированная Мука — диалог «пыль → доза наркотика».
//
//  «Звуковое оружие» — по имени (combat/dread-wail.mjs::isSonicWeapon), формального
//  класса в системе нет.
// ════════════════════════════════════════════════════════════════════════

import { hasAbility } from "../rules/ability-by-key.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { resolveOpposed } from "../rules/test-kind.mjs";
import { rollD100WithReroll } from "../rules/test-kind-widget.mjs";
import { resolveTest } from "../rules/resolve-test.mjs";
import { sizeOf } from "../rules/predicates.mjs";
import { tokensWithinRadius } from "../rules/aoe-target.mjs";
import {
  PAIN_IS_PLEASURE_FLAG, PAIN_IS_PLEASURE_MAX_STACKS,
  hasPainIsPleasure, painIsPleasureBonus, painIsPleasureNext, painIsPleasureAtTurnEnd,
  wallOfDiscordGeometry, wallImmuneBySize, wallPushDestination, knockbackWithinLimit
} from "../rules/noise-marine.mjs";
import { actorHasInfamyPoint, actorInfamyPath, spendFromInfamyPool, changeActorInfamy } from "../apps/infamy-points.mjs";
import { fatigueChangeFields, conditionApplyFields } from "../sheets/tabs/conditions.mjs";
import { applyWoundLoss } from "../rules/wounds.mjs";
import { combatOfActor } from "./actor-combat.mjs";
import { isOwnTurn, spendActionPoints } from "./action-economy.mjs";
import { isSonicWeapon } from "./dread-wail.mjs";
import { startWithdrawal, endWithdrawal } from "./drug-withdrawal.mjs";
import { readWithdrawalEntries, isAddictedEntry, drugKey } from "../rules/drug-withdrawal.mjs";
import { writeToTarget } from "./gm-relay.mjs";

const NS = "warhammer-dbc";

export const DIRGE_FLAG = "dirgeOfDespair";
export const DIRGE_CONCUSSIVE = 3;
export const SING_FOR_ME_DAMAGE = "2d10";

/** Платит одно Очко Бесчестия общей точкой пула (учитывает временные Очки и Пустоту Парии). */
async function spendInfamyPoint(actor, what) {
  if (!actorHasInfamyPoint(actor)) {
    ui.notifications?.warn(`Нет Очка Бесчестия — ${what} не активирован.`);
    return false;
  }
  const path = actorInfamyPath(actor);
  const spend = await spendFromInfamyPool(actor, 1, path);
  if (!spend) return false;
  if (spend.poolSpent) await actor.update({ [path]: spend.poolValue });
  return true;
}

// ── Боль Это Наслаждение ────────────────────────────────────────────────

/**
 * Получен непоглощённый урон (damage.mjs, после списания Ран): −1 Усталости и +10 на все тесты (макс. +30)
 * до конца следующего Хода. Вне боя Ходов нет — только снятие Усталости.
 * @returns {Promise<string>} строка для карточки урона или ""
 */
export async function painIsPleasureOnDamage(actor, netDamage) {
  if (!actor || !(Number(netDamage) > 0) || !hasPainIsPleasure(actor)) return "";
  const bits = [];
  const fatigue = Number(actor.system?.fatigue?.value) || 0;
  if (fatigue > 0) {
    await actor.update(fatigueChangeFields(actor, fatigue - 1).fields);
    bits.push("−1 Усталости");
  }
  const combat = combatOfActor(actor);
  if (combat) {
    const prev = actor.getFlag?.(NS, PAIN_IS_PLEASURE_FLAG);
    const next = painIsPleasureNext(prev?.combatId === combat.id ? prev : null, { ownTurn: isOwnTurn(actor), combatId: combat.id });
    await actor.setFlag(NS, PAIN_IS_PLEASURE_FLAG, next);
    const bonus = painIsPleasureBonus(next);
    bits.push(`+${bonus} на все тесты до конца следующего Хода${next.stacks >= PAIN_IS_PLEASURE_MAX_STACKS ? " (предел)" : ""}`);
  } else {
    bits.push("вне боя срок «до конца Хода» считать не от чего — бонус к тестам не накладывается");
  }
  return `<div class="dmg-tb-note">${rollIcon("spark", "#e85ad6")} Боль Это Наслаждение: ${esc(bits.join("; "))}.</div>`;
}

/** Конец Хода носителя (hooks.mjs, updateCombat): счётчик убывает, на нуле бонус снимается. */
export async function painIsPleasureTurnEnd(actor) {
  const flag = actor?.getFlag?.(NS, PAIN_IS_PLEASURE_FLAG);
  if (!flag) return;
  const next = painIsPleasureAtTurnEnd(flag);
  if (next) await actor.setFlag(NS, PAIN_IS_PLEASURE_FLAG, next);
  else await actor.unsetFlag(NS, PAIN_IS_PLEASURE_FLAG);
}

/** Конец боя (hooks.mjs, deleteCombat): бонус «до конца Хода» не переживает бой. */
export async function clearPainIsPleasure(combat) {
  for (const combatant of combat?.combatants ?? []) {
    const actor = combatant.actor;
    if (actor?.getFlag?.(NS, PAIN_IS_PLEASURE_FLAG)) await actor.unsetFlag(NS, PAIN_IS_PLEASURE_FLAG);
  }
}

// ── Песнь Отчаянья ──────────────────────────────────────────────────────

export const hasDirgeOfDespair = actor => hasAbility(actor, "ability.dirgeOfDespair", "Dirge of Despair", "talent");

/** Включена ли Песнь Отчаянья («до начала следующего Хода», флаг гасит turn-flags.mjs). */
export const dirgeActive = actor => !!actor?.getFlag?.(NS, DIRGE_FLAG);

/** Действует ли Песнь на это оружие: включена и оружие звуковое. */
export function dirgeAffects(actor, item) {
  return dirgeActive(actor) && isSonicWeapon(item);
}

/** Включить/выключить Песнь Отчаянья (кнопка вкладки БОЙ). */
export async function toggleDirgeOfDespair(actor) {
  const on = dirgeActive(actor);
  if (on) await actor.unsetFlag(NS, DIRGE_FLAG);
  else await actor.setFlag(NS, DIRGE_FLAG, true);
  await postTestCard(actor, {
    icon: rollIcon("bolt", "#c98bff"), title: `Песнь Отчаянья — ${esc(actor.name)}`,
    lines: [on
      ? `<div class="roll-threshold">Песнь стихла: звуковое оружие снова бьёт как обычно.</div>`
      : `<div class="roll-threshold">До начала следующего Хода всё звуковое оружие получает <b>Concussive (${DIRGE_CONCUSSIVE})</b>, а его урон падает до <b>0</b>.</div>`]
  }, { sound: false });
}

// ── Стена Диссонанса ────────────────────────────────────────────────────

export const hasWallOfDiscord = actor => hasAbility(actor, "ability.wallOfDiscord", "Wall of Discord", "talent");

/** Враги токена по расположению: у союзного носителя — враждебные токены, у враждебного — союзные, у нейтрального — все. */
function enemyTokens(casterToken, radius) {
  const mine = Number(casterToken?.disposition) || 0;
  return tokensWithinRadius(casterToken, radius).filter(t => {
    if (!mine) return true;
    const theirs = Number(t.disposition) || 0;
    return theirs === -mine;
  });
}

/** Ничком цели (если иммунитет к Состоянию не мешает) — через ГМ-релей для чужого актора. */
async function knockProne(targetActor, caster) {
  const fields = conditionApplyFields("prone", null, targetActor);
  if (fields["system.conditions.prone"] !== true) return false;
  return writeToTarget(targetActor, { kind: "update", data: { "system.conditions.prone": true } }, caster);
}

/**
 * Стена Диссонанса: Очко Бесчестия + полудействие; все враги в радиусе Cor.b×2 м проходят S−30, провал —
 * Ничком и отброс на Cor.b×3 м. Размер 2+ (3+ при Cor 66+) не страдает; летящие/парящие проваливают сами.
 */
export async function applyWallOfDiscord(actor, casterToken) {
  if (!casterToken?.parent) return ui.notifications?.warn("Стене Диссонанса нужен токен на сцене.");
  const geom = wallOfDiscordGeometry(actor);
  if (geom.radius <= 0) return ui.notifications?.warn("Cor.b = 0 — стена не набирает силы.");
  if (!await spendActionPoints(actor, 1, { physical: false })) return;
  if (!await spendInfamyPoint(actor, "Стена Диссонанса")) return;
  const { IN_FLIGHT_ALTITUDES } = await import("./movement-actions.mjs");
  const isFlying = a => IN_FLIGHT_ALTITUDES.includes(a?.system?.movement?.altitude);

  const corValue = Number(actor.system?.corruption?.value) || 0;
  const grid = casterToken.parent.grid;
  const lines = [];
  for (const tokenDoc of enemyTokens(casterToken, geom.radius)) {
    const target = tokenDoc.actor;
    if (!target) continue;
    if (wallImmuneBySize(sizeOf(target), corValue)) {
      lines.push(`${esc(target.name)}: Размер ${sizeOf(target)} — стена бессильна`);
      continue;
    }
    let verdict;
    if (isFlying(target)) {
      verdict = "нет опоры (в полёте) — автоматический провал";
    } else {
      const mods = collectTestMods(target, { kind: "skill", char: "s" });
      const threshold = (Number(target.system?.characteristics?.s?.total) || 0) - 30 + mods.total;
      const { rv } = await rollD100WithReroll(null);
      if (testOutcome(rv, threshold).success) { lines.push(`${esc(target.name)}: устоял(а) (${rv} vs ${threshold})`); continue; }
      verdict = `провал (${rv} vs ${threshold})`;
    }
    const prone = await knockProne(target, actor);
    const dest = wallPushDestination(casterToken, tokenDoc, grid, geom.knockback);
    const pushed = await writeToTarget(target, { kind: "wallPush", tokenUuid: tokenDoc.uuid, x: dest.x, y: dest.y }, actor);
    lines.push(`${esc(target.name)}: ${verdict} — ${prone ? "Ничком" : "Ничком не наложено"}, ${pushed ? `отброшен(а) на ${geom.knockback} м` : "отброс записать некому (нет ГМа)"}`);
  }
  await postTestCard(actor, {
    icon: rollIcon("bolt", "#c98bff"), title: `Стена Диссонанса — ${esc(actor.name)} (радиус ${geom.radius} м)`,
    lines: [
      `<div class="roll-threshold">Тест S−30; провал — Ничком и отброс на ${geom.knockback} м. Размер ${corValue >= 66 ? 3 : 2}+ неуязвим, летящие и парящие проваливают сами. Пси-чутьё засекает как сверхъестественное.</div>`,
      ...(lines.length ? lines.map(l => `<div>${l}</div>`) : ["<div><i>Врагов в радиусе нет</i></div>"])
    ]
  }, { sound: false });
}

// ── Спой Мне! ───────────────────────────────────────────────────────────

export const hasSingForMe = actor => hasAbility(actor, "ability.singForMe", "Sing For Me!", "talent");

/** Посвящён ли актор Слаанеш (Покровительство Слаанеш даёт флаг иммунитета к Грозному Воплю). */
export const worshipsSlaanesh = actor => hasRuleFlag(actor, "dreadWail.immune");

/** Поклонники Слаанеш на сцене, кроме палача и жертвы — кандидаты в наблюдатели. */
export function slaaneshOnlookers(torturer, victim) {
  const scene = globalThis.canvas?.scene;
  const out = new Map();
  for (const t of scene?.tokens?.contents ?? []) {
    const a = t.actor;
    if (!a || a.id === torturer.id || a.id === victim?.id || out.has(a.id)) continue;
    if (worshipsSlaanesh(a)) out.set(a.id, a);
  }
  return [...out.values()];
}

function sideMods(resolved) {
  const list = [...resolved.autoMods, ...resolved.mods.filter(m => !m.askOnly)];
  const total = list.reduce((sum, m) => sum + (Number(m.value) || 0), 0);
  const parts = list.map(m => `${m.label} ${Number(m.value) >= 0 ? "+" : ""}${m.value}`);
  const reroll = resolved.rerolls.find(r => r.who !== "target");
  return { total, parts, reroll: reroll ? { mode: reroll.mode, rolls: reroll.rolls, label: reroll.label } : null };
}

/**
 * Провести «Спой Мне!»: Interrogate+0 пытающего против W+0 жертвы. Жертва получает 2d10 непоглощаемого R урона
 * в любом случае; при Успехе палач и выбранные наблюдатели-поклонники Слаанеш восстанавливают 1 Очко Бесчестия
 * и снимают всю Усталость.
 */
export async function resolveSingForMe(torturer, victim, { onlookers = [], torturerMod = 0, victimMod = 0 } = {}) {
  const { interrogateIntTotal } = await import("../apps/skillful-torture.mjs");
  const tMods = sideMods(resolveTest({ actor: torturer, kind: "skill", skill: "interrogate", char: "int", morale: true, targetActor: victim }));
  const vMods = sideMods(resolveTest({ actor: victim, kind: "skill", char: "wp", morale: true, interrogation: true, targetActor: torturer }));
  const tThr = interrogateIntTotal(torturer) + tMods.total + (Number(torturerMod) || 0);
  const vThr = (Number(victim.system?.characteristics?.wp?.total) || 0) + vMods.total + (Number(victimMod) || 0);
  const { rv: tRv, rerollNote: tNote } = await rollD100WithReroll(tMods.reroll);
  const { rv: vRv, rerollNote: vNote } = await rollD100WithReroll(vMods.reroll);
  const mine = { ...testOutcome(tRv, tThr), threshold: tThr };
  const theirs = { ...testOutcome(vRv, vThr), threshold: vThr };
  const { winner } = resolveOpposed(mine, theirs);
  const success = winner === "mine";

  const dmgRoll = await new Roll(SING_FOR_ME_DAMAGE).evaluate();
  const hurt = await writeToTarget(victim, { kind: "singForMeDamage", amount: dmgRoll.total }, torturer);

  const lines = [
    `<div>${rollIcon("target", "#e85ad6")}${esc(torturer.name)}: <b>${tRv}</b> vs ${tThr} ${mine.success ? "(успех)" : "(провал)"}</div>`,
    tNote,
    `<div>${rollIcon("target", "#8a8a8a")}${esc(victim.name)}: <b>${vRv}</b> vs ${vThr} ${theirs.success ? "(успех)" : "(провал)"}</div>`,
    vNote,
    `<div>${rollIcon("skull", "#ff6b6b")}${esc(victim.name)} получает <b>${dmgRoll.total}</b> (${SING_FOR_ME_DAMAGE}) непоглощаемого R урона${hurt ? "" : " — записать некому (нет ГМа), спишите вручную"}.</div>`
  ];
  if (success) {
    const boon = [torturer, ...onlookers];
    for (const a of boon) {
      const ok = await writeToTarget(a, { kind: "singForMeBoon" }, torturer);
      lines.push(`<div>${esc(a.name)}: +1 Очко Бесчестия, вся Усталость снята${ok ? "" : " — записать некому (нет ГМа)"}</div>`);
    }
  } else {
    lines.push(`<div><b>Жертва выстояла</b> — наслаждения не вышло.</div>`);
  }
  await postTestCard(torturer, { title: `Спой Мне! — ${success ? "успех" : "провал"}`, lines: lines.filter(Boolean), },
    { sound: false, rolls: [dmgRoll] });
  return { success, damage: dmgRoll.total };
}

/** Диалог «Спой Мне!»: жертва — таргет (T), наблюдатели — галочками. */
export async function showSingForMeDialog(torturer) {
  const { isTortureImmune } = await import("../apps/torture.mjs");
  const { interrogateIntTotal } = await import("../apps/skillful-torture.mjs");
  const victim = [...(game.user?.targets ?? [])][0]?.actor ?? null;
  if (!victim) return ui.notifications.warn("Наведите таргет (T) на жертву.");
  if (isTortureImmune(victim)) return ui.notifications.warn(`«${victim.name}» не чувствует боли — пытка на неё не действует.`);
  const helpless = !!victim.system?.conditions?.helpless;
  const onlookers = slaaneshOnlookers(torturer, victim);
  const content = `
    <div class="wh-wizard-form" style="padding:6px;">
      <div class="roll-threshold">Пытающий: ${esc(torturer.name)} — Допрос(Int)+0: <b>${interrogateIntTotal(torturer)}</b> (без Черт и модификаторов)</div>
      <div class="roll-threshold">Жертва: ${esc(victim.name)} — Воля: <b>${Number(victim.system?.characteristics?.wp?.total) || 0}</b></div>
      <div class="atk-dlg-row"><label>Мод. пытающего:</label><input type="number" name="torturerMod" value="0" style="width:60px;"/></div>
      <div class="atk-dlg-row"><label>Мод. жертвы:</label><input type="number" name="victimMod" value="0" style="width:60px;"/></div>
      ${helpless ? "" : `<div class="atk-dlg-row"><label title="Жертва не отмечена Беспомощной: отметьте, что она сдалась или беспомощна в плену"><input type="checkbox" name="surrendered"/> Жертва беспомощна или сдалась</label></div>`}
      ${onlookers.length ? `<div class="roll-threshold">Наблюдатели-поклонники Слаанеш (15 минут пытки):</div>${onlookers.map(a =>
        `<div class="atk-dlg-row"><label><input type="checkbox" name="onlooker" value="${esc(a.id)}"/> ${esc(a.name)}</label></div>`).join("")}` : ""}
      <div style="font-size:0.85em;color:#8a8a8a;margin-top:6px;">15 минут пытки. При успехе палач и отмеченные наблюдатели получают 1 Очко Бесчестия и снимают всю Усталость; жертва получает 2d10 непоглощаемого R урона при любом исходе.</div>
    </div>`;
  return foundry.applications.api.DialogV2.wait({
    window: { title: "Спой Мне!" }, classes: ["wh-attack-dialog", "warhammer-dbc"], position: { width: 420 }, content, rejectClose: false,
    buttons: [
      {
        action: "go", label: "Петь", icon: "fas fa-music", default: true,
        callback: async (event, button) => {
          const form = button.form;
          if (!helpless && !form.querySelector("[name=surrendered]")?.checked) {
            return ui.notifications.warn("«Спой Мне!» требует беспомощной или сдавшейся жертвы — отметьте галочку.");
          }
          const picked = new Set([...form.querySelectorAll("[name=onlooker]:checked")].map(i => i.value));
          await resolveSingForMe(torturer, victim, {
            onlookers: onlookers.filter(a => picked.has(a.id)),
            torturerMod: parseInt(form.querySelector("[name=torturerMod]")?.value) || 0,
            victimMod: parseInt(form.querySelector("[name=victimMod]")?.value) || 0
          });
        }
      },
      { action: "cancel", label: "Отмена" }
    ]
  }).then(res => res === false ? null : res);
}

/** Исполнение записей в чужого актора на клиенте ГМа/владельца (combat/gm-relay.mjs::performTargetWrite). */
export async function performNoiseMarineWrite(target, op, initiator) {
  if (op.kind === "singForMeDamage") return applyWoundLoss(target, Number(op.amount));
  if (op.kind === "singForMeBoon") {
    await changeActorInfamy(target, 1);
    const fatigue = Number(target.system?.fatigue?.value) || 0;
    if (fatigue > 0) await target.update(fatigueChangeFields(target, 0).fields);
    return null;
  }
  if (op.kind === "wallPush") {
    const tokenDoc = await globalThis.fromUuid?.(op.tokenUuid).catch(() => null);
    const grid = tokenDoc?.parent?.grid;
    const sameActor = tokenDoc?.actor && (tokenDoc.actor.uuid === target.uuid || tokenDoc.actor.id === target.id);
    if (!tokenDoc || !grid || !sameActor) return null;
    const limit = wallOfDiscordGeometry(initiator).knockback;
    if (!knockbackWithinLimit(tokenDoc, { x: op.x, y: op.y }, grid, limit)) return null;
    return tokenDoc.update({ x: Math.round(op.x), y: Math.round(op.y) }, { animate: false });
  }
  return null;
}

// ── Нектар Богов ────────────────────────────────────────────────────────

export const hasNectarOfTheGods = actor => hasAbility(actor, "ability.nectarOfTheGods", "Nectar Of The Gods", "talent");

/**
 * Нектар Богов: «При принятии любого наркотика он сразу получает зависимость от него и теряет зависимость от
 * всех других наркотиков.» Зовёт sheets/tabs/drugs.mjs::weeklyDoseCheck на каждую принятую дозу. Только
 * наркотики (drugCategory «narcotic»): Медицина, Яды и Эликсиры не наркотики. Теста Зависимости нет — она не
 * бросается, а наступает сама. Пост-эффекты не наступают вовсе — sheets/tabs/drugs.mjs::triggerAfterEffect.
 * @returns {Promise<string>} строка для карточки или ""
 */
export async function nectarOfTheGodsOnDose(actor, item) {
  if (!actor || item?.system?.drugCategory !== "narcotic" || !hasNectarOfTheGods(actor)) return "";
  const key = drugKey(item);
  const lost = [];
  for (const [k, entry] of Object.entries(readWithdrawalEntries(actor))) {
    if (k !== key && isAddictedEntry(entry)) { lost.push(entry?.name || k); await endWithdrawal(actor, k); }
  }
  await startWithdrawal(actor, item);
  await actor.update(conditionApplyFields("addicted", null, actor));
  const gone = lost.length ? `; зависимость от ${lost.join(", ")} утрачена` : "";
  const line = `Нектар Богов: сразу зависим от «${item.name}»${gone}.`;
  await postTestCard(actor, { icon: rollIcon("spark", "#e85ad6"), title: `Нектар Богов — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">${esc(line)}</div>`] }, { sound: false });
  return line;
}
