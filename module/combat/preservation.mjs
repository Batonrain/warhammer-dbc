// module/combat/preservation.mjs
// ════════════════════════════════════════════════════════════════════════
//  Preservation/Защита (Талант Певцов Кости, wdbc-sk8s): «За Полное
//  действие... Одна психокостяная техника в радиусе W м получает
//  неперегружаемый колдовской щит-дефлектор 1-50/− (складывается с другими
//  щитами); либо радиус 10 м — щит-купол 1-35/−. За каждый Размер после
//  3-ёх рейтинг падает на −10. До F.b раз за сессию.» (правило масштабирования
//  по Размеру — правка автора книги от 31.08.2026, снявшая блокировку с
//  wdbc-sk8s).
//
//  Реализовано как встроенный (embedded) Item типа "forcefield" на технике —
//  тот же тип, что читает combat/damage.mjs::_rollActiveShield (rating/
//  overloadThreshold/shieldType/shieldNature), сходу работает в существующем
//  конвейере урона. «Неперегружаемый» = overloadThreshold 0.
//  «Складывается с другими щитами» — НЕ смоделировано: _rollActiveShield
//  берёт только САМЫЙ мощный активный щит техники (сортировка по
//  currentRating, [0]), движок не суммирует несколько щитов одновременно —
//  это ограничение существующего конвейера, не добавлено этой правкой.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "../rules/predicates.mjs";
import { isThrottleCountAvailable, incrementThrottleCount } from "../rules/cooldown.mjs";
import { tokensWithinRadius } from "../rules/aoe-target.mjs";
import { isBonesingerMaster } from "./bone-song.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

const FLAG = "preservation";

/** Владеет ли актор Талантом Preservation / Защита. */
export function hasPreservation(actor) {
  return !!actor?.items?.some(i => i.type === "talent" && itemHasName(i, "Preservation"));
}

/** Лимит использований за сессию — F.b (минимум 1). */
export function preservationMax(actor) {
  return Math.max(1, Number(actor?.system?.characteristics?.fel?.bonus) || 0);
}

export function preservationAvailable(actor) {
  return hasPreservation(actor) && isThrottleCountAvailable(actor, FLAG, "session", preservationMax(actor));
}

/** −10 рейтинга за каждый Размер после 3-ёх (Размер 4 → −10, 5 → −20, …). Мастер не снижает. */
export function preservationSizeReduction(actor, size) {
  const s = Number(size) || 0;
  if (s <= 3 || isBonesingerMaster(actor)) return 0;
  return (s - 3) * 10;
}

async function grantShield(vehicleActor, { shieldType, ratingMax, reduction }) {
  const rating = Math.max(0, ratingMax - reduction);
  await vehicleActor.createEmbeddedDocuments("Item", [{
    name: `Preservation / Защита (${shieldType === "dome" ? "Купол" : "Дефлектор"})`,
    type: "forcefield",
    img: "systems/warhammer-dbc/assets/item-icons/forcefield.svg",
    system: {
      shieldNature: "warp", shieldType,
      ratingMin: 1, ratingMax: rating, overloadThreshold: 0,
      currentRating: rating, isSpecialRating: false,
      equipped: true, status: "active", quality: "common", availability: 0, weight: 0
    }
  }]);
  return rating;
}

async function spendAndCount(actor) {
  await incrementThrottleCount(actor, FLAG, "session", preservationMax(actor));
}

/** Одиночная цель — щит-дефлектор, база 1-50/−. */
export async function applyPreservationSingle(actor, targetActor) {
  await spendAndCount(actor);
  const size = Number(targetActor.system?.size) || 0;
  const reduction = preservationSizeReduction(actor, size);
  const rating = await grantShield(targetActor, { shieldType: "deflector", ratingMax: 50, reduction });

  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("shield", "#7fd3ff")}Защита — ${esc(targetActor.name)}</div>
      <div class="roll-threshold">Щит-дефлектор ${rating}-/− ${reduction ? `(база 50 − ${reduction}, Размер ${size})` : ""}</div>
    </div>`
  }, game.settings.get("core", "rollMode")));
}

/** Область (радиус 10 м) — щит-купол, база 1-35/− каждой технике. */
export async function applyPreservationArea(actor, casterToken) {
  await spendAndCount(actor);
  const inRange = tokensWithinRadius(casterToken, 10, { actorType: "vehicle" });

  const lines = [];
  for (const tokenDoc of inRange) {
    const vehicleActor = tokenDoc.actor;
    const size = Number(vehicleActor.system?.size) || 0;
    const reduction = preservationSizeReduction(actor, size);
    const rating = await grantShield(vehicleActor, { shieldType: "dome", ratingMax: 35, reduction });
    lines.push(`${esc(vehicleActor.name)}: щит-купол ${rating}-/−${reduction ? ` (−${reduction}, Размер ${size})` : ""}`);
  }

  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("shield", "#7fd3ff")}Защита — область (радиус 10 м)</div>
      ${lines.length ? lines.map(l => `<div>${l}</div>`).join("") : "<div><i>Нет техники в радиусе</i></div>"}
    </div>`
  }, game.settings.get("core", "rollMode")));
}
