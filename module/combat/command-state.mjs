// module/combat/command-state.mjs
// ════════════════════════════════════════════════════════════════════════════
//  КОМАНДОВАНИЕ В ЖИВОМ МИРЕ (wdbc-x1nz.2, глава «Командование»):
//
//   - у кого боец под командованием: Отряды, где он в составе, и командир
//     «Под моим Присутствием» (флаг commandedBy) → узлы для
//     rules/command-effects.mjs, источник правил «command»;
//   - срок: Короткая и Детальная Команды действуют «до начала следующего Хода
//     Командира», Брифинг — один Ход, Присутствие — до конца боя;
//   - Мораль: провал подчинённого снимает с него Командование (флаг
//     commandLost до конца следующего Раунда), провал Командира/Лидера —
//     снимает все его Команды, с кнопкой «Скрыть трусость» (Charm/Deceive(F)+0);
//   - «Храбрость» при покупке снимает Подавление и Шок, «Особая Тактика»
//     выдаёт Талант на срок Команды.
//
//  Писать чужие документы (Отряд, подчинённых) может не каждый клиент —
//  такие записи уходят активному ГМу по общему сокету (warhammer-dbc.mjs).
// ════════════════════════════════════════════════════════════════════════════

import { registerRuleSource } from "../rules/source-registry.mjs";
import { commandRulesFor, braveryActive, moraleCommandActive, commandEffectNode,
         syncAssaultBonus, volleySuppressionMod } from "../rules/command-effects.mjs";
import { commandReachFor } from "../rules/command.mjs";
import { esc } from "../helpers/utils.mjs";

const NS = "warhammer-dbc";
const SOCKET = "system.warhammer-dbc";
export const COMMAND_LOST_FLAG = "commandLost";
const TACTIC_FLAG = "commandTactic";

/** Таланты «Особой Тактики» — ключ, подпись, документ в компендиуме talents. */
export const TACTIC_TALENTS = [
  { key: "bayonetCharge",   label: "Bayonet Charge / Штыковая Атака",          id: "HCQfzVw2s310Fn1H" },
  { key: "berserkCharge",   label: "Berserk Charge / Натиск Берсерка",         id: "a8nqCYrNqDHkyiOy" },
  { key: "coveringFire",    label: "Covering Fire / Прикрывающий Огонь",       id: "ocmHByUIN05RyPX1" },
  { key: "doubleTeam",      label: "Double Team / Гурьбой",                    id: "icosn3iRFLevn5hw" },
  { key: "friendlyFire",    label: "Friendly Fire / Дружественный Огонь",      id: "ovXPi8LjrZ2gXbew" },
  { key: "hipShooting",     label: "Hip Shooting / Стрельба от Бедра",         id: "toUoAIsEecSRpSIU" },
  { key: "leapUp",          label: "Leap Up / Вскочить",                       id: "pg3WkuWtZwFb1r0I" },
  { key: "onThisMark",      label: "On This Mark / По Этим Координатам",       id: "6dLsleG4A9dXXpda" },
  { key: "rapidReload",     label: "Rapid Reload / Быстрая Перезарядка",       id: "AeQ8R7RDHMGFtTfV" },
  { key: "targetSelection", label: "Target Selection / Выбор Целей",           id: "Y1f38xIjT8avx1iR" },
  { key: "takedown",        label: "Takedown / Вырубание",                     id: "wAnnAflzT7pZaafB" }
];

const resolve = uuid => {
  if (!uuid) return null;
  try { const d = fromUuidSync(uuid); return d?.actor ?? d ?? null; } catch { return null; }
};

/**
 * Все uuid, под которыми этот боец может встретиться в списках (Отряд, «Под
 * моим Присутствием», пост, отметка «кто отдал»). Токены персонажей по
 * умолчанию НЕсвязанные (actorLink:false): бросок идёт от актора токена
 * (Scene.x.Token.y.Actor.z), а в список могли положить мирового актора с
 * боковой панели — и наоборот. Без этого бонусы не доходили, а Команда не
 * гасла на Ходу командира (найдено живой проверкой).
 */
export function actorIdentityUuids(actor) {
  const ids = new Set();
  if (!actor) return ids;
  if (actor.uuid) ids.add(actor.uuid);
  if (actor.isToken) {
    const base = actor.token?.baseActor ?? game.actors?.get?.(actor.id);
    if (base?.uuid) ids.add(base.uuid);
  }
  for (const t of actor.getActiveTokens?.() ?? []) if (t.actor?.uuid) ids.add(t.actor.uuid);
  return ids;
}

const sameActor = (actor, uuid) => !!uuid && actorIdentityUuids(actor).has(uuid);

/**
 * Живые документы записи списка: мировой актор НЕсвязанного токена
 * раскрывается в акторов его токенов на сцене — Состояния (Подавление, Шок)
 * и выданные Таланты живут там, а не на мировом.
 */
function liveDocsOf(uuid) {
  const doc = resolve(uuid);
  if (!doc) return [];
  if (doc.isToken || doc.prototypeToken?.actorLink !== false) return [doc];
  const tokenActors = (doc.getActiveTokens?.() ?? []).map(t => t.actor).filter(Boolean);
  return tokenActors.length ? tokenActors : [doc];
}

/** Отметка «когда отдано» — по ней Команда истекает на следующем Ходу отдающего. */
export function issueStamp(giverUuid = "") {
  const combat = game.combat;
  return { giverUuid, combatId: combat?.id ?? "", round: Number(combat?.round) || 0 };
}

/** Кто в Отряде фактически раздаёт Присутствие и чья W в эффекте 3. */
function squadGiver(squad) {
  const posts = squad.system?.posts || {};
  const commander = resolve(posts.commander?.uuid);
  const leader = resolve(posts.leader?.uuid);
  const active = commander ?? leader;
  const willOf = (squad.system?.delegated && leader && commander) ? leader : active;
  return { active, willOf };
}

/** Провалил ли актор тест Морали недавно: этот и следующий Раунд того же боя. */
export function commandLostActive(actor, combat = game.combat) {
  const f = actor?.getFlag?.(NS, COMMAND_LOST_FLAG);
  if (!f || !combat || f.combatId !== combat.id) return false;
  return Number(combat.round) <= Number(f.round) + 1;
}

/**
 * Узлы командования над актором: Отряды, где он в составе, и командир
 * сброда. overCapacity — боец сверх F.b×2 подчинённых командира (по порядку
 * списка — «он выбирает, кто получает»).
 */
export function commandNodesFor(actor) {
  if (!actor?.uuid || typeof game === "undefined") return [];
  const nodes = [];
  for (const squad of game.actors ?? []) {
    if (squad.type !== "squad") continue;
    const members = Array.isArray(squad.system?.members) ? squad.system.members : [];
    const idx = members.findIndex(m => sameActor(actor, m.uuid));
    if (idx < 0) continue;
    const { active, willOf } = squadGiver(squad);
    const cap = active ? (Number(active.system?.characteristics?.fel?.bonus) || 0) * 2 : Infinity;
    nodes.push({
      sourceUuid: squad.uuid,
      label: `Отряд «${squad.name}»`,
      presence: squad.system.presence ?? {},
      presenceWp: willOf?.system?.characteristics?.wp?.total ?? null,
      short: squad.system.shortCommand ?? {},
      detail: squad.system.detailCommand ?? {},
      moraleLost: !!members[idx].moraleLost,
      overCapacity: idx >= cap
    });
  }
  const by = actor.getFlag?.(NS, "commandedBy");
  const boss = by?.uuid ? resolve(by.uuid) : null;
  const followers = Array.isArray(boss?.system?.followers) ? boss.system.followers : [];
  const fIdx = followers.findIndex(f => sameActor(actor, f.uuid));
  if (boss && fIdx >= 0) {
    const cmd = boss.system.command ?? {};
    // Дрессировка: «максимум подчинённых животных — P.b» вместо F.b×2.
    const bossCap = cmd.training
      ? (Number(boss.system?.characteristics?.per?.bonus) || 0)
      : (Number(boss.system?.characteristics?.fel?.bonus) || 0) * 2;
    nodes.push({
      sourceUuid: boss.uuid,
      label: boss.name,
      presence: cmd.presence ?? {},
      presenceWp: boss.system?.characteristics?.wp?.total ?? null,
      short: cmd.shortCommand ?? {},
      detail: cmd.detailCommand ?? {},
      overCapacity: fIdx >= bossCap
    });
  }
  return nodes;
}

registerRuleSource("command", (actor, ctx) => {
  if (typeof game === "undefined" || !ctx || !Object.keys(ctx).length || !ctx.kind) return [];
  const nodes = commandNodesFor(actor);
  if (!nodes.length) return [];
  return commandRulesFor(actor, nodes, ctx, { commandLost: commandLostActive(actor) });
});

/** «Храбрость» на акторе: Паника от Горения проходится сама. */
export function commandBraveryOn(actor) {
  return braveryActive(actor, commandNodesFor(actor), { commandLost: commandLostActive(actor) });
}

/** «Укрепление Морали» на акторе: сброс Подавления/Шока и в начале, и в конце Хода. */
export function commandMoraleOn(actor) {
  return moraleCommandActive(actor, commandNodesFor(actor), { commandLost: commandLostActive(actor) });
}

// ── Запись через ГМа ────────────────────────────────────────────────────────

/** Обновить документ сам, а без прав — попросить активного ГМа. */
export async function updateOrRelay(doc, update) {
  if (!doc) return;
  if (doc.isOwner) return doc.update(update);
  game.socket.emit(SOCKET, { action: "commandUpdate", uuid: doc.uuid, update, userId: game.user.id });
}

/** Сокет: ГМ применяет правку командования (только поля Команд/флаги Морали). */
export async function applyRelayedCommandUpdate(data) {
  const doc = resolve(data.uuid);
  if (!doc) return;
  // Только поля Команд, метка Морали и СНЯТИЕ Подавления/Шока («Храбрость»):
  // сокет открыт любому игроку, и шире ему давать нечего.
  const allowed = Object.entries(data.update ?? {}).every(([k, v]) =>
    /^system\.(presence|shortCommand|detailCommand|command|cohesion\.value|briefing)\b/.test(k)
    || (/^system\.conditions\.(pinned|shocked)$/.test(k) && v === false)
    || /^flags\.warhammer-dbc\.(-=)?(commandLost|focusFire|volleyFire|volleyAimUsed)\b/.test(k));
  if (!allowed) return console.warn("Warhammer DBC | правка командования отклонена:", data.update);
  await doc.update(data.update);
}

// ── Срок Команд ─────────────────────────────────────────────────────────────

const OFF_SHORT  = p => ({ [`${p}shortCommand.active`]: false, [`${p}shortCommand.successes`]: 0 });
const OFF_DETAIL = p => ({ [`${p}detailCommand.active`]: false, [`${p}detailCommand.successes`]: 0,
                           [`${p}detailCommand.picks`]: [], [`${p}detailCommand.coverSuccesses`]: 0 });

/** Отдано этим боем и в раунде раньше текущего. */
const staleIn = (cmd, combat) => cmd?.active && cmd.combatId === combat.id && Number(cmd.round) < Number(combat.round);

/**
 * Начало Хода: Короткая/Детальная Команда того, чей Ход начался, истекают
 * («до начала следующего Хода Командира»). Брифинг (giverUuid "briefing")
 * — на смене Раунда. Зовёт ГМ из hooks.mjs.
 */
export async function expireCommandsAtTurnStart(combat) {
  const giver = combat?.combatant?.actor;
  for (const squad of game.actors ?? []) {
    if (squad.type !== "squad") continue;
    const s = squad.system.shortCommand, d = squad.system.detailCommand;
    const mine = cmd => giver && sameActor(giver, cmd?.giverUuid);
    const brief = cmd => cmd?.giverUuid === "briefing";
    const upd = {};
    if (staleIn(s, combat) && (mine(s) || brief(s))) Object.assign(upd, OFF_SHORT("system."));
    if (staleIn(d, combat) && mine(d)) Object.assign(upd, OFF_DETAIL("system."));
    if (Object.keys(upd).length) {
      if ("system.detailCommand.active" in upd) await removeTacticGrants(squad.uuid);
      await squad.update(upd);
    }
  }
  const c = giver?.system?.command;
  if (c) {
    const upd = {};
    if (staleIn(c.shortCommand, combat)) Object.assign(upd, OFF_SHORT("system.command."));
    if (staleIn(c.detailCommand, combat)) Object.assign(upd, OFF_DETAIL("system.command."));
    if (Object.keys(upd).length) {
      if ("system.command.detailCommand.active" in upd) await removeTacticGrants(giver.uuid);
      await giver.update(upd);
    }
  }
}

/** Конец боя: Присутствие («до конца боя») и всё отданное гаснут, метки Морали снимаются. */
export async function clearCommandsOnCombatEnd(combat) {
  const inCombat = new Set((combat?.combatants ?? []).map(c => c.actor?.uuid).filter(Boolean));
  const touches = squad => {
    const p = squad.system.posts || {};
    return [p.leader?.uuid, p.commander?.uuid, p.coordinator?.uuid, ...(squad.system.members || []).map(m => m.uuid)]
      .some(u => inCombat.has(u));
  };
  for (const squad of game.actors ?? []) {
    if (squad.type !== "squad" || !touches(squad)) continue;
    await removeTacticGrants(squad.uuid);
    await squad.update({ "system.presence.active": false, ...OFF_SHORT("system."), ...OFF_DETAIL("system.") });
  }
  for (const c of combat?.combatants ?? []) {
    const a = c.actor;
    if (!a) continue;
    if (a.system?.command) {
      await removeTacticGrants(a.uuid);
      await a.update({ "system.command.presence.active": false, ...OFF_SHORT("system.command."), ...OFF_DETAIL("system.command.") });
    }
    if (a.getFlag?.(NS, COMMAND_LOST_FLAG)) await a.unsetFlag(NS, COMMAND_LOST_FLAG);
  }
}

// ── Подчинённые узла ────────────────────────────────────────────────────────

/** Подчинённые-документы источника (Отряда или командира сброда), до кого доходят Команды. */
export function subordinatesOf(source, { moraleOnly = false } = {}) {
  const list = source?.type === "squad"
    ? (source.system.members || []).map(m => ({ uuid: m.uuid, moraleLost: !!m.moraleLost }))
    : (source?.system?.followers || []).map(f => ({ uuid: f.uuid, moraleLost: false }));
  return list.flatMap(e => liveDocsOf(e.uuid).map(doc => ({ e, doc }))).filter(({ e, doc }) => {
    if (!doc) return false;
    const reach = commandReachFor(doc.type, "", doc, { moraleLost: e.moraleLost || commandLostActive(doc) });
    if (reach.commands) return true;
    return moraleOnly && reach.moraleLost && !reach.blockedBy && doc.type !== "horde";
  }).map(({ doc }) => doc);
}

/** «Храбрость»: подчинённые сразу выходят из Подавления и Шока. */
export async function applyBraveryNow(source) {
  const freed = [];
  for (const doc of subordinatesOf(source, { moraleOnly: true })) {
    const c = doc.system?.conditions ?? {};
    const upd = {};
    if (c.pinned)  upd["system.conditions.pinned"] = false;
    if (c.shocked) upd["system.conditions.shocked"] = false;
    if (!Object.keys(upd).length) continue;
    await updateOrRelay(doc, upd);
    freed.push(doc.name);
  }
  return freed;
}

/** «Особая Тактика»: выдать Талант подчинённым на срок Команды. */
export async function grantTacticTalent(source, key) {
  const def = TACTIC_TALENTS.find(t => t.key === key);
  if (!def) return [];
  const talent = await fromUuid(`Compendium.warhammer-dbc.talents.Item.${def.id}`).catch(() => null);
  if (!talent) { ui.notifications?.warn(`Талант «${def.label}» не найден в компендиуме.`); return []; }
  const stamp = issueStamp();
  const given = [];
  for (const doc of subordinatesOf(source)) {
    if (doc.items?.some(i => i.type === "talent" && i.name === talent.name)) continue;
    if (!doc.isOwner) continue;               // выдача предметов — только владельцу или ГМу
    const data = talent.toObject();
    delete data._id;
    data.flags = { ...(data.flags ?? {}), [NS]: { ...(data.flags?.[NS] ?? {}),
      [TACTIC_FLAG]: { source: source.uuid },
      ...(stamp.combatId ? { tempGrant: { unit: "round", combatId: stamp.combatId, expiresAtRound: stamp.round + 1, label: `${talent.name} (Особая Тактика)` } } : {})
    } };
    await doc.createEmbeddedDocuments("Item", [data]);
    given.push(doc.name);
  }
  return given;
}

/** Снять Таланты «Особой Тактики», выданные этим источником. */
export async function removeTacticGrants(sourceUuid) {
  const source = resolve(sourceUuid);
  const list = source?.type === "squad"
    ? (source.system.members || []).map(m => m.uuid)
    : (source?.system?.followers || []).map(f => f.uuid);
  for (const doc of list.flatMap(liveDocsOf)) {
    const ids = (doc?.items ?? []).filter(i => i.flags?.[NS]?.[TACTIC_FLAG]?.source === sourceUuid).map(i => i.id);
    if (ids.length && doc.isOwner) await doc.deleteEmbeddedDocuments("Item", ids);
  }
}

// ── Мораль ──────────────────────────────────────────────────────────────────

/** Отряды, где актор раздаёт Команды как Командир или Лидер (не Координатор). */
function squadsCommandedBy(actor) {
  return (game.actors ?? []).filter(sq => {
    if (sq.type !== "squad") return false;
    const p = sq.system.posts || {};
    if (sameActor(actor, p.commander?.uuid)) return true;
    // Лидер: сам командует без Командира или делегировал ему авторитет.
    return sameActor(actor, p.leader?.uuid) && (!p.commander?.uuid || sq.system.delegated);
  });
}

const anyActive = c => !!(c?.presence?.active || c?.shortCommand?.active || c?.detailCommand?.active);

/**
 * Провален тест Морали. Подчинённый теряет преимущества Командования на
 * этот и следующий Раунд; Командир/Лидер — теряет все отданные Команды у
 * всех своих подчинённых (Координатор — нет). Карточка с кнопкой «Скрыть
 * трусость» хранит снимок отданного, чтобы вернуть его при успехе.
 */
export async function handleMoraleFailure(actor) {
  if (!actor || typeof game === "undefined") return;
  if (commandNodesFor(actor).length) {
    const combat = game.combat;
    await updateOrRelay(actor, { [`flags.${NS}.${COMMAND_LOST_FLAG}`]: { combatId: combat?.id ?? "", round: Number(combat?.round) || 0 } });
  }

  const snapshot = [];
  for (const sq of squadsCommandedBy(actor)) {
    const s = sq.system;
    if (!anyActive({ presence: s.presence, shortCommand: s.shortCommand, detailCommand: s.detailCommand })) continue;
    snapshot.push({ uuid: sq.uuid, prefix: "system.", data: foundry.utils.deepClone({
      presence: s.presence, shortCommand: s.shortCommand, detailCommand: s.detailCommand }) });
    await removeTacticGrants(sq.uuid);
    await updateOrRelay(sq, { "system.presence.active": false, ...OFF_SHORT("system."), ...OFF_DETAIL("system.") });
  }
  if (anyActive(actor.system?.command)) {
    snapshot.push({ uuid: actor.uuid, prefix: "system.command.", data: foundry.utils.deepClone(actor.system.command) });
    await removeTacticGrants(actor.uuid);
    await updateOrRelay(actor, { "system.command.presence.active": false, ...OFF_SHORT("system.command."), ...OFF_DETAIL("system.command.") });
  }
  if (!snapshot.length) return;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    flags: { [NS]: { commandSnapshot: { actorUuid: actor.uuid, entries: snapshot } } },
    content: `<div class="wh-roll-result sq-chat">
      <div class="roll-header">Командир дрогнул — ${esc(actor.name)}</div>
      <div class="roll-threshold">Провален тест Морали: подчинённые, заметившие это, теряют Присутствие и отданные Команды.</div>
      <div class="sq-chat-note">Скрыть трусость, выдав её за тактический манёвр (ГМ может запретить или дать штраф, если трусость слишком явная):</div>
      <div class="roll-defense-btns">
        <button type="button" class="wh-cmd-conceal" data-skill="charm">Charm(F)+0</button>
        <button type="button" class="wh-cmd-conceal" data-skill="deceive">Deceive(F)+0</button>
      </div></div>`
  });
}

/** Кнопка «Скрыть трусость»: тест Charm/Deceive(F)+0, успех возвращает Команды. */
export async function concealCowardice(message, skill) {
  const snap = message?.getFlag?.(NS, "commandSnapshot");
  const actor = resolve(snap?.actorUuid);
  if (!actor) return;
  if (!actor.isOwner) return ui.notifications?.warn("Скрыть трусость может только владелец командира.");
  if (snap.used) return ui.notifications?.info("Попытка уже сделана.");
  const { collectTestMods } = await import("../rules/roll-mods.mjs");
  const base = Number(actor.system?.skills?.[skill]?.total) || 0;
  const mods = collectTestMods(actor, { kind: "skill", skill, char: "fel" });
  const threshold = base + mods.total;
  const roll = await new Roll("1d100").evaluate();
  const ok = roll.total <= threshold;
  if (ok) {
    for (const e of snap.entries ?? []) {
      const doc = resolve(e.uuid);
      const flat = foundry.utils.flattenObject({ presence: e.data.presence, shortCommand: e.data.shortCommand, detailCommand: e.data.detailCommand });
      const upd = Object.fromEntries(Object.entries(flat).map(([k, v]) => [`${e.prefix}${k}`, v]));
      await updateOrRelay(doc, upd);
    }
  }
  if (message.isOwner) await message.setFlag(NS, "commandSnapshot", { ...snap, used: true });
  const label = skill === "charm" ? "Charm" : "Deceive";
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }), rolls: [roll],
    content: `<div class="wh-roll-result sq-chat">
      <div class="roll-header">Скрыть трусость — ${esc(actor.name)}</div>
      <div class="roll-threshold">${label}(F)+0: Порог <b>${threshold}</b>${mods.parts.length ? ` (${esc(mods.parts.join(", "))})` : ""} → бросок <b>${roll.total}</b></div>
      <div class="roll-outcome"><span class="${ok ? "roll-success" : "roll-failure"}">${ok
        ? "Успех — подчинённые приняли это за манёвр, Команды сохранены"
        : "Провал — трусость замечена, Командование потеряно"}</span></div></div>`
  });
}

// ── Эффекты, которые нужно «пощупать» в бою ────────────────────────────────

/** Узел, давший актору эффект Детальной Команды или Присутствия (presence:<key>). */
export function commandEffectOn(actor, key) {
  return commandEffectNode(actor, commandNodesFor(actor), key, { commandLost: commandLostActive(actor) });
}

/** Подчинённые-соседи по тому же узлу (Отряду/командиру) — документы. */
function nodeMatesOf(actor, node) {
  if (!node?.sourceUuid) return [];
  const source = resolve(node.sourceUuid);
  const me = actorIdentityUuids(actor);
  return subordinatesOf(source).filter(d => !me.has(d.uuid));
}

const tokenOf = actor => actor?.getActiveTokens?.(false)?.[0]?.document ?? actor?.token ?? null;

/**
 * После атаки подчинённого (combat/attack.mjs):
 *  - Синхронный Натиск: рукопашная, в базовом контакте с соратником — кнопка
 *    Давления свободным действием, +10 за каждого соратника в контакте;
 *  - Залповый Огонь: стрелковая (не метательная) атака по цели считается;
 *    на третьем и каждом следующем третьем стрелке — тест Подавления цели
 *    +20, −5 за каждые дополнительные три.
 */
export async function afterSubordinateAttack(actor, { isMelee, isThrown, defenderActor } = {}) {
  if (typeof game === "undefined" || !actor) return;
  if (isMelee) {
    const node = commandEffectOn(actor, "assault");
    if (!node) return;
    const me = tokenOf(actor);
    const { friendlyContactTokenDocs } = await import("./free-attack.mjs");
    const mates = new Set(nodeMatesOf(actor, node).map(d => d.uuid));
    const allies = me ? friendlyContactTokenDocs(me).filter(t => mates.has(t.actor?.uuid)).length : 0;
    if (!allies) return;
    const bonus = syncAssaultBonus(allies);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="wh-roll-result sq-chat"><div class="roll-header">Синхронный Натиск — ${esc(actor.name)}</div>
        <div class="roll-threshold">Соратников в базовом контакте: <b>${allies}</b> — Давление свободным действием, +${bonus}.</div>
        <div class="roll-defense-btns"><button type="button" class="wh-cmd-sync-press" data-actor-uuid="${actor.uuid}" data-bonus="${bonus}">Давление (+${bonus})</button></div></div>`
    });
    return;
  }
  if (isThrown || !defenderActor) return;
  const node = commandEffectOn(actor, "volley");
  if (!node) return;
  const combat = game.combat;
  const key = node.sourceUuid || node.label;
  const prev = defenderActor.getFlag?.(NS, "volleyFire");
  const same = prev && prev.combatId === (combat?.id ?? "") && prev.round === (Number(combat?.round) || 0) && prev.source === key;
  const shooters = new Set(same ? prev.shooters : []);
  shooters.add(actor.uuid);
  await updateOrRelay(defenderActor, { [`flags.${NS}.volleyFire`]: {
    combatId: combat?.id ?? "", round: Number(combat?.round) || 0, source: key, shooters: [...shooters] } });
  const n = shooters.size;
  if (n % 3 !== 0) return;
  const mod = volleySuppressionMod(n);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result sq-chat"><div class="roll-header">Залповый Огонь — ${esc(defenderActor.name)}</div>
      <div class="roll-threshold">По цели стреляли подчинённые: <b>${n}</b> — тест Подавления +${mod}.</div>
      <div class="roll-defense-btns"><button class="wh-suppression-test-btn" type="button" data-test-mod="${mod}">Тест Подавления (+${mod})</button></div></div>`
  });
}

/**
 * «Залповый Огонь»: доп. полудействие в Ход — только на Прицеливание из
 * стрелкового (не метательного) оружия. Раз в Ход подчинённого.
 * @returns {boolean} доступно ли сейчас (не тратит)
 */
export function volleyAimAvailable(actor) {
  if (!commandEffectOn(actor, "volley")) return false;
  const hasGun = (actor.items ?? []).some(i => i.type === "weapon"
    && !["melee", "thrown"].includes(String(i.system?.weaponClass ?? i.system?.class ?? "")));
  if (!hasGun) return false;
  const used = actor.getFlag?.(NS, "volleyAimUsed");
  const combat = game.combat;
  return !(used && used.combatId === combat?.id && used.round === combat?.round && used.turn === combat?.turn);
}

export async function markVolleyAimUsed(actor) {
  const combat = game.combat;
  await updateOrRelay(actor, { [`flags.${NS}.volleyAimUsed`]: {
    combatId: combat?.id ?? "", round: combat?.round ?? 0, turn: combat?.turn ?? 0 } });
}

/**
 * «Прикрытие»: нет своей Реакции на Избегание — берётся Реакция соратника по
 * тому же узлу в пределах 3 м («с их разрешения» — стол вправе отменить,
 * имя одолжившего пишется в чат). @returns {Promise<?Actor>} одолживший
 */
export async function borrowCoverReaction(actor) {
  const node = commandEffectOn(actor, "cover");
  if (!node) return null;
  const me = tokenOf(actor);
  if (!me) return null;
  const { tokenDistance } = await import("./facing.mjs");
  const { canSpendReaction, spendReaction } = await import("./action-economy.mjs");
  for (const mate of nodeMatesOf(actor, node)) {
    const t = tokenOf(mate);
    const d = t ? tokenDistance(me, t) : null;
    if (d == null || d > 3) continue;
    if (!canSpendReaction(mate, { forDefense: true })) continue;
    if (!await spendReaction(mate, { forDefense: true })) continue;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="wh-roll-result sq-chat"><div class="roll-threshold">Прикрытие: <b>${esc(mate.name)}</b> отдаёт свою Реакцию — ${esc(actor.name)} избегает атаки.</div></div>`
    });
    return mate;
  }
  return null;
}

/** «Прикрытие»: Парирование против врага на 1 Размер крупнее, чем обычно. */
export function coverParrySizeSteps(actor) {
  return commandEffectOn(actor, "cover") ? 1 : 0;
}

/**
 * Концентрация огня (Присутствие, эффект 2): выделенные подчинённые тройками
 * по одинаковому оружию; атакует тот, у кого меньше BS/WS. Метка focusFire
 * на атакующем: следующая атака этим оружием — +2 куба урона, −20 Избеганию.
 */
export async function declareFocusFire() {
  const actors = (canvas?.tokens?.controlled ?? []).map(t => t.actor).filter(Boolean);
  const ok = actors.filter(a => commandEffectOn(a, "presence:focus"));
  if (ok.length < 3)
    return ui.notifications?.warn("Концентрация огня: выделите на сцене трёх подчинённых под Присутствием «Концентрация огня».");
  const weaponsOf = a => (a.items ?? []).filter(i => i.type === "weapon").map(i => i.name);
  const trioBase = ok.slice(0, 3);
  const common = weaponsOf(trioBase[0]).filter(n => trioBase.slice(1).every(a => weaponsOf(a).includes(n)));
  if (!common.length) return ui.notifications?.warn("У троих нет одинакового оружия.");
  const weaponName = common[0];
  const item = trioBase[0].items.find(i => i.name === weaponName);
  const melee = String(item?.system?.weaponClass ?? item?.system?.class ?? "") === "melee";
  const skillOf = a => Number(a.system?.characteristics?.[melee ? "ws" : "bs"]?.total) || 0;
  const trio = [...trioBase].sort((a, b) => skillOf(a) - skillOf(b));
  const shooter = trio[0];
  await updateOrRelay(shooter, { [`flags.${NS}.focusFire`]: { weaponName, with: trio.map(a => a.name) } });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: shooter }),
    content: `<div class="wh-roll-result sq-chat"><div class="roll-header">Концентрация огня</div>
      <div class="roll-threshold">${esc(trio.map(a => a.name).join(", "))} — одна атака «${esc(weaponName)}» от <b>${esc(shooter.name)}</b> (наименьший ${melee ? "WS" : "BS"}) в самый поздний из их ходов Инициативы.</div>
      <div class="sq-chat-note">Попадания: −20 на все тесты Избегания и +2 куба урона — учтётся в атаке само. Двое других в этот Раунд этим оружием не атакуют.</div></div>`
  });
  return shooter;
}

/**
 * Контроль разума над бойцом Отряда (или его Командиром): и сам, и видевшие
 * сослуживцы — тест W+0 ± Слаженность, провал снимает преимущества
 * Командования (метка commandLost). Кнопки в чате — кто видел, решает стол.
 */
export async function offerMindControlTests(controlled) {
  if (typeof game === "undefined" || !controlled) return;
  const squads = (game.actors ?? []).filter(sq => sq.type === "squad" && (
    (sq.system.members || []).some(m => sameActor(controlled, m.uuid))
    || Object.values(sq.system.posts || {}).some(p => sameActor(controlled, p?.uuid))));
  for (const sq of squads) {
    const p = sq.system.posts || {};
    const uuids = [...new Set([controlled.uuid, p.leader?.uuid, p.commander?.uuid, p.coordinator?.uuid,
      ...(sq.system.members || []).map(m => m.uuid)].filter(Boolean))];
    const buttons = uuids.map(u => resolve(u)).filter(Boolean).map(a =>
      `<button type="button" class="wh-cmd-mindcontrol" data-actor-uuid="${a.uuid}" data-squad-uuid="${sq.uuid}">${esc(a.name)}</button>`).join("");
    const coh = Number(sq.system.cohesion?.value) || 0;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: controlled }),
      content: `<div class="wh-roll-result sq-chat"><div class="roll-header">Контроль разума в отряде «${esc(sq.name)}»</div>
        <div class="roll-threshold">${esc(controlled.name)} действует под чужим контролем. Сам он и видевшие это сослуживцы — тест W+0 ${coh >= 0 ? "+" : ""}${coh} (Слаженность), провал — потеря преимуществ Командования.</div>
        <div class="roll-defense-btns">${buttons}</div></div>`
    });
  }
}

/** Кнопка теста W ± Слаженность (контроль разума). */
export async function rollMindControlTest(actor, squad) {
  if (!actor) return;
  const { collectTestMods } = await import("../rules/roll-mods.mjs");
  const wp = Number(actor.system?.characteristics?.wp?.total) || 0;
  const coh = Number(squad?.system?.cohesion?.value) || 0;
  const mods = collectTestMods(actor, { kind: "skill", char: "wp" });
  const threshold = wp + coh + mods.total;
  const roll = await new Roll("1d100").evaluate();
  const ok = roll.total <= threshold;
  if (!ok) {
    const combat = game.combat;
    await updateOrRelay(actor, { [`flags.${NS}.${COMMAND_LOST_FLAG}`]: { combatId: combat?.id ?? "", round: Number(combat?.round) || 0 } });
  }
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }), rolls: [roll],
    content: `<div class="wh-roll-result sq-chat"><div class="roll-header">Контроль разума — ${esc(actor.name)}</div>
      <div class="roll-threshold">W ${wp} ${coh >= 0 ? "+" : ""}${coh} (Слаженность)${mods.parts.length ? `, ${esc(mods.parts.join(", "))}` : ""} → Порог <b>${threshold}</b>, бросок <b>${roll.total}</b></div>
      <div class="roll-outcome"><span class="${ok ? "roll-success" : "roll-failure"}">${ok
        ? "Успех — доверие к отряду выдержало" : "Провал — преимущества Командования потеряны (этот и следующий Раунд)"}</span></div></div>`
  });
  return ok;
}
