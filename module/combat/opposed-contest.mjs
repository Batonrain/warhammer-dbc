// module/combat/opposed-contest.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ВСТРЕЧНЫЙ ТЕСТ ПРИЁМА: вторая сторона бросает сама (wdbc-x1nz.2.73).
//
//  Все Состязания (Финт, Давление, Повалить, Напролом, Обезоружить, Захват и
//  действия Борьбы) книга пишет встречным тестом: «Athletics(S)+0 vs
//  Athletics(S)+0», «WS vs WS». До этой правки techniques.mjs::
//  _showContestDialog бросал ОДИН кубик — за инициатора — и считал приём
//  удавшимся при его собственном Успехе: цель не сопротивлялась вовсе.
//
//  Теперь (решение владельца 23.09.2026, вариант «Б»): инициатор бросает, в
//  его карточке появляется кнопка «Сопротивляться» — по одной на каждого
//  противника. Её жмёт владелец противника (или ГМ): бросок его Навыка/
//  Характеристики, сравнение rules/test-kind.mjs::resolveOpposed (та же
//  арифметика, что у прочих встречных тестов системы).
//
//  ── Где применяется эффект ──────────────────────────────────────────────
//  Эффект приёма (onSuccess: Финт ставит метку, Заломить спрашивает «урон
//  и/или Усталость») — ВЫБОР инициатора и замыкание, которое сериализовать
//  нельзя. Поэтому он живёт в памяти клиента инициатора (PENDING ниже) и
//  исполняется там же: сопротивлявшийся клиент шлёт по сокету «contestResolved»
//  пользователю, бросавшему приём. Права и диалоги — ровно те же, что были до
//  правки, когда onSuccess звался сразу после броска. Перезагрузил страницу
//  между броском и ответом — ожидание пропало, карточка честно об этом скажет.
// ════════════════════════════════════════════════════════════════════════════

import { CHARACTERISTICS } from "../constants/characteristics.mjs";
import { SKILLS_DEF } from "../constants/skills.mjs";
import { esc, _degWord } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { resolveOpposed } from "../rules/test-kind.mjs";
import { pickReroll } from "../rules/reroll-pick.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";

const SOCKET = "system.warhammer-dbc";

/** contestId → { techDef, actorUuid, result, done:Set<opponentUuid> } — только у клиента инициатора. */
const PENDING = new Map();

/** Для тестов: сбросить ожидания. */
export function _resetPendingContests() { PENDING.clear(); }

// ── Порог стороны ───────────────────────────────────────────────────────────

/**
 * Чем бросает сторона: {skill} — Навык (Ранг и мод Навыка внутри
 * system.skills.*.total: нетренированный −20, +10/+20/+30), {char} —
 * голая Характеристика (WS vs WS у Финта).
 */
export function sideValue(actor, { skill = "", char = "" } = {}) {
  if (skill) {
    const sk = actor?.system?.skills?.[skill];
    if (sk?.total != null) return Number(sk.total) || 0;
    const c = SKILLS_DEF[skill]?.char;
    // Навыка на листе нет вовсе (NPC-заглушка) — нетренированный: −20.
    return (Number(actor?.system?.characteristics?.[c]?.total) || 0) - 20;
  }
  return Number(actor?.system?.characteristics?.[char]?.total) || 0;
}

/** «Athletics(S)» / «WS» — подпись стороны, как пишет книга. */
export function sideLabel({ skill = "", char = "" } = {}) {
  if (skill) {
    const def = SKILLS_DEF[skill];
    const c = CHARACTERISTICS[def?.char]?.abbr ?? def?.char ?? "";
    return `${def?.en ?? skill}(${c})`;
  }
  return CHARACTERISTICS[char]?.abbr ?? char;
}

/** Контекст для rules/roll-mods.mjs::collectTestMods. */
export function sideContext(side) {
  const char = side.skill ? SKILLS_DEF[side.skill]?.char : side.char;
  return side.skill ? { kind: "skill", char, skill: side.skill } : { kind: "skill", char };
}

/**
 * Чем сопротивляется противник. techDef.resist — список вариантов; без
 * него — тем же, чем бросал инициатор (WS vs WS, Athletics vs Athletics).
 */
export function resistOptions(techDef, initiatorSide) {
  const list = Array.isArray(techDef?.resist) && techDef.resist.length ? techDef.resist : [initiatorSide];
  return list.map(s => ({ skill: s.skill || "", char: s.char || "", mod: Number(s.mod) || 0 }));
}

/** Противники приёма: techDef.opponents(actor) или все цели под прицелом. */
export function contestOpponents(actor, techDef) {
  if (typeof techDef?.opponents === "function") return (techDef.opponents(actor) || []).filter(Boolean);
  return [...(game.user?.targets ?? [])].map(t => t.actor).filter(a => a && a !== actor);
}

// ── Инициатор: регистрация и кнопки ─────────────────────────────────────────

/**
 * Запомнить бросок инициатора и собрать кнопки «Сопротивляться».
 * @param {Actor} actor
 * @param {object} techDef
 * @param {{success:boolean, deg:number, threshold:number, rv:number, side:object}} result
 * @param {Actor[]} opponents
 * @returns {string} HTML секции для карточки инициатора
 */
export function registerContest(actor, techDef, result, opponents) {
  const id = foundry.utils.randomID();
  PENDING.set(id, { techDef, actorUuid: actor.uuid, result, done: new Set() });
  const opts = resistOptions(techDef, result.side);
  const how = opts.map(sideLabel).join(" или ");
  const buttons = opponents.map(o => `
    <button type="button" class="wh-contest-resist-btn"
      data-contest-id="${id}" data-user-id="${game.user.id}"
      data-actor-uuid="${actor.uuid}" data-opponent-uuid="${o.uuid}"
      data-label="${esc(techDef.label)}"
      data-success="${result.success ? 1 : 0}" data-deg="${result.deg}" data-threshold="${result.threshold}"
      data-resist='${esc(JSON.stringify(opts))}'
      data-resist-mods='${esc(JSON.stringify(result.resistMods?.[o.uuid] ?? []))}'
      data-rolls="${result.resistRolls?.[o.uuid] ?? 1}">
      ${rollIcon("shield")}${esc(o.name)}: Сопротивляться (${esc(how)})
    </button>`).join("");
  return `<div class="roll-defense-section">
    <div class="roll-threshold" style="font-size:0.85em;">Встречный тест: ${opponents.length > 1 ? "каждый противник бросает" : "противник бросает"} ${esc(how)}. Приём удаётся, только если бросок выше выигран.</div>
    ${buttons}
  </div>`;
}

// ── Противник: бросок сопротивления ─────────────────────────────────────────

async function _pickResist(opponent, opts) {
  if (opts.length < 2) return opts[0];
  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: `Сопротивление — ${opponent.name}` },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<p style="margin:4px 6px;">Чем сопротивляться?</p>`,
    rejectClose: false,
    buttons: opts.map((o, i) => ({
      action: String(i), label: `${sideLabel(o)} (${sideValue(opponent, o) + o.mod})`, default: i === 0,
      callback: () => i
    }))
  });
  return choice == null ? null : opts[choice];
}

/**
 * Клик «Сопротивляться»: бросок противника, исход, доставка эффекта
 * инициатору. Жмёт владелец противника или ГМ.
 */
export async function resolveResistClick(ds) {
  const opponent = ds.opponentUuid ? await fromUuid(ds.opponentUuid).catch(() => null) : null;
  const actor = ds.actorUuid ? await fromUuid(ds.actorUuid).catch(() => null) : null;
  if (!opponent || !actor) return ui.notifications.warn("⚠️ Участник встречного теста не найден.");
  if (!game.user.isGM && !opponent.isOwner) return ui.notifications.warn(`⚠️ Сопротивляться за ${opponent.name} может только его владелец или ГМ.`);

  let opts = [];
  try { opts = JSON.parse(ds.resist || "[]"); } catch { opts = []; }
  let extra = [];
  try { extra = JSON.parse(ds.resistMods || "[]"); } catch { extra = []; }
  const side = await _pickResist(opponent, opts.length ? opts : [{ char: "ws", mod: 0 }]);
  if (!side) return;

  const base = sideValue(opponent, side);
  const ruleMods = collectTestMods(opponent, sideContext(side));
  const extraTotal = extra.reduce((n, m) => n + (Number(m.value) || 0), 0);
  const threshold = base + (Number(side.mod) || 0) + ruleMods.total + extraTotal;
  const rollsN = Math.max(1, Number(ds.rolls) || 1);
  const rolled = [];
  for (let i = 0; i < rollsN; i++) rolled.push(await new Roll("1d100").evaluate());
  const picked = pickReroll(rolled.map(r => r.total), "keepBest");
  const rv = picked.value;
  const theirs = testOutcome(rv, threshold);
  const mine = { success: ds.success === "1", deg: Number(ds.deg) || 0, threshold: Number(ds.threshold) || 0 };
  const { winner, margin } = resolveOpposed(mine, { ...theirs, threshold });
  const initiatorWins = winner === "mine";

  const parts = [
    side.mod ? `${side.mod >= 0 ? "+" : ""}${side.mod}` : "",
    ...ruleMods.parts,
    ...extra.filter(m => m.value).map(m => `${m.label} ${m.value >= 0 ? "+" : ""}${m.value}`)
  ];
  await postTestCard(opponent, {
    icon: rollIcon("shield"), title: `Сопротивление: ${esc(ds.label)} — ${esc(opponent.name)}`, actorUuid: opponent.uuid,
    threshold: rollStatLine({ label: sideLabel(side), base, parts, threshold, rv }),
    rerollNote: picked.dropped.length ? `<div class="roll-defense-note">Лишние руки в Захвате: лучший из ${rollsN}, отброшено ${picked.dropped.join(", ")}</div>` : "",
    outcome: initiatorWins
      ? outcomeHtml(false, `${esc(actor.name)} побеждает во встречном тесте (${theirs.success ? "Успех" : "Провал"} ${theirs.deg} ${_degWord(theirs.deg)}) — «${esc(ds.label)}» удаётся.`)
      : outcomeHtml(true, `${esc(opponent.name)} отбивается (${theirs.success ? "Успех" : "Провал"} ${theirs.deg} ${_degWord(theirs.deg)}) — «${esc(ds.label)}» не удаётся.`)
  }, { rolls: rolled });

  await _deliver(ds, { initiatorWins, margin });
  return { initiatorWins, margin };
}

/** Эффект — у клиента инициатора: локально или по сокету. */
async function _deliver(ds, { initiatorWins, margin }) {
  const payload = {
    action: "contestResolved", userId: ds.userId, contestId: ds.contestId,
    opponentUuid: ds.opponentUuid, initiatorWins, margin
  };
  if (ds.userId === game.user.id) return runContestOutcome(payload);
  const initiatorUser = game.users?.get?.(ds.userId);
  if (!initiatorUser?.active) {
    if (initiatorWins) ui.notifications.warn("⚠️ Игрок, бросавший приём, сейчас не в игре — эффект приёма примените по тексту его карточки.");
    return;
  }
  game.socket.emit(SOCKET, payload);
}

/**
 * Исполнить эффект у клиента инициатора (из сокета или локально).
 * @returns {Promise<boolean>} был ли применён эффект
 */
export async function runContestOutcome({ contestId, opponentUuid, initiatorWins, margin }) {
  const entry = PENDING.get(contestId);
  if (!entry) {
    if (initiatorWins) ui.notifications.warn("⚠️ Ожидание приёма потеряно (страница перезагружалась) — эффект примените по тексту карточки.");
    return false;
  }
  if (entry.done.has(opponentUuid)) return false;
  entry.done.add(opponentUuid);
  if (!initiatorWins) return false;
  const actor = await fromUuid(entry.actorUuid).catch(() => null);
  const target = await fromUuid(opponentUuid).catch(() => null);
  if (!actor) return false;
  if (typeof entry.techDef.onSuccess === "function") {
    // Победа меньшим провалом (оба провалили) — Успехов у инициатора нет:
    // deg провала не должен давать «сдвиг на deg м» / бонус 5+ (приёмка #516).
    const deg = entry.result.success ? entry.result.deg : 0;
    await entry.techDef.onSuccess(actor, { deg, target, margin });
  } else if (entry.techDef.note) {
    await postTestCard(actor, {
      icon: rollIcon("sword"), title: `${esc(entry.techDef.label)}: победа над ${esc(target?.name ?? "?")}`,
      lines: [`<div class="roll-threshold" style="font-size:0.88em;">${entry.techDef.note}</div>`]
    }, { sound: false });
  }
  return true;
}
