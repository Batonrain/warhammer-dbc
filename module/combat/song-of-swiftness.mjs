// module/combat/song-of-swiftness.mjs
// ════════════════════════════════════════════════════════════════════════
//  Song of Swiftness/Песня Стремительности (Талант Певцов Кости, wdbc-sk8s):
//  «За Полное действие... Одна психокостяная техника в радиусе W м до конца
//  боя получает +F.b к скорости и +F.b×2 к манёвренности; либо радиус 10 м
//  — +½F.b к скорости и +F.b к манёвренности. Количество получаемой скорости
//  и манёвренности уменьшается только у сверхтяжёлой техники — до +⅓F.b к
//  скорости и ½F.b к манёвренности. Персонаж с путём Мастера ускоряет их все
//  так же одинаково. До 3 раз за сессию.» (сверхтяжёлая = Размер 6+, тот же
//  порог, что constants/weapon-properties.mjs::vortex «кроме Сверхтяжёлой
//  Size 6+»; числа масштабирования — правки автора книги от 31.08.2026,
//  снявшие блокировку с wdbc-sk8s).
//
//  Реализовано как встроенный (embedded) Item типа "vehicleTrait" с
//  system.effects.{spdMod,manoeuvreMod} — та же агрегация, что читают
//  Черты техники (module/rules/vehicle.mjs::prepareVehicleDerived), сходу
//  суммируется в эффективные SPD/Манёвренность без правок самого движка.
//  Снимается по concу боя (Hooks.on("deleteCombat"), тот же приём, что и
//  метка Аватара Резни/транс Духа героя).
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "../rules/predicates.mjs";
import { hasAbility } from "../rules/ability-by-key.mjs";
import { isThrottleCountAvailable, incrementThrottleCount } from "../rules/cooldown.mjs";
import { tokensWithinRadius } from "../rules/aoe-target.mjs";
import { isBonesingerMaster } from "./bone-song.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

const FLAG = "songOfSwiftness";
const TRAIT_FLAG = "songOfSwiftnessTrait";
const SUPERHEAVY_SIZE = 6;

/** Владеет ли актор Талантом Song of Swiftness / Песня Стремительности. */
export function hasSongOfSwiftness(actor) {
  return hasAbility(actor, "ability.songOfSwiftness", "Song of Swiftness", "talent");
}

/** Лимит использований за сессию — фиксированный, 3 (не зависит от F.b). */
export function songOfSwiftnessMax() { return 3; }

export function songOfSwiftnessAvailable(actor) {
  return hasSongOfSwiftness(actor) && isThrottleCountAvailable(actor, FLAG, "session", songOfSwiftnessMax());
}

/** +SPD/+Манёвренность для одной цели — {spd, man}, с учётом Размера 6+ (сверхтяжёлая) и Мастера. */
export function songOfSwiftnessBonus(actor, size, branch) {
  const felBonus = Number(actor?.system?.characteristics?.fel?.bonus) || 0;
  const superheavy = (Number(size) || 0) >= SUPERHEAVY_SIZE && !isBonesingerMaster(actor);
  if (superheavy) {
    return { spd: Math.ceil(felBonus / 3), man: Math.ceil(felBonus / 2) };
  }
  if (branch === "area") return { spd: Math.ceil(felBonus / 2), man: felBonus };
  return { spd: felBonus, man: felBonus * 2 };
}

async function grantBuff(vehicleActor, { spd, man }) {
  const created = await vehicleActor.createEmbeddedDocuments("Item", [{
    name: "Song of Swiftness / Песня Стремительности",
    type: "vehicleTrait",
    img: "systems/warhammer-dbc/assets/actor-icons/vehicle.svg",
    system: { effects: { spdMod: spd, manoeuvreMod: man } }
  }]);
  const itemId = created[0]?.id;
  const flagList = vehicleActor.getFlag("warhammer-dbc", TRAIT_FLAG) || [];
  await vehicleActor.setFlag("warhammer-dbc", TRAIT_FLAG, [...flagList, itemId]);
}

/** Снимает встроенные бонусы Песни Стремительности со всех актёров боя — звать в module/hooks.mjs::deleteCombat. */
export async function clearSongOfSwiftnessBuffs(combat) {
  for (const c of combat?.combatants ?? []) {
    const actor = c.actor;
    const ids = actor?.getFlag?.("warhammer-dbc", TRAIT_FLAG);
    if (!ids?.length) continue;
    const existing = ids.filter(id => actor.items.get(id));
    if (existing.length) await actor.deleteEmbeddedDocuments("Item", existing);
    await actor.unsetFlag("warhammer-dbc", TRAIT_FLAG);
  }
}

async function spendAndCount(actor) {
  await incrementThrottleCount(actor, FLAG, "session", songOfSwiftnessMax());
}

/** Одиночная цель. */
export async function applySongOfSwiftnessSingle(actor, targetActor) {
  await spendAndCount(actor);
  const size = Number(targetActor.system?.size) || 0;
  const { spd, man } = songOfSwiftnessBonus(actor, size, "single");
  await grantBuff(targetActor, { spd, man });

  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("run", "#7fd3ff")}Песня Стремительности — ${esc(targetActor.name)}</div>
      <div class="roll-threshold">+${spd} SPD, +${man} Манёвренность до конца боя${size >= SUPERHEAVY_SIZE ? " (сверхтяжёлая — снижено)" : ""}</div>
    </div>`
  }, game.settings.get("core", "rollMode")));
}

/** Область (радиус 10 м). */
export async function applySongOfSwiftnessArea(actor, casterToken) {
  await spendAndCount(actor);
  const inRange = tokensWithinRadius(casterToken, 10, { actorType: "vehicle" });

  const lines = [];
  for (const tokenDoc of inRange) {
    const vehicleActor = tokenDoc.actor;
    const size = Number(vehicleActor.system?.size) || 0;
    const { spd, man } = songOfSwiftnessBonus(actor, size, "area");
    await grantBuff(vehicleActor, { spd, man });
    lines.push(`${esc(vehicleActor.name)}: +${spd} SPD, +${man} Манёвренность${size >= SUPERHEAVY_SIZE ? " (сверхтяжёлая)" : ""}`);
  }

  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("run", "#7fd3ff")}Песня Стремительности — область (радиус 10 м)</div>
      <div class="roll-threshold">До конца боя</div>
      ${lines.length ? lines.map(l => `<div>${l}</div>`).join("") : "<div><i>Нет техники в радиусе</i></div>"}
    </div>`
  }, game.settings.get("core", "rollMode")));
}
