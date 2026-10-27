// module/combat/warp-lock.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Варп-Замок (Талант Псайканы, Sahara 3-28, пачка I2) — Foundry-обвязка к rules/warp-lock.mjs.
//
//   • «аварийный» — кнопка под Феноменом/Прорывом на карточке манифестации и на карточке
//     переброса Усмирения Варпа: Феномен/Прорыв игнорируются, 1d5 непоглощаемого E в голову,
//     все поддерживаемые силы развеяны, метка «не псайкер» до начала следующего Хода;
//   • «подавить потенциал» — кнопка на вкладке МИСТИКА, в начале своего Хода, без урона;
//   • «раз в час» — по game.time.worldTime, учёт флагом на Таланте, ручной сброс там же.
//  Пишется только в актора-владельца Таланта; чужие акторы не затрагиваются.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { applyWoundLoss } from "../rules/wounds.mjs";
import { getCriticalEffect } from "../../critical-tables.mjs";
import { isEncounterActive, isOwnTurn } from "./action-economy.mjs";
import { runCardOnce } from "./card-once.mjs";
import { dispelAllSustained } from "./psychic-sustain.mjs";
import {
  WARP_LOCK_FLAG, WARP_LOCK_USES_FLAG, WARP_LOCK_DAMAGE_FORMULA, hasWarpLock, warpLockTalent,
  warpLockGate, warpLockUses, warpLockRecord, warpLockResetUses
} from "../rules/warp-lock.mjs";

const NS = "warhammer-dbc";

/** Ключ отметки на карточке (белый список сокета — card-once.mjs::CARD_ONCE_FLAGS). */
export const WARP_LOCK_CARD_FLAG = "warpLockUsed";

const now = () => Number(game.time?.worldTime) || 0;

/**
 * Кнопка под Феноменом/Прорывом (видна только владельцу носителя Таланта — .wh-owner-only прячет
 * её остальным, hooks.mjs). Пустая строка — Таланта нет.
 */
export function warpLockButtonsHtml(actor) {
  if (!hasWarpLock(actor)) return "";
  return `<div class="roll-threshold wh-owner-only wh-warplock" data-actor-uuid="${esc(actor.uuid)}">
    <button type="button" class="wh-warplock-btn" data-actor-uuid="${esc(actor.uuid)}" data-kind="emergency"
      title="Варп-Замок: раз в час игнорировать Феномен или Прорыв — 1d5 непоглощаемого E в голову, все поддерживаемые психосилы развеиваются, до начала следующего Хода вы не псайкер и не можете манифестировать">
      ${rollIcon("shield", "#9d7cd8")}Варп-Замок: игнорировать Феномен/Прорыв (1d5 E в голову, не псайкер до начала Хода)
    </button>
  </div>`;
}

/**
 * Применить Варп-Замок.
 * @param {Actor} actor
 * @param {"emergency"|"suppress"} kind
 * @returns {Promise<boolean>} применён ли
 */
export async function applyWarpLock(actor, kind) {
  const gate = warpLockGate(actor, kind, now());
  if (!gate.ok) { ui.notifications?.warn(gate.reason); return false; }
  if (kind === "suppress" && isEncounterActive() && !isOwnTurn(actor)) {
    ui.notifications?.warn("Варп-Замок: подавить потенциал можно только в начале своего Хода.");
    return false;
  }
  const emergency = kind === "emergency";
  const lines = [];
  const rolls = [];

  if (emergency) {
    const roll = await new Roll(WARP_LOCK_DAMAGE_FORMULA).evaluate();
    rolls.push(roll);
    const res = await applyWoundLoss(actor, roll.total);
    lines.push(`<div class="roll-threshold">${rollIcon("burst", "#ff6b6b")}Рывок прочь из Варпа: <b>${WARP_LOCK_DAMAGE_FORMULA}</b> = <b style="color:#8b0000;">${roll.total}</b> непоглощаемого E Dmg в голову (Раны ${res.currentWounds} → ${res.newWounds}).</div>`);
    if (res.gotCritical) {
      const crit = getCriticalEffect("energy", "Голова", res.newCritical);
      lines.push(`<div class="dmg-critical-block"><b>Критический урон</b> · отрицательные раны: <b>${res.newCritical}</b>${crit ? `<div class="roll-crit-effect">${crit}</div>` : ""}</div>`);
    }
  }

  const dispelled = await dispelAllSustained(actor);
  lines.push(`<div class="roll-threshold">${dispelled.length
    ? `Развеяны поддерживаемые силы: <b>${dispelled.map(esc).join(", ")}</b>.`
    : "Поддерживаемых сил не было."}</div>`);

  await actor.setFlag(NS, WARP_LOCK_FLAG, true);
  const talent = warpLockTalent(actor);
  if (talent) await talent.setFlag(NS, WARP_LOCK_USES_FLAG, warpLockRecord(warpLockUses(actor), kind, now()));

  lines.push(`<div class="roll-threshold" style="font-size:0.85em;">До начала своего следующего Хода ${esc(actor.name)} теряет Трейт Psyker и <b>не может манифестировать психосилы</b>.${isEncounterActive() ? "" : " Вне боя Хода нет — снимите метку кнопкой на вкладке МИСТИКА, когда пора."}</div>`);
  if (emergency) lines.push(`<div class="roll-threshold" style="font-size:0.85em;">Выпавший Феномен/Прорыв игнорируется. Порча Варп-Шока, уже начисленная карточкой манифестации, остаётся — откатить её, если ГМ решит иначе, нужно вручную.</div>`);

  await postTestCard(actor, {
    icon: rollIcon("shield", "#9d7cd8"),
    title: `Варп-Замок — ${emergency ? "игнорировать Феномен/Прорыв" : "подавить потенциал"} — ${esc(actor.name)}`,
    lines
  }, { rolls, sound: false });
  return true;
}

/** Клик по кнопке карточки Феномена/Прорыва. */
export async function handleWarpLockClick(message, btn) {
  let actor = null;
  try { actor = await fromUuid(btn.dataset.actorUuid); } catch { actor = null; }
  if (actor && !(actor instanceof Actor)) actor = actor.actor ?? null;
  if (!actor?.isOwner) { ui.notifications?.warn("Варп-Замок применяет владелец псайкера (или ГМ)."); return false; }
  const gate = warpLockGate(actor, "emergency", now());
  if (!gate.ok) { ui.notifications?.warn(gate.reason); return false; }
  const ok = await foundry.applications.api.DialogV2.confirm({
    window: { title: `Варп-Замок — ${actor.name}` },
    content: `<p>Игнорировать выпавший Феномен/Прорыв? Цена: 1d5 непоглощаемого E в голову, все поддерживаемые силы развеиваются, до начала следующего Хода вы не можете манифестировать.</p>`,
    yes: { label: "Да, оборвать связь" }, no: { label: "Отмена" }, rejectClose: false
  });
  if (!ok) return false;
  return runCardOnce(message, WARP_LOCK_CARD_FLAG, () => applyWarpLock(actor, "emergency"),
    "С этой карточки Варп-Замок уже применён.");
}

/** Ручной сброс счётчика часа («раз в час» — по игровому времени, ГМ/игрок обнуляет сам). */
export async function resetWarpLockHour(actor) {
  const talent = warpLockTalent(actor);
  if (!talent) return false;
  await talent.setFlag(NS, WARP_LOCK_USES_FLAG, warpLockResetUses());
  ui.notifications?.info("Варп-Замок: счётчик часа сброшен.");
  return true;
}

/** Снять метку «не псайкер» (вне боя её гасит только игрок/ГМ). */
export async function clearWarpLockMark(actor) {
  if (!actor?.getFlag?.(NS, WARP_LOCK_FLAG)) return false;
  await actor.unsetFlag(NS, WARP_LOCK_FLAG);
  return true;
}
