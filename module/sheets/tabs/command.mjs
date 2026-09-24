// module/sheets/tabs/command.mjs
// ════════════════════════════════════════════════════════════════════════════
//  КОМАНДОВАНИЕ ВНЕ ОТРЯДА — панель «Под моим Присутствием» на вкладке СОЦИУМ.
//
//  Командовать можно не только сведённым отрядом: наёмник, орда и пара миньонов
//  на одной сцене — обычный сброд. Отряд ради этого заводить не нужно, потому
//  что Команды и так нигде не пишутся на подчинённых: состояние живёт у
//  отдающего, а подчинённые читают карточку в чате. Не хватало только ответа
//  на вопрос «кто сейчас подчинённый» — им и служит этот список.
//
//  От листа Отряда панель отличается ровно одним: у сброда нет ни Слаженности,
//  ни Риска. Это свойства сведённого отряда, а не командира, — поэтому порог
//  теста здесь чистый Command(F) с модификатором, а потолка Успехов нет.
//
//  Что до кого доходит (Орде — только эффекты 1 и 3 Присутствия) считает общее
//  правило rules/command.mjs — то же самое, что и на листе Отряда.
// ════════════════════════════════════════════════════════════════════════════

import { PRESENCE_BENEFITS, SHORT_COMMANDS, DETAIL_COMMANDS,
         SHORT_COMMAND_LIMITS, SQUAD_TYPE_LABEL } from "../../constants/squad.mjs";
import { commandReachFor, presenceNumber, commandHealsPsych } from "../../rules/command.mjs";
import { healPsychDamage } from "../../combat/horde-psych.mjs";
import { _degWord, esc } from "../../helpers/utils.mjs";
import { rollIcon } from "../../constants/roll-icons.mjs";
import { degreesOfSuccess } from "../../constants/craft.mjs";
import { hasLordOfExodites, unnaturalFHint, clearMoraleConditions, rallyExoditeSquad } from "../../combat/lord-of-exodites.mjs";
import { collectTestMods } from "../../rules/roll-mods.mjs";
import { postTestCard, testCardHtml, outcomeHtml, rollStatLine } from "../../helpers/test-card.mjs";
import { GENERAL_COMMAND_KINDS, generalKindLabel, detailSpentOf, trainingSuccessCap } from "../../rules/command-effects.mjs";
import { SKILL_RANKS } from "../../constants/characteristics.mjs";
import { issueStamp, commandLostActive, declareFocusFire, applyBraveryNow, grantTacticTalent, removeTacticGrants, TACTIC_TALENTS } from "../../combat/command-state.mjs";

/** Кого можно взять под своё Присутствие. Шире состава Отряда: миньоны тоже. */
export const FOLLOWER_TYPES =
  ["character", "daemon", "demonPrince", "horde", "vehicle", "minion"];

/** Обратная метка на подчинённом: чьё Присутствие на нём сейчас. */
export const COMMANDED_BY_FLAG = "commandedBy";

const TYPE_LABEL = { ...SQUAD_TYPE_LABEL, minion: "Миньон" };

/**
 * Эффекты Детальной Команды, доступные сброду. «Сплочения» нет: оно поднимает
 * Слаженность отряда, а у несведённой группы Слаженности нет вовсе — купленное
 * здесь, оно съедало 2 Успеха впустую.
 */
const FREE_DETAIL_COMMANDS = DETAIL_COMMANDS.filter(c => c.key !== "rally");

const followersOf = actor =>
  foundry.utils.deepClone(Array.isArray(actor.system?.followers) ? actor.system.followers : []);

/** Когда отдано — Команда гаснет в начале следующего Хода командира. */
const stampOf = prefix => {
  const st = issueStamp();
  return { [`${prefix}combatId`]: st.combatId, [`${prefix}round`]: st.round };
};

/**
 * Дрессировка (глава «Командование»): вместо Command — Survival, вместо F — P;
 * лимит Успехов 2 + продвижения Awareness и Survival выше +0.
 */
const rankBonusOf = (actor, skill) => SKILL_RANKS[actor.system?.skills?.[skill]?.rank ?? "untrained"]?.bonus ?? -20;
export function trainingCapOf(actor) {
  return trainingSuccessCap(rankBonusOf(actor, "awareness"), rankBonusOf(actor, "survival"));
}
/** Навык и Характеристика теста Команды: Command(F) или Survival(P) при Дрессировке. */
const commandSkillOf = actor => actor.system?.command?.training
  ? { skill: "survival", char: "per", label: "Survival(P)" }
  : { skill: "command", char: "fel", label: "Command(F)" };

const rootEl = root => (root?.jquery ? root[0] : root);

// ── Показ ────────────────────────────────────────────────────────────────────

/** Строка подчинённого: живые данные актора плюс то, что до него доходит. */
function followerRow(entry, idx, benefitKey) {
  let doc = null;
  try { doc = fromUuidSync(entry.uuid); } catch (e) { doc = null; }
  const actor = doc?.actor ?? doc ?? null;
  const sys   = actor?.system ?? {};
  const type  = actor?.type || entry.type || "character";
  const isHorde = type === "horde";

  return {
    idx, uuid: entry.uuid || "",
    name: actor?.name || entry.name || "(недоступен)",
    img:  actor?.img  || entry.img  || "icons/svg/mystery-man.svg",
    type, typeLabel: TYPE_LABEL[type] || type,
    missing: !actor,
    note: entry.note || "",
    isHorde,
    // Живучесть — чтобы сброд читался с одного взгляда, как состав Отряда.
    hp: isHorde ? `Магн. ${sys.magnitude?.value ?? 0}/${sys.magnitude?.start ?? 0}`
      : type === "vehicle" ? `Стр. ${sys.structure?.value ?? 0}/${sys.structure?.max ?? 0}`
      : (sys.wounds ? `Раны ${sys.wounds.value ?? 0}/${sys.wounds.max ?? 0}` : ""),
    wp: sys.characteristics?.wp?.total ?? null,
    // Психологический урон Орды: только его и лечит тест Командования по ней.
    psychDamage: isHorde ? (Number(sys.psychDamage) || 0) : 0,
    // Провалил тест Морали (метка commandLost, combat/command-state.mjs).
    reach: commandReachFor(type, benefitKey, actor, { moraleLost: commandLostActive(actor) })
  };
}

/**
 * Контекст панели. Зовётся из socialContext вместе с остальной вкладкой.
 */
export function commandContext(actor) {
  const cmd     = actor.system?.command ?? {};
  const benefit = cmd.presence?.benefit || "extreme";
  const rows    = followersOf(actor).map((entry, idx) => followerRow(entry, idx, benefit));

  return {
    followers: rows,
    followerCount: rows.length,
    // Сколько командиров подчинённый способен слушать разом — ½ P.b (окр.▼).
    commandSkill: actor.system?.skills?.command?.total ?? null,
    presenceBenefits: PRESENCE_BENEFITS.map(b => ({
      ...b, number: presenceNumber(b.key), selected: b.key === benefit
    })),
    presenceActive: !!cmd.presence?.active,
    training: !!cmd.training,
    trainingCap: trainingCapOf(actor),
    // Кнопка «Тройка» — когда выбрана Концентрация огня (эффект 2).
    focusSelected: benefit === "focus" && !!cmd.presence?.active,
    shortCommands: SHORT_COMMANDS.map(c => ({ ...c, selected: c.key === (cmd.shortCommand?.key || "inspire") })),
    shortActive:   !!cmd.shortCommand?.active,
    shortSuccesses: Number(cmd.shortCommand?.successes) || 0,
    shortBonus: (Number(cmd.shortCommand?.successes) || 0)
              * (SHORT_COMMANDS.find(c => c.key === (cmd.shortCommand?.key || "inspire"))?.mult ?? 1),
    shortLimits: SHORT_COMMAND_LIMITS,
    detailCommands: FREE_DETAIL_COMMANDS.map(c => ({
      ...c, picked: (cmd.detailCommand?.picks || []).includes(c.key),
      afford: (cmd.detailCommand?.picks || []).includes(c.key)
        || (Number(cmd.detailCommand?.successes) || 0) - detailSpentOf(cmd.detailCommand, DETAIL_COMMANDS) >= c.cost
    })),
    detailActive:    !!cmd.detailCommand?.active,
    detailSuccesses: Number(cmd.detailCommand?.successes) || 0,
    // Орды в подчинении: у них тест Командования лечит психологический урон.
    commandedHordes: rows.filter(r => r.isHorde && !r.missing),
    // Lord of the Exodites (wdbc-zepq) — доп. кнопки владельцу Черты.
    exoditeLord: hasLordOfExodites(actor),
    exoditeGroupLimit: Number(actor.system?.characteristics?.fel?.bonus) || 0
  };
}

// ── Правка списка ────────────────────────────────────────────────────────────

/** Взять актора под своё Присутствие. */
export async function addFollower(actor, target) {
  if (!target) return false;
  if (!FOLLOWER_TYPES.includes(target.type)) {
    ui.notifications?.warn(
      `Под Присутствие берутся: ${FOLLOWER_TYPES.map(t => TYPE_LABEL[t] || t).join(", ")}. ` +
      `«${target.name}» — ${TYPE_LABEL[target.type] || target.type}.`);
    return false;
  }
  if (target.uuid === actor.uuid) {
    ui.notifications?.warn("Сам себе командир — записи не требуется.");
    return false;
  }
  const list = followersOf(actor);
  if (list.some(f => f.uuid === target.uuid)) {
    ui.notifications?.info(`«${target.name}» уже под вашим Присутствием.`);
    return false;
  }
  list.push({ uuid: target.uuid, name: target.name, img: target.img, type: target.type, note: "" });
  await actor.update({ "system.followers": list });
  await markCommanded(target, actor);
  return true;
}

export async function removeFollower(actor, idx) {
  const list = followersOf(actor);
  const gone = list[idx];
  if (!gone) return;
  list.splice(idx, 1);
  await actor.update({ "system.followers": list });
  await clearCommanded(gone.uuid, actor);
}

export async function setFollowerNote(actor, idx, value) {
  const list = followersOf(actor);
  if (!list[idx]) return;
  list[idx] = { ...list[idx], note: String(value ?? "") };
  await actor.update({ "system.followers": list });
}

/**
 * Обратная метка на подчинённом: его лист показывает, под чьим он Присутствием.
 * Метка справочная — эффекты по-прежнему считаются у командира.
 */
async function markCommanded(target, commander) {
  try { await target.setFlag("warhammer-dbc", COMMANDED_BY_FLAG,
    { uuid: commander.uuid, name: commander.name }); }
  catch (e) { console.warn("Warhammer DBC | commandedBy flag:", e); }
}

async function clearCommanded(uuid, commander) {
  if (!uuid) return;
  try {
    const doc = await fromUuid(uuid);
    const target = doc?.actor ?? doc ?? null;
    const flag = target?.getFlag("warhammer-dbc", COMMANDED_BY_FLAG);
    // Снимаем только свою метку: подчинённого мог перехватить другой командир.
    if (flag?.uuid === commander.uuid)
      await target.unsetFlag("warhammer-dbc", COMMANDED_BY_FLAG);
  } catch (e) { console.warn("Warhammer DBC | commandedBy flag:", e); }
}

/**
 * Взять под Присутствие все выделенные на сцене токены разом — чтобы не тыкать
 * каждого по отдельности. Радиуса у Присутствия в системе нет, поэтому круг
 * подчинённых очерчивает выделение, а не расстояние.
 */
export async function takeSelectedTokens(actor) {
  const tokens = canvas?.tokens?.controlled ?? [];
  if (!tokens.length) {
    return ui.notifications?.warn("⚠️ Выделите на сцене токены тех, кого берёте под Присутствие.");
  }
  let added = 0;
  for (const token of tokens) {
    const target = token.actor ?? token.document?.actor ?? null;
    if (!target || target.uuid === actor.uuid) continue;
    if (await addFollower(actor, target)) added++;
  }
  ui.notifications?.info(added
    ? `Под Присутствием ${actor.name}: +${added}.`
    : "Ни один выделенный токен под Присутствие не взят.");
  return added;
}

// ── Команды ──────────────────────────────────────────────────────────────────

/**
 * Бросок Команды с листа командира.
 *
 * Порог — Command(F) плюс модификатор, и всё: Слаженности и Риска у сброда нет,
 * поэтому нет ни надбавки, ни потолка Успехов. Состояние пишется командиру,
 * подчинённые читают карточку.
 *
 * @param {Actor}  actor
 * @param {"presence"|"short"|"detail"} kind
 * @param {object} [opts] { mod, benefit, shortKey, declaredSuccesses }
 *   declaredSuccesses — Lord of the Exodites (wdbc-zepq, часть 3): «до броска
 *   объявить автоуспех с числом успехов = Unnatural F» — бросок пропускается,
 *   тест сразу засчитан успешным с этим числом Успехов.
 */
export async function rollCommand(actor, kind, { mod = 0, benefit = "", shortKey = "", declaredSuccesses = 0,
                                                testKind = "", recipientUuid = "" } = {}) {
  // Немота — Общительность 0 от урона (wdbc-x1nz.2.83): приказ не отдать.
  if (actor.system?.conditions?.mute)
    return ui.notifications?.warn(`${actor.name}: Немота (Общительность 0 от урона) — не может отдавать Команды.`);
  const cmd = actor.system?.command ?? {};
  const cs = commandSkillOf(actor);
  if (cmd.training && kind === "detail")
    return ui.notifications?.warn("Дрессировка: животные не получают Детальных Команд.");
  const base = Number(actor.system?.skills?.[cs.skill]?.total) || 0;
  // Общий сбор модификаторов (wdbc-ct65.2). Командование — социальный навык
  // (area "social"), поэтому сюда доезжает и «−30 на устные социальные тесты»
  // Оглохшего, и Черты на само Командование: раньше этот путь шёл мимо
  // реестра правил целиком, даже без Усталости.
  const ruleMods = collectTestMods(actor, { kind: "skill", skill: cs.skill, char: cs.char });
  const threshold = base + (Number(mod) || 0) + ruleMods.total;
  const declared = Number(declaredSuccesses) || 0;

  const roll = declared > 0 ? null : await new Roll("1d100").evaluate();
  const rv = declared > 0 ? null : roll.total;
  const ok = declared > 0 || rv <= threshold;
  const rawSux = declared > 0 ? declared : (ok ? degreesOfSuccess(rv, threshold) : 0);
  // Дрессировка: лимит Успехов не от Риска, а 2 + продвижения Awareness/Survival.
  const trainCap = cmd.training ? trainingCapOf(actor) : null;
  const sux = trainCap != null ? Math.min(rawSux, trainCap) : rawSux;

  let effect = "", update = {};

  if (kind === "presence") {
    const key = benefit || cmd.presence?.benefit || "extreme";
    const b = PRESENCE_BENEFITS.find(x => x.key === key) || PRESENCE_BENEFITS[0];
    if (ok) update = { "system.command.presence.active": true, "system.command.presence.benefit": key };
    effect = `<div class="sq-chat-effect"><b>${esc(b.label)}</b> <span class="cmd-chat-num">эффект ${presenceNumber(key)}</span>
      <div class="sq-chat-desc">${esc(b.desc)}</div></div>`;
  }
  else if (kind === "short") {
    const key = shortKey || cmd.shortCommand?.key || "inspire";
    const c = SHORT_COMMANDS.find(x => x.key === key) || SHORT_COMMANDS[0];
    if (ok) update = {
      "system.command.shortCommand.active": true,
      "system.command.shortCommand.key": key,
      "system.command.shortCommand.successes": sux,
      ...(key === "general" ? { "system.command.shortCommand.testKind": testKind || cmd.shortCommand?.testKind || "attack" } : {}),
      ...(key === "personal" ? { "system.command.shortCommand.recipientUuid": recipientUuid || cmd.shortCommand?.recipientUuid || "" } : {}),
      ...stampOf("system.command.shortCommand."),
      // Короткая Команда даёт и все преимущества Командного Присутствия.
      "system.command.presence.active": true
    };
    const kindLabel = key === "general" ? generalKindLabel(testKind || cmd.shortCommand?.testKind || "attack") : "";
    const recName = key === "personal"
      ? (followersOf(actor).find(f => f.uuid === (recipientUuid || cmd.shortCommand?.recipientUuid))?.name || "") : "";
    effect = `<div class="sq-chat-effect"><b>${esc(c.label)}</b>${kindLabel ? ` (${esc(kindLabel)})` : ""}${recName ? ` → ${esc(recName)}` : ""} — бонус <b class="sq-chat-big">+${sux * c.mult}</b> (${sux}×${c.mult})
      <div class="sq-chat-desc">${esc(c.desc)}</div>
      ${ok ? `<div class="sq-chat-note">Бонус сам учитывается в бросках подчинённых до начала вашего следующего Хода.</div>` : ""}</div>`;
  }
  else if (kind === "detail") {
    if (ok) update = {
      "system.command.detailCommand.active": true,
      "system.command.detailCommand.successes": sux,
      "system.command.detailCommand.picks": [],
      "system.command.detailCommand.coverSuccesses": 0,
      "system.command.detailCommand.tactic": "",
      ...stampOf("system.command.detailCommand."),
      "system.command.presence.active": true
    };
    const list = FREE_DETAIL_COMMANDS.map(c =>
      `<div class="sq-chat-detail${sux >= c.cost ? " sq-chat-afford" : ""}"><span class="sq-chat-cost">${c.cost}</span> ${esc(c.label)}</div>`).join("");
    effect = `<div class="sq-chat-effect"><b>Успехов на эффекты: ${sux}</b><div class="sq-chat-details">${list}</div>
      <div class="sq-chat-note">Выберите эффекты в панели «Под моим Присутствием» — Успехи спишутся автоматически.</div></div>`;
  }

  if (ok && Object.keys(update).length) await actor.update(update);

  const title = { presence: "Командное Присутствие", short: "Короткая Команда", detail: "Детальная Команда" }[kind];

  // Классы sq-chat и cmd-free-chat — корневые классы карточек Командования, за
  // них цепляется вёрстка (styles/sheets/squad-sheet.css).
  await postTestCard(actor, testCardHtml({
    classes: "sq-chat cmd-free-chat",
    icon: rollIcon("crown", "#4dffa6"),
    title: `${esc(title)} — ${esc(actor.name)}`,
    threshold: rollStatLine({
      label: cs.label, base,
      parts: [...(mod ? [`мод. ${mod >= 0 ? "+" : ""}${mod}`] : []), ...ruleMods.parts],
      threshold, rv: declared > 0 ? null : rv
    }),
    // Объявленный автоуспех идёт вместо строки броска — она своя, а rv нет.
    lines: [
      cmd.training
        ? `<div class="cmd-chat-hint">Дрессировка: Survival(P), лимит Успехов ${trainCap}${rawSux > sux ? ` — срезано с ${rawSux}` : ""}</div>`
        : `<div class="cmd-chat-hint">Без Слаженности и Риска: группа не сведена в Отряд</div>`,
      declared > 0 ? `<div class="roll-dice">Автоуспех (Unnatural F) — бросок не нужен</div>` : ""
    ],
    outcome: ok ? outcomeHtml(true, `Успех — ${sux} ${_degWord(sux)}`) : outcomeHtml(false, "Провал"),
    sections: [effect, ok ? notReachedBy(actor, kind, benefit || cmd.presence?.benefit || "extreme") : ""]
  }), { rolls: roll ? [roll] : [] });

  return { ok, successes: sux, threshold, roll: rv };
}

/** До кого отданное не дошло — молчать об этом нельзя. */
function notReachedBy(actor, kind, benefitKey) {
  const missed = followersOf(actor)
    .map((entry, idx) => followerRow(entry, idx, benefitKey))
    .filter(f => !f.missing && (kind === "presence" ? !f.reach.presenceApplies : !f.reach.commands));
  if (!missed.length) return "";

  // Причина у подчинённого (Оглох/Без сознания, wdbc-x1nz.2.90) — в скобках
  // у имени: общий «why» ниже написан про Орду и глухому не подходит.
  const names = missed.map(f => esc(f.name) + (f.reach.blockedBy ? ` (${f.reach.blockedBy})` : "")).join(", ");
  const why = kind === "presence"
    ? `выбранное преимущество (эффект ${presenceNumber(benefitKey)}) до них не доходит`
    : "Команды на них не действуют (Орде доходят лишь эффекты 1 и 3 Присутствия)";
  return `<div class="sq-chat-note sq-chat-missed">Не получают: <b>${names}</b> — ${why}.</div>`;
}

/**
 * Тест Командования по Орде: единственное, на что он по ней годится, —
 * вернуть ей психологический урон. Вдохновляющая речь придаёт Орде сил.
 */
export async function rallyHorde(actor, uuid, { mod = 0 } = {}) {
  const doc = await fromUuid(uuid).catch(() => null);
  const horde = doc?.actor ?? doc ?? null;
  if (!horde || !commandHealsPsych(horde.type)) {
    return ui.notifications?.warn("⚠️ Психологический урон лечится только у Орды.");
  }
  const psych = Number(horde.system?.psychDamage) || 0;
  if (!psych) return ui.notifications?.info(`У «${horde.name}» психологического урона нет.`);

  const base = Number(actor.system?.skills?.command?.total) || 0;
  // Тот же общий сбор, что у rollCommand выше (wdbc-ct65.2).
  const ruleMods = collectTestMods(actor, { kind: "skill", skill: "command", char: "fel" });
  const threshold = base + (Number(mod) || 0) + ruleMods.total;
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const ok = rv <= threshold;
  const sux = ok ? degreesOfSuccess(rv, threshold) : 0;
  const healed = ok ? await healPsychDamage(horde, sux) : 0;

  // Те же корневые классы, что у rollCommand выше.
  await postTestCard(actor, testCardHtml({
    classes: "sq-chat cmd-free-chat",
    icon: rollIcon("crown", "#4dffa6"),
    title: `Речь к Орде — ${esc(actor.name)} → ${esc(horde.name)}`,
    threshold: rollStatLine({
      label: "Command(F)", base,
      parts: [...(mod ? [`мод. ${mod >= 0 ? "+" : ""}${mod}`] : []), ...ruleMods.parts],
      threshold, rv
    }),
    outcome: ok
      ? outcomeHtml(true, `Успех — ${sux} ${_degWord(sux)}, возвращено <b>${healed}</b> Магнитуды`)
      : outcomeHtml(false, "Провал — толпа не слушает"),
    sections: [`<div class="sq-chat-note">Тест Командования по Орде лечит только психологический урон; обычные потери восполняются рекрутами и отдыхом.</div>`]
  }), { rolls: [roll] });

  return { ok, healed };
}

/** Покупка/отмена эффекта Детальной Команды за накопленные Успехи. */
export async function toggleDetailPick(actor, key, { pickTactic = null } = {}) {
  const def = FREE_DETAIL_COMMANDS.find(c => c.key === key);
  if (!def) return;
  const dc = actor.system?.command?.detailCommand ?? {};
  const picks = (Array.isArray(dc.picks) ? dc.picks : []).filter(k => typeof k === "string");

  if (picks.includes(key)) {
    const undo = { "system.command.detailCommand.picks": picks.filter(k => k !== key) };
    if (key === "cover") undo["system.command.detailCommand.coverSuccesses"] = 0;
    if (key === "tactics") {
      undo["system.command.detailCommand.tactic"] = "";
      await removeTacticGrants(actor.uuid);
    }
    return actor.update(undo);
  }
  const left = (Number(dc.successes) || 0) - detailSpentOf({ ...dc, picks }, DETAIL_COMMANDS);
  if (left < def.cost) {
    return ui.notifications?.warn(
      `⚠️ Не хватает Успехов: «${def.label}» стоит ${def.costLabel || def.cost}, свободно ${Math.max(0, left)}.`);
  }
  const update = { "system.command.detailCommand.picks": [...picks, key] };
  // «Прикрытие (3+ Успеха)»: в него уходят все оставшиеся Успехи.
  if (key === "cover") update["system.command.detailCommand.coverSuccesses"] = left;
  let tactic = null;
  if (key === "tactics") {
    tactic = await (pickTactic ?? (async () => (await import("../squad-sheet.mjs")).pickTacticDialog()))();
    if (!tactic) return;
    update["system.command.detailCommand.tactic"] = tactic;
  }
  await actor.update(update);
  if (key === "bravery") {
    const freed = await applyBraveryNow(actor);
    if (freed.length) ui.notifications?.info(`Храбрость: сняты Подавление/Шок — ${freed.join(", ")}.`);
  }
  if (tactic) {
    const given = await grantTacticTalent(actor, tactic);
    const label = TACTIC_TALENTS.find(t => t.key === tactic)?.label || tactic;
    ui.notifications?.info(given.length ? `Особая Тактика: «${label}» — ${given.join(", ")}.`
      : `Особая Тактика: «${label}» — выдать некому.`);
  }
}

/** Снять всё отданное — конец боя или потеря Командования. */
export async function clearCommands(actor) {
  return actor.update({
    "system.command.presence.active": false,
    "system.command.shortCommand.active": false,
    "system.command.shortCommand.successes": 0,
    "system.command.detailCommand.active": false,
    "system.command.detailCommand.successes": 0,
    "system.command.detailCommand.picks": []
  });
}

// ── Слушатели панели ─────────────────────────────────────────────────────────

/** Диалог броска Команды: выбор варианта и модификатор. */
async function commandDialog(actor, kind) {
  const cmd = actor.system?.command ?? {};
  const title = { presence: "Командное Присутствие", short: "Короткая Команда", detail: "Детальная Команда" }[kind];
  const base = Number(actor.system?.skills?.command?.total) || 0;

  const options = kind === "presence"
    ? PRESENCE_BENEFITS.map(b =>
        `<option value="${b.key}" ${b.key === (cmd.presence?.benefit || "extreme") ? "selected" : ""}>${presenceNumber(b.key)}. ${esc(b.label)}</option>`).join("")
    : kind === "short"
    ? SHORT_COMMANDS.map(c =>
        `<option value="${c.key}" ${c.key === (cmd.shortCommand?.key || "inspire") ? "selected" : ""}>${esc(c.label)} (×${c.mult})</option>`).join("")
    : "";

  // Lord of the Exodites (wdbc-zepq, часть 3): автоуспех с числом успехов =
  // Unnatural F, объявляется до броска — доступно только владельцу Черты.
  const exoditeLord = hasLordOfExodites(actor);
  const autoSuccessHtml = exoditeLord ? `
      <div class="atk-dlg-row"><label><input id="cmd-auto-success" type="checkbox"/> Автоуспех (Unnatural F):</label>
        <input id="cmd-auto-successes" type="number" min="0" value="${unnaturalFHint(actor)}" style="width:4em;"/></div>` : "";

  // Общая Команда — вид тестов, Личная — получатель (выбор Командира при отдаче).
  const genOpts = GENERAL_COMMAND_KINDS.map(k =>
    `<option value="${k.key}" ${k.key === (cmd.shortCommand?.testKind || "attack") ? "selected" : ""}>${esc(k.label)}</option>`).join("");
  const recOpts = followersOf(actor).map(f =>
    `<option value="${f.uuid}" ${f.uuid === cmd.shortCommand?.recipientUuid ? "selected" : ""}>${esc(f.name)}</option>`).join("");
  const shortExtra = kind === "short" ? `
      <div class="atk-dlg-row"><label>Вид тестов (Общая):</label><select id="cmd-general">${genOpts}</select></div>
      <div class="atk-dlg-row"><label>Получатель (Личная):</label><select id="cmd-recipient">${recOpts}</select></div>` : "";

  const picked = await foundry.applications.api.DialogV2.prompt({
    window: { title: `${title} — ${actor.name}` },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<div class="wh-attack-form cmd-free-form">
      <div class="atk-horde-info">${cmd.training
        ? `Дрессировка: Survival(P), лимит Успехов ${trainingCapOf(actor)}.`
        : "Группа не сведена в Отряд: ни Слаженности, ни Риска — порог чистый Command(F)."}</div>
      <div class="atk-dlg-row"><label>${commandSkillOf(actor).label}:</label><span><b>${Number(actor.system?.skills?.[commandSkillOf(actor).skill]?.total) || 0}</b></span></div>
      ${options ? `<div class="atk-dlg-row"><label>Вариант:</label><select id="cmd-key">${options}</select></div>` : ""}
      <div class="atk-dlg-row"><label>Модификатор:</label><input id="cmd-mod" type="number" value="0"/></div>
      ${shortExtra}
      ${autoSuccessHtml}
    </div>`,
    ok: {
      label: "Бросок!", icon: "fas fa-dice-d10",
      callback: (event, button) => ({
        mod: parseInt(button.form.querySelector("#cmd-mod")?.value) || 0,
        key: button.form.querySelector("#cmd-key")?.value || "",
        testKind: button.form.querySelector("#cmd-general")?.value || "",
        recipientUuid: button.form.querySelector("#cmd-recipient")?.value || "",
        declaredSuccesses: button.form.querySelector("#cmd-auto-success")?.checked
          ? (parseInt(button.form.querySelector("#cmd-auto-successes")?.value) || 0) : 0
      })
    }
  }).catch(() => null);
  if (!picked) return;

  return rollCommand(actor, kind, {
    mod: picked.mod, declaredSuccesses: picked.declaredSuccesses,
    testKind: picked.testKind, recipientUuid: picked.recipientUuid,
    benefit:  kind === "presence" ? picked.key : "",
    shortKey: kind === "short"    ? picked.key : ""
  });
}

/** Диалог речи к Орде: лечение психологического урона. */
async function rallyDialog(actor, uuid) {
  const base = Number(actor.system?.skills?.command?.total) || 0;
  const mod = await foundry.applications.api.DialogV2.prompt({
    window: { title: `Речь к Орде — ${actor.name}` },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<div class="wh-attack-form cmd-free-form">
      <div class="atk-horde-info">Успех возвращает Орде столько Магнитуды, сколько Успехов — но только из психологического урона.</div>
      <div class="atk-dlg-row"><label>Command(F):</label><span><b>${base}</b></span></div>
      <div class="atk-dlg-row"><label>Модификатор:</label><input id="cmd-mod" type="number" value="0"/></div>
    </div>`,
    ok: { label: "Бросок!", icon: "fas fa-dice-d10",
          callback: (event, button) => parseInt(button.form.querySelector("#cmd-mod")?.value) || 0 }
  }).catch(() => null);
  if (mod === null || mod === undefined) return;
  return rallyHorde(actor, uuid, { mod });
}

/**
 * Слушатели панели «Под моим Присутствием». Зовутся из activateSocialListeners
 * вместе с остальной вкладкой.
 */
export function activateCommandListeners(root, actor, { editable = true } = {}) {
  const el = rootEl(root);
  if (!el?.querySelector || !editable) return;

  el.querySelectorAll("[data-cmd-roll]").forEach(node =>
    node.addEventListener("click", () => commandDialog(actor, node.dataset.cmdRoll)));
  el.querySelectorAll(".cmd-rally").forEach(node =>
    node.addEventListener("click", () => rallyDialog(actor, node.dataset.uuid)));
  el.querySelectorAll(".cmd-detail-pick").forEach(node =>
    node.addEventListener("click", () => toggleDetailPick(actor, node.dataset.key)));
  el.querySelectorAll(".cmd-clear").forEach(node =>
    node.addEventListener("click", () => clearCommands(actor)));
  el.querySelectorAll("input[data-cmd-training]").forEach(node =>
    node.addEventListener("change", ev => actor.update({ "system.command.training": ev.currentTarget.checked })));
  el.querySelectorAll(".cmd-focus-fire").forEach(node =>
    node.addEventListener("click", () => declareFocusFire()));
  el.querySelectorAll(".cmd-take-tokens").forEach(node =>
    node.addEventListener("click", () => takeSelectedTokens(actor)));
  // Lord of the Exodites (wdbc-zepq): выбор целей — выделенные на сцене
  // токены, ограничение F.b — предупреждение, не запрет (см. clearMoraleConditions).
  el.querySelectorAll(".cmd-lord-clear").forEach(node =>
    node.addEventListener("click", () => {
      const limit = Number(actor.system?.characteristics?.fel?.bonus) || 0;
      const tokens = (canvas?.tokens?.controlled ?? []).map(t => t.actor).filter(a => a && a !== actor);
      if (!tokens.length) return ui.notifications?.warn("⚠️ Выделите на сцене токены союзников.");
      if (limit && tokens.length > limit)
        ui.notifications?.warn(`⚠️ Выделено больше F.b (${limit}) — способность позволяет до ${limit}, остальные не получат эффекта по книге.`);
      clearMoraleConditions(actor, tokens.slice(0, limit || tokens.length));
    }));
  el.querySelectorAll(".cmd-lord-rally").forEach(node =>
    node.addEventListener("click", () => rallyExoditeSquad(actor)));
  el.querySelectorAll(".cmd-follower-note").forEach(node =>
    node.addEventListener("change", ev => setFollowerNote(
      actor, Number(node.dataset.index), ev.currentTarget.value)));
  el.querySelectorAll(".cmd-follower-remove").forEach(node =>
    node.addEventListener("click", () => removeFollower(actor, Number(node.dataset.index))));
  el.querySelectorAll("select[data-cmd-benefit]").forEach(node =>
    node.addEventListener("change", ev =>
      actor.update({ "system.command.presence.benefit": ev.currentTarget.value })));

  // Зона дропа: акторы из боковой панели и токены со сцены.
  const zone = el.querySelector(".cmd-followers-zone");
  if (!zone) return;
  zone.addEventListener("dragover", ev => { ev.preventDefault(); zone.classList.add("social-drop-hover"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("social-drop-hover"));
  zone.addEventListener("drop", async ev => {
    ev.preventDefault();
    ev.stopPropagation();
    zone.classList.remove("social-drop-hover");
    let data = null;
    try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch { /* не наш дроп */ }
    if (!data?.uuid) return;
    const doc = await fromUuid(data.uuid).catch(() => null);
    await addFollower(actor, doc?.documentName === "Token" ? doc.actor : doc);
  });
}
