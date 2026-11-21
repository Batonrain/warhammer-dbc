// module/combat/worm-master.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Повелитель Червей (rules/worm-master.mjs). Кнопка Черты зовёт useWormMaster:
//  проверяет предел Cor.b активных Роёв на сцене, списывает полное действие в бою,
//  бросает W−10; при Успехе Рой из Бестиария встаёт рядом (спавнит ГМ — Бестиарий
//  игроку закрыт; сокет summonWormSwarm), получает +10 Ран за каждый Успех после
//  первого и метку хозяина. Поддержание (полудействие или 1d5 R каждый Ход) и
//  рассеивание ведёт стол.
// ════════════════════════════════════════════════════════════════════════════

import { hasWormMaster, wormSwarmCap, wormSwarmBonusWounds, sanitizeWormBonus,
         WORM_SWARM_NAME, WORM_SWARM_FLAG, WORM_MASTER_MOD } from "../rules/worm-master.mjs";
import { isReleasedSwarm } from "../rules/worm-king-talents.mjs";
import { spawnDemonOnScene } from "../apps/demon-summon.mjs";
import { rollTraitTest } from "./trait-test.mjs";
import { hasActionEconomy, canSpendActionPoints, spendActionPoints } from "./action-economy.mjs";

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
