// module/combat/worm-master.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Повелитель Червей (rules/worm-master.mjs). Кнопка Черты зовёт useWormMaster:
//  проверяет предел Cor.b активных Роёв на сцене, списывает полное действие в бою,
//  бросает W−10; при Успехе Рой из Бестиария встаёт рядом (спавнит ГМ — Бестиарий
//  игроку закрыт; сокет summonWormSwarm), получает +10 Ран за каждый Успех после
//  первого и метку хозяина. Поддержание (Sahara 584-1d5-r): в начале Хода в бою,
//  пока хоть один Рой под прямым контролем, — карточка «полудействие / 1d5 R /
//  рассеять» (wormUpkeepTurnStart, кнопки — hooks.mjs .wh-worm-upkeep-btn).
// ════════════════════════════════════════════════════════════════════════════

import { hasWormMaster, wormSwarmCap, wormSwarmBonusWounds, sanitizeWormBonus,
         WORM_SWARM_NAME, WORM_SWARM_FLAG, WORM_MASTER_MOD } from "../rules/worm-master.mjs";
import { isReleasedSwarm } from "../rules/worm-king-talents.mjs";
import { spawnDemonOnScene } from "../apps/demon-summon.mjs";
import { rollTraitTest } from "./trait-test.mjs";
import { hasActionEconomy, canSpendActionPoints, spendActionPoints } from "./action-economy.mjs";
import { payActions } from "./cult-common.mjs";
import { applyWoundLoss } from "../rules/wounds.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { esc } from "../helpers/utils.mjs";

const NS = "warhammer-dbc";

export function activeSwarmsOf(master) {
  if (!master?.uuid) return [];
  // Свободный Скиталец (Король Червей): отпущенный Рой в лимит Cor.b не входит.
  return [...(game.actors ?? [])].filter(a => a.getFlag?.(NS, WORM_SWARM_FLAG) === master.uuid
    && !isReleasedSwarm(a) && a.getActiveTokens?.(false, true)?.length);
}

/** Только ГМ: Рой на сцену, Раны, метка хозяина. */
export async function spawnWormSwarm(masterUuid, bonusWounds = 0) {
  const master = await fromUuid(masterUuid).catch(() => null);
  if (!master || !hasWormMaster(master)) return { ok: false, reason: "Повелитель Червей не найден." };
  if (activeSwarmsOf(master).length >= wormSwarmCap(master)) return { ok: false, reason: "Предел Роёв (Cor.b) уже достигнут." };
  const res = await spawnDemonOnScene(WORM_SWARM_NAME, masterUuid);
  if (!res.ok) return res;
  const swarm = res.actorUuid ? await fromUuid(res.actorUuid).catch(() => null) : null;
  if (swarm) {
    const bonus = sanitizeWormBonus(bonusWounds);
    const w = swarm.system?.wounds ?? {};
    await swarm.update({
      [`flags.${NS}.${WORM_SWARM_FLAG}`]: masterUuid,
      ...(bonus ? { "system.wounds.max": (Number(w.max) || 0) + bonus, "system.wounds.value": (Number(w.value) || 0) + bonus } : {})
    });
  }
  return res;
}

export async function useWormMaster(actor) {
  if (!actor || !hasWormMaster(actor)) return ui.notifications.warn("⚠️ У актора нет Черты Повелитель Червей.");
  const cap = wormSwarmCap(actor);
  const active = activeSwarmsOf(actor).length;
  if (active >= cap) return ui.notifications.warn(`⚠️ ${actor.name}: уже ${active} Роёв из ${cap} (Cor.b).`);
  if (hasActionEconomy(actor) && game.combat?.started) {
    if (!canSpendActionPoints(actor, 2, { physical: false })) return ui.notifications.warn(`⚠️ ${actor.name}: нужно полное действие.`);
    if (!await spendActionPoints(actor, 2, { physical: false })) return;
  }
  const r = await rollTraitTest(actor, {
    char: "wp", mod: WORM_MASTER_MOD, icon: "🪱", title: "Повелитель Червей",
    success: "Рядом поднимается Извивающийся Рой.", failure: "Рой не собрался."
  });
  if (!r.success) return r;
  const bonus = wormSwarmBonusWounds(r.deg);
  if (game.user?.isGM) {
    const res = await spawnWormSwarm(actor.uuid, bonus);
    if (!res.ok) ui.notifications.warn(res.reason);
  } else if (game.users?.activeGM) {
    game.socket?.emit("system.warhammer-dbc", { action: "summonWormSwarm", userId: game.user.id, masterUuid: actor.uuid, bonusWounds: bonus });
  } else {
    ui.notifications.warn(`Нет активного Мастера — Рой (+${bonus} Ран) нужно разместить вручную.`);
  }
  return r;
}

// ── Поддержание и рассеивание (Sahara 584-1d5-r) ──────────────────────────
//  Книга: «каждый Ход в бою, пока хотя бы один Рой активен, должен либо
//  тратить полудействие, либо получать 1d5 непоглощаемого R урона. Может
//  рассеять любое число Роёв за свободное действие». Отпущенный Свободным
//  Скитальцем Рой не «под контролем» — activeSwarmsOf его не считает, и цены
//  за него нет.

export const WORM_UPKEEP_DAMAGE = "1d5";

/** Начало Хода Повелителя в бою: есть Рой — карточка выбора. true — карточка выложена. */
export async function wormUpkeepTurnStart(actor) {
  if (!actor || !hasWormMaster(actor) || !game.combat?.started) return false;
  const swarms = activeSwarmsOf(actor);
  if (!swarms.length) return false;
  const btn = (mode, label, title) => `<button type="button" class="wh-worm-upkeep-btn" data-actor-uuid="${esc(actor.uuid)}" data-mode="${mode}" title="${esc(title)}">${label}</button>`;
  await postTestCard(actor, {
    icon: "🪱 ", title: `Повелитель Червей: поддержание Роя — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">Под контролем Роёв: <b>${swarms.length}</b>. В этот Ход — полудействие или ${WORM_UPKEEP_DAMAGE} непоглощаемого R урона; либо рассеять Рои (свободное действие).</div>`],
    sections: [`<div class="roll-defense-btns">${[
      btn("half", "Полудействие", "Потратить полудействие на поддержание Роя"),
      btn("damage", `${WORM_UPKEEP_DAMAGE} R урона`, "Получить 1d5 непоглощаемого R урона"),
      btn("dismiss", "Рассеять Рои", "Свободное действие: все Рои под прямым контролем исчезают")
    ].join(" ")}</div>`]
  }, { sound: false });
  return true;
}

/**
 * Рассеять Рои под прямым контролем: ГМ удаляет их токены и акторов (Рой —
 * актор, созданный призывом, spawnWormSwarm); игрок просит ГМа сокетом.
 * @returns {Promise<number>} сколько Роёв рассеяно (у игрока — сколько попросил)
 */
export async function dismissWormSwarms(actor) {
  const swarms = activeSwarmsOf(actor);
  if (!swarms.length) return 0;
  if (!game.user?.isGM) {
    if (!game.users?.activeGM) { ui.notifications?.warn("Нет активного Мастера — Рои уберите вручную."); return 0; }
    game.socket?.emit("system.warhammer-dbc", { action: "dismissWormSwarms", userId: game.user?.id, masterUuid: actor.uuid });
    return swarms.length;
  }
  for (const s of swarms) {
    for (const t of s.getActiveTokens?.(false, true) ?? []) await t.delete?.();
    await s.delete?.();
  }
  return swarms.length;
}

/** Кнопка карточки поддержания: "half" | "damage" | "dismiss". true — выбор сделан. */
export async function wormUpkeep(actor, mode) {
  if (!actor) return false;
  if (mode === "half") {
    if (!await payActions(actor, 1, { what: "Поддержание Роя" })) return false;
    await postTestCard(actor, { icon: "🪱 ", title: `Повелитель Червей — ${esc(actor.name)}`,
      lines: [`<div class="roll-threshold">Рой поддержан: потрачено полудействие.</div>`] }, { sound: false });
    return true;
  }
  if (mode === "damage") {
    const roll = await new Roll(WORM_UPKEEP_DAMAGE).evaluate();
    const loss = await applyWoundLoss(actor, roll.total);
    await postTestCard(actor, { icon: "🪱 ", title: `Повелитель Червей — ${esc(actor.name)}`,
      lines: [`<div class="roll-threshold">Рой поддержан ценой плоти: <b>${roll.total}</b> непоглощаемого R урона (Раны ${loss?.currentWounds ?? "?"} → ${loss?.newWounds ?? "?"}).</div>`] },
      { rolls: [roll], sound: false });
    return true;
  }
  if (mode === "dismiss") {
    const n = await dismissWormSwarms(actor);
    if (!n) return false;
    await postTestCard(actor, { icon: "🪱 ", title: `Повелитель Червей — ${esc(actor.name)}`,
      lines: [`<div class="roll-threshold">Рассеяно Роёв: <b>${n}</b> (свободное действие).</div>`] }, { sound: false });
    return true;
  }
  return false;
}
