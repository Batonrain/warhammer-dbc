// module/combat/rage-behavior.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Foundry-обвязка поведения Ярости (правила и книжный текст —
//  rules/rage-behavior.mjs; Sahara focused-wrath-20-bs, п.2):
//
//    • rageAvoidanceRefusal / rageSocialRefusal — отказ карточкой чата, когда
//      Ярость закрывает Избегание или социальный тест (Реакция не тратится,
//      бросок не идёт);
//    • processRageTurnStart — начало Хода персонажа в Ярости: тест W+0 на
//      сохранение поддержания психосил и напоминание «двигаться к ближайшему
//      видимому противнику» (hooks.mjs::updateCombat);
//    • attemptRageExit / rerollRageExit — кнопка «Выйти из Ярости»: тест W+0 с
//      бонусами книги, переброс Холодной Ярости, метки состояния;
//    • stampRageCombatEnd — бой кончился, а Ярость осталась: с этого момента
//      считаются «Ходы после боя» (+10 на тест выхода за каждый).
//
//  Принуждения нет: токен сам не двигается и не атакует — книга говорит
//  «обязан», а исполнять обязанность за игрока система не станет. Напоминание
//  и запреты — всё, что она делает.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, rollStatLine } from "../helpers/test-card.mjs";
import { autoTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { hasColdFury } from "../rules/predicates.mjs";
import { isInRage } from "../rules/rage.mjs";
import { tokenRelationship, tokenDocEdgeDistance } from "../regions/auras.mjs";
import { isTokenInSight } from "../rules/vision-target.mjs";
import { dispelAllSustained } from "./psychic-sustain.mjs";
import { isEncounterActive } from "./action-economy.mjs";
import { markFrenzyExited } from "./frenzy.mjs";
import {
  RAGE_EXIT_TRIED_FLAG, RAGE_EXIT_FAILED_FLAG, RAGE_AFTER_COMBAT_FLAG,
  rageAvoidanceVerdict, rageSocialAutoFail, rageSustainTestNeeded,
  rageExitTriedStamp, rageExitAttemptAllowed, turnsAfterCombat, rageExitParts,
  hasRageExitAutoSuccess, hasBattleRage, pickRageTarget, rageTurnReminderText
} from "../rules/rage-behavior.mjs";

const NS = "warhammer-dbc";

const refusalCard = (actor, title, reason, icon = "sword") => postTestCard(actor, {
  icon: rollIcon(icon), title: `${title} — ${esc(actor.name)}`, actorUuid: actor.uuid,
  outcome: `<span class="roll-failure">${rollIcon("ban", "#ff6b6b")}${reason}</span>`
});

// ── Отказы ────────────────────────────────────────────────────────────────────

/**
 * Прочие Избегания (кроме Уклонения/Парирования, их закрывает
 * combat/full-attack-lock.mjs::avoidanceVerdict): Парирование психосилы, Сжатие,
 * Вираж, Шагоход, Акробатика против шаблона. true — отказ уже показан, дальше не идти.
 * @param {"dodge"|"parry"|"evade"} kind
 */
export async function rageAvoidanceRefusal(actor, kind, what) {
  const verdict = rageAvoidanceVerdict(actor, kind);
  if (!verdict.blocked) return false;
  await refusalCard(actor, what, verdict.reason);
  return true;
}

/**
 * Социальный тест в Ярости проваливается сам, без броска. true — карточка показана,
 * тест не проводить.
 * @param {{skill?:string|null, char?:string|null, label?:string}} test
 */
export async function rageSocialRefusal(actor, { skill = null, char = null, label = "" } = {}) {
  if (!rageSocialAutoFail(actor, { skill, char })) return false;
  await postTestCard(actor, {
    icon: "😡", title: `${esc(label || "Социальный тест")} — ${esc(actor.name)}`, actorUuid: actor.uuid,
    outcome: `<span class="roll-failure">Ярость: нечленораздельные вопли — автопровал</span>`
  }, { sound: false });
  return true;
}

// ── Метки состояния ───────────────────────────────────────────────────────────

/** Патч actor.update, снимающий метки Ярости (выход из неё, любой путь). */
export function clearRageStatePatch(actor) {
  const upd = {};
  for (const key of [RAGE_EXIT_FAILED_FLAG, RAGE_AFTER_COMBAT_FLAG]) {
    if (actor?.getFlag?.(NS, key) !== undefined) upd[`flags.${NS}.-=${key}`] = null;
  }
  return upd;
}

/**
 * Бой кончился: у каждого, кто остался в Ярости, ставится момент конца боя —
 * от него считаются «Ходы после боя» (по 6 секунд игрового времени).
 * @param {Combat} combat
 */
export async function stampRageCombatEnd(combat) {
  const seen = new Set();
  for (const combatant of combat?.combatants ?? []) {
    const actor = combatant?.actor;
    if (!actor || seen.has(actor.uuid ?? actor.id) || !isInRage(actor)) continue;
    seen.add(actor.uuid ?? actor.id);
    await actor.setFlag(NS, RAGE_AFTER_COMBAT_FLAG, { at: game.time?.worldTime ?? 0, lost: false });
  }
}

// ── Начало Хода ───────────────────────────────────────────────────────────────

/** Видимые токены сцены с отношением к этому токену (диспозиция) и дистанцией «край–край». */
export function rageSceneCandidates(tokenDoc) {
  const scene = tokenDoc?.parent;
  if (!scene?.tokens) return [];
  const grid = scene.grid;
  const out = [];
  for (const t of scene.tokens.contents ?? [...scene.tokens]) {
    if (t.id === tokenDoc.id || t.hidden || !t.actor) continue;
    if (t.combatant?.isDefeated) continue;
    if (!isTokenInSight(tokenDoc, t, grid)) continue;
    const c = t.actor.system?.conditions ?? {};
    out.push({
      name: t.name,
      distance: tokenDocEdgeDistance(tokenDoc, t, grid),
      relation: tokenRelationship(tokenDoc.disposition, t.disposition),
      helpless: !!(c.helpless || c.unconscious)
    });
  }
  return out;
}

/** Тест W+0 на сохранение поддержания психосил (начало Хода в Ярости). */
export async function rageSustainTest(actor) {
  const wp = Number(actor.system?.characteristics?.wp?.total) || 0;
  // Сюда не попадает носитель Холодной Ярости (rules/rage-behavior.mjs::rageSustainTestNeeded) — тест ему не нужен.
  const mods = autoTestMods(actor, { kind: "skill", char: "wp" });
  const threshold = wp + mods.total;
  const roll = await new Roll("1d100").evaluate();
  const { success, deg } = testOutcome(roll.total, threshold);
  let outcome;
  if (success) {
    outcome = `<span class="roll-success">Успех — поддержание сохраняется</span>`;
  } else {
    const names = await dispelAllSustained(actor);
    outcome = `<span class="roll-failure">Провал (${deg}) — поддержание прекращается: ${names.length ? esc(names.join(", ")) : "—"}</span>`;
  }
  await postTestCard(actor, {
    icon: "😡", title: `Ярость: поддержание психосил — ${esc(actor.name)}`, actorUuid: actor.uuid,
    threshold: rollStatLine({ label: "W", base: wp, parts: mods.parts, threshold, rv: roll.total }),
    outcome
  }, { rolls: [roll] });
  return success;
}

/**
 * Начало Хода (hooks.mjs::updateCombat): персонаж в Ярости — тест W+0 на
 * поддержание психосил и напоминание в чат.
 * @param {Actor} actor
 * @param {TokenDocument|null} tokenDoc
 */
export async function processRageTurnStart(actor, tokenDoc = null) {
  if (!isInRage(actor) || actor.system?.conditions?.unconscious) return;
  if (rageSustainTestNeeded(actor)) await rageSustainTest(actor);
  const failedExit = !!actor.getFlag?.(NS, RAGE_EXIT_FAILED_FLAG);
  const target = pickRageTarget(rageSceneCandidates(tokenDoc), { failedExit });
  await postTestCard(actor, {
    icon: "😡", title: `Ярость — ${esc(actor.name)}`, actorUuid: actor.uuid,
    outcome: `<span class="roll-failure">${esc(rageTurnReminderText({ target, failedExit }))}</span>`
  }, { sound: false });
}

// ── Выход из Ярости ───────────────────────────────────────────────────────────

/** Диалог теста выхода. null — отмена. */
export function askRageExit(actor, { turns = 0, lost = false } = {}) {
  const battleRage = hasBattleRage(actor);
  const content = `<form class="rage-exit-form" style="display:flex;flex-direction:column;gap:6px;padding:4px 6px;">
    <label title="Книга: +10 на тест выхода за каждый Ход после боя. Считается от конца боя по игровому времени (6 с = Ход); поправьте, если нужно.">
      Ходов после боя: <input type="number" name="turns" min="0" step="1" value="${Number(turns) || 0}" style="width:60px;"/></label>
    <label title="Союзники или пленники пытались напасть на персонажа — бонус за конец боя потерян (их Избегания его не снимают).">
      <input type="checkbox" name="lost" ${lost ? "checked" : ""}/> Бонус за конец боя потерян</label>
    ${battleRage ? `<label title="Боевой Гнев: с позволения ГМа +30, когда Ярость ведёт в почти верную гибель.">
      <input type="checkbox" name="battleRage"/> Боевой Гнев: +30 (с позволения ГМа)</label>` : ""}
  </form>`;
  return foundry.applications.api.DialogV2.wait({
    window: { title: `Выход из Ярости — ${actor.name}` },
    classes: ["warhammer-dbc", "wh-holo"],
    content,
    rejectClose: false,
    buttons: [
      { action: "roll", label: "Тест W+0", icon: "fas fa-dice-d20", default: true,
        callback: (event, button) => {
          const f = button.form.elements;
          return { turns: Number(f.turns?.value) || 0, lost: !!f.lost?.checked, battleRage: !!f.battleRage?.checked };
        } },
      { action: "cancel", label: "Отмена", callback: () => null }
    ]
  }).then(r => (r && typeof r === "object") ? r : null);
}

/** Успешный выход: Ярость снята, метки погашены, повторный вход в этом бою закрыт (combat/frenzy.mjs). */
async function leaveRage(actor) {
  await actor.update({ "system.inRage": false, ...clearRageStatePatch(actor) });
  await markFrenzyExited(actor);
}

/** Бросок и карточка попытки (общие для первой попытки и переброса Холодной Ярости). */
async function rollExit(actor, { base, parts, threshold, rerollOf = false }) {
  const roll = await new Roll("1d100").evaluate();
  const { success, deg } = testOutcome(roll.total, threshold);
  if (success) await leaveRage(actor);
  else await actor.setFlag(NS, RAGE_EXIT_FAILED_FLAG, true);
  const canReroll = !success && !rerollOf && hasColdFury(actor);
  await postTestCard(actor, {
    icon: "😡", title: `Выход из Ярости${rerollOf ? " (переброс)" : ""} — ${esc(actor.name)}`, actorUuid: actor.uuid,
    threshold: rollStatLine({ label: "W", base, parts, threshold, rv: roll.total }),
    outcome: success
      ? `<span class="roll-success">Успех — выходит из Ярости</span>`
      : `<span class="roll-failure">Провал (${deg}) — Ярость не отпускает: обязан атаковать других `
        + `(приоритет: сдавшиеся, беспомощные и обезоруженные враги; затем союзные NPC и игроки)</span>`,
    sections: canReroll ? [`<div class="roll-defense-section wh-owner-only" data-actor-uuid="${actor.uuid}">
      <div class="roll-defense-btns"><button type="button" class="wh-rage-exit-reroll-btn"
        title="Холодная Ярость: неудачную попытку выйти из Ярости можно перебросить (раз на карточку).">
        🎲 Перебросить (Холодная Ярость)</button></div></div>`] : []
  }, {
    rolls: [roll],
    flags: { [NS]: { rageExit: { actorUuid: actor.uuid, base, parts, threshold, success } } }
  });
  return success;
}

/**
 * Кнопка «Выйти из Ярости»: тест W+0 (текущая W актора — с +10 самой Ярости, тест
 * проходит ВНУТРИ неё) + «Ходы после боя» ×10 + Боевой Гнев (+30 с позволения ГМа).
 * Одна попытка в Ход. Модуль Агрессии выходит без броска.
 *
 * @param {Actor} actor
 * @param {{choice?: {turns:number, lost:boolean, battleRage:boolean}}} [opts]
 *   choice — готовый выбор диалога (тесты и автоматика); без него диалог показывается
 * @returns {Promise<boolean|null>} true — вышел, false — провал, null — не состоялось
 */
export async function attemptRageExit(actor, { choice = null } = {}) {
  if (!actor) return null;
  if (!isInRage(actor)) { ui.notifications?.info?.(`${actor.name}: не в Ярости.`); return null; }
  const combatId = isEncounterActive() ? (game.combat?.id ?? "") : "";
  const worldTime = game.time?.worldTime ?? 0;
  if (!rageExitAttemptAllowed(actor.getFlag?.(NS, RAGE_EXIT_TRIED_FLAG), { combatId, worldTime })) {
    ui.notifications?.warn?.(`${actor.name}: не более одной попытки выйти из Ярости в Ход${combatId ? "" : " (вне боя Ход — 6 с игрового времени: прокрутите время в «Имперской дате»)"}.`);
    return null;
  }

  if (hasRageExitAutoSuccess(actor)) {
    await leaveRage(actor);
    await postTestCard(actor, {
      icon: "😡", title: `Выход из Ярости — ${esc(actor.name)}`, actorUuid: actor.uuid,
      outcome: `<span class="roll-success">Модуль Агрессии: автоматический Успех — выходит из Ярости</span>`
    }, { sound: false });
    return true;
  }

  const after = actor.getFlag?.(NS, RAGE_AFTER_COMBAT_FLAG);
  // «Ходы после боя» — только вне боя: в новом бою метка прошлого боя бонуса не даёт.
  const picked = choice ?? await askRageExit(actor, {
    turns: combatId ? 0 : turnsAfterCombat(after, worldTime), lost: !!after?.lost
  });
  if (!picked) return null;
  // Окно висело открытым: за это время вторая попытка (двойной клик, лист и HUD) могла успеть раньше.
  if (!rageExitAttemptAllowed(actor.getFlag?.(NS, RAGE_EXIT_TRIED_FLAG), { combatId, worldTime })) {
    ui.notifications?.warn?.(`${actor.name}: попытка выйти из Ярости в этом Ходу уже была.`);
    return null;
  }

  // Попытка занята ещё до броска: двойной клик не даст вторую.
  await actor.setFlag(NS, RAGE_EXIT_TRIED_FLAG, rageExitTriedStamp({ combatId, worldTime }));
  if (picked.lost && !after?.lost) await actor.setFlag(NS, RAGE_AFTER_COMBAT_FLAG, { at: after?.at ?? null, lost: true });

  const wp = Number(actor.system?.characteristics?.wp?.total) || 0;
  const mods = autoTestMods(actor, { kind: "skill", char: "wp" });
  const extra = rageExitParts({ turns: picked.turns, bonusLost: picked.lost, battleRage: picked.battleRage, actor });
  const threshold = wp + mods.total + extra.reduce((s, p) => s + p.value, 0);
  const parts = [...mods.parts, ...extra.map(p => `${p.label} +${p.value}`)];
  return rollExit(actor, { base: wp, parts, threshold });
}

/**
 * Холодная Ярость: перебросить неудачную попытку выйти из Ярости (кнопка на
 * карточке, раз на карточку — card-once.mjs). Тот же Порог, новая попытка в Ходу
 * не открывается.
 * @param {ChatMessage} message  карточка неудачной попытки
 * @returns {Promise<boolean>} состоялся ли переброс
 */
export async function rerollRageExit(message) {
  const ctx = message?.flags?.[NS]?.rageExit;
  if (!ctx) return false;
  const actor = await fromUuid(ctx.actorUuid).catch(() => null);
  if (!actor) { ui.notifications?.warn?.("Персонаж карточки не найден."); return false; }
  if (!actor.isOwner) { ui.notifications?.warn?.("Перебросить может владелец персонажа (или ГМ)."); return false; }
  if (!hasColdFury(actor)) { ui.notifications?.warn?.("Переброс попытки выйти — Талант Холодная Ярость (Cold Fury)."); return false; }
  if (!isInRage(actor)) { ui.notifications?.info?.(`${actor.name}: уже не в Ярости.`); return false; }
  await rollExit(actor, { base: ctx.base, parts: ctx.parts ?? [], threshold: ctx.threshold, rerollOf: true });
  return true;
}
