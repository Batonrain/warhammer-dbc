// module/rules/warp-lock.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ВАРП-ЗАМОК / Warp Lock (Талант Псайканы, Sahara 3-28, пачка I2, решение владельца
//  26.10.2026: «по игровому времени»).
//
//  Книга: «Один раз в час он может игнорировать выпавший ему Феномен или Прорыв. Однако … он
//  получает 1d5 непоглощаемого E Dmg в голову, все поддерживаемые им психосилы развеиваются и до
//  начала своего следующего Хода он теряет Трейт Psyker и не может манифестировать психосилы.
//  Персонаж может использовать этот Талант, чтобы на краткое время подавить свой психический
//  потенциал в более контролируемом формате. Он использует этот Талант в начале своего Хода и не
//  получает урона, но в остальном эффект аналогичен «аварийному» использованию Варп-Замка. …
//  не более W.b раз в час.»
//
//  Как собрано:
//   • «раз в час» — по game.time.worldTime (виджет «Летоисчисление» двигает его сам): время
//     последнего аварийного применения и список моментов подавлений лежат флагом на самом Таланте
//     (warpLockUses). Ручной сброс — кнопка на вкладке МИСТИКА (WarpLockUses → пусто);
//   • метка «не псайкер» — флаг актора warpLockActive в реестре «до начала следующего Хода»
//     (rules/turn-flags.mjs); пока она стоит, окно манифестации не открывается и поддержание не
//     включается (sheets/tabs/psychic.mjs). Вне боя гасить её некому — кнопка «снять метку».
//
//  Чистый модуль без Foundry; Foundry-обвязка — combat/warp-lock.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";
import { worldTimeRemaining } from "./cooldown.mjs";

const NS = "warhammer-dbc";

/** Метка актора: «до начала следующего Хода теряет Трейт Psyker и не может манифестировать». */
export const WARP_LOCK_FLAG = "warpLockActive";
/** Флаг Таланта: { emergencyAt: worldTime|null, suppressAt: worldTime[] }. */
export const WARP_LOCK_USES_FLAG = "warpLockUses";
/** «Раз в час» — игровой час в секундах. */
export const WARP_LOCK_PERIOD = 3600;
/** «1d5 непоглощаемого E Dmg в голову». */
export const WARP_LOCK_DAMAGE_FORMULA = "1d5";

const isWarpLock = i => itemHasName(i, "Warp Lock") || itemHasName(i, "Варп-Замок");

export function warpLockTalent(actor) {
  return [...(actor?.items ?? [])].find(i => i?.type === "talent" && isWarpLock(i)) ?? null;
}
export function hasWarpLock(actor) { return !!warpLockTalent(actor); }

const flagOf = (doc, key) => doc?.getFlag?.(NS, key) ?? doc?.flags?.[NS]?.[key];

/** Стоит ли метка «не псайкер». Не зависит от Таланта: это состояние персонажа. */
export function warpLockActive(actor) { return !!flagOf(actor, WARP_LOCK_FLAG); }
/** Манифестация запрещена. */
export function warpLockBlocksManifest(actor) { return warpLockActive(actor); }

/** Учёт использований Таланта: { emergencyAt, suppressAt[] }. */
export function warpLockUses(actor) {
  const raw = flagOf(warpLockTalent(actor), WARP_LOCK_USES_FLAG) ?? {};
  const emergencyAt = Number.isFinite(Number(raw.emergencyAt)) && raw.emergencyAt != null ? Number(raw.emergencyAt) : null;
  const suppressAt = Array.isArray(raw.suppressAt) ? raw.suppressAt.map(Number).filter(Number.isFinite) : [];
  return { emergencyAt, suppressAt };
}

/** Чистый учёт после ручного сброса. */
export function warpLockResetUses() { return { emergencyAt: null, suppressAt: [] }; }

/** Подавлений Таланта в пределах последнего игрового часа. */
const recent = (stamps, now) => stamps.filter(t => Number(now) - t < WARP_LOCK_PERIOD && Number(now) - t >= 0);

/** W.b — сколько подавлений в час. */
const wpBonus = actor => Math.max(0, Math.trunc(Number(actor?.system?.characteristics?.wp?.bonus) || 0));

/** Остаток часа человеческим текстом: «30 мин», «1 ч 05 мин»; пусто — ждать нечего. */
export function warpLockHourLabel(seconds) {
  const s = Math.max(0, Math.ceil(Number(seconds) || 0));
  if (!s) return "";
  const min = Math.ceil(s / 60);
  return min >= 60 ? `${Math.floor(min / 60)} ч ${String(min % 60).padStart(2, "0")} мин` : `${min} мин`;
}

const WHY = {
  "no-talent": "Варп-Замок: нет Таланта.",
  active: "Варп-Замок: персонаж уже «не псайкер» до начала следующего Хода.",
  cooldown: "Варп-Замок: аварийно можно раз в час игрового времени",
  limit: "Варп-Замок: подавление — не более W.b раз в час игрового времени"
};

/**
 * Можно ли применить Варп-Замок сейчас.
 * @param {"emergency"|"suppress"} kind «аварийный» (на карточке Феномена/Прорыва) или «подавить в начале Хода»
 * @param {number} now game.time.worldTime
 * @returns {{ok:boolean, code:string, reason:string, remaining?:number, left?:number}}
 */
export function warpLockGate(actor, kind, now) {
  const refuse = (code, extra = {}) => ({ ok: false, code, reason: WHY[code], ...extra });
  if (!hasWarpLock(actor)) return refuse("no-talent");
  if (warpLockActive(actor)) return refuse("active");
  const uses = warpLockUses(actor);
  if (kind === "suppress") {
    const used = recent(uses.suppressAt, now).length;
    const limit = wpBonus(actor);
    if (used >= limit) return refuse("limit", { left: 0 });
    return { ok: true, code: "ok", reason: "", left: limit - used };
  }
  const remaining = worldTimeRemaining(uses.emergencyAt, now, WARP_LOCK_PERIOD);
  if (remaining > 0) return { ...refuse("cooldown"), reason: `${WHY.cooldown} (осталось ${warpLockHourLabel(remaining)}).`, remaining };
  return { ok: true, code: "ok", reason: "", remaining: 0 };
}

/** Использования после применения: новое состояние для записи на Талант (старше часа выбрасываются). */
export function warpLockRecord(uses, kind, now) {
  const base = { emergencyAt: uses?.emergencyAt ?? null, suppressAt: [...(uses?.suppressAt ?? [])] };
  if (kind === "suppress") {
    return { emergencyAt: base.emergencyAt, suppressAt: [...recent(base.suppressAt, now), Number(now)] };
  }
  return { emergencyAt: Number(now), suppressAt: recent(base.suppressAt, now) };
}
