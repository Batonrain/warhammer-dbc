// module/combat/horror-split.mjs
// ════════════════════════════════════════════════════════════════════════
//  Разделение Ужасов — кнопка карточки урона и спавн меньших Ужасов
//  (чистая часть — rules/horror-split.mjs, Sahara 578-1f7a).
//
//  Карточка урона Ужаса, ушедшего ниже 0 Ран не от священного/варп-оружия,
//  несёт кнопку «Разделиться»: число (2, под Локусом Трансмогрификации — 3)
//  посчитано заранее. Новые Ужасы — копии из Бестиария (скрыт от игрока,
//  поэтому создаёт ГМ: напрямую или сокет-релеем action:"horrorSplit"), в
//  клетках вокруг токена оригинала, с его диспозицией и в его Инициативу.
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";
import { tokenDocEdgeDistance } from "../regions/auras.mjs";
import { findBestiaryActor } from "../apps/demon-summon.mjs";
import {
  TRANSMOGRIFICATION_CAP, horrorSplitInto, horrorSplitCount, horrorSplitBlocked, heraldLocusRadius
} from "../rules/horror-split.mjs";

/** Стоит ли Ужас в радиусе Локуса Трансмогрификации дружественного Герольда Тзинча. */
export function underTransmogrification(actor, scene = globalThis.canvas?.scene) {
  const mine = actor?.getActiveTokens?.(false, true)?.[0]?.document;
  if (!mine || !scene) return false;
  for (const t of scene.tokens ?? []) {
    const h = t.actor;
    if (!h || h === actor || t.disposition !== mine.disposition) continue;
    if (!hasRuleFlag(h, TRANSMOGRIFICATION_CAP)) continue;
    if (h.system?.allegiance && actor.system?.allegiance && h.system.allegiance !== actor.system.allegiance) continue;
    if (tokenDocEdgeDistance(t, mine, scene.grid) <= heraldLocusRadius(h)) return true;
  }
  return false;
}

/**
 * Кнопка Разделения для карточки урона ("" — не положено): Ужас с
 * «Разделением», ушёл ниже 0 Ран, источник не блокирует.
 */
export function horrorSplitButtonHtml(actor, { crossedZero = false, sanctified = false, warpWeapon = false } = {}) {
  if (!crossedZero || horrorSplitBlocked({ sanctified, warpWeapon })) return "";
  const into = horrorSplitInto(actor);
  if (!into) return "";
  const n = horrorSplitCount(underTransmogrification(actor));
  return `<div class="dmg-tb-note"><button type="button" class="wh-horror-split-btn" data-actor-uuid="${esc(actor.uuid)}" data-count="${n}" data-into="${esc(into)}">🔥 Разделение: ${n} × ${esc(into)}${n === 3 ? " (Локус Трансмогрификации)" : ""}</button></div>`;
}

/** Только ГМ: N копий из Бестиария вокруг токена оригинала, в его Инициативу. */
export async function spawnHorrorSplit(actorUuid, count, into) {
  const doc = await fromUuid(actorUuid).catch(() => null);
  const orig = doc?.actor ?? doc;
  if (!orig) return { ok: false, reason: "Ужас не найден." };
  const src = await findBestiaryActor(into);
  if (!src) return { ok: false, reason: `«${into}» не найден в Бестиарии — разместите вручную.` };
  const tok = orig.getActiveTokens?.(false, true)?.[0]?.document;
  const scene = tok?.parent ?? globalThis.canvas?.scene;
  if (!scene) return { ok: false, reason: "Нет сцены для новых Ужасов." };
  const grid = scene.grid?.size || 100;
  const offsets = [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]];
  const created = [];
  for (let i = 0; i < Math.max(1, Number(count) || 2); i++) {
    const data = src.toObject();
    delete data._id;
    data.folder = orig.folder?.id ?? null;
    const a = await Actor.create(data);
    if (!a) continue;
    const [dx, dy] = offsets[i % offsets.length];
    const td = await a.getTokenDocument({ x: (tok?.x ?? 0) + dx * grid, y: (tok?.y ?? 0) + dy * grid, disposition: tok?.disposition ?? -1, hidden: false });
    const [t] = await scene.createEmbeddedDocuments("Token", [td.toObject()]);
    if (t) created.push(t);
  }
  // «Действуют в ту же Инициативу, что и оригинал.»
  const combat = game.combat;
  const origC = combat?.combatants?.find(c => c.actorId === orig.id || c.tokenId === tok?.id);
  if (combat && created.length) {
    await combat.createEmbeddedDocuments("Combatant", created.map(t => ({
      tokenId: t.id, sceneId: scene.id, actorId: t.actorId, initiative: origC?.initiative ?? null
    })));
  }
  await postTestCard(orig, {
    icon: "🔥", title: `Разделение — ${esc(orig.name)}`,
    lines: [`<div class="roll-threshold">Разваливается на <b>${created.length} × ${esc(into)}</b> в том же пространстве${origC ? " — в Инициативу оригинала" : ""}. Новые Ужасы сохраняют эффекты Владычества и Командования оригинала и его воспоминания; если это его Ход — пара сразу заканчивает Ход.</div>`]
  }, { sound: false });
  return { ok: true, count: created.length };
}

/** Кнопка: ГМ — напрямую, игрок — сокет-релей. */
export async function requestHorrorSplit(actorUuid, count, into) {
  if (game.user?.isGM) {
    const res = await spawnHorrorSplit(actorUuid, count, into);
    if (!res.ok) ui.notifications?.warn(res.reason);
    return res;
  }
  if (!game.users?.activeGM) { ui.notifications?.warn("Нет активного Мастера — Ужасов разместит ГМ."); return { ok: false }; }
  game.socket?.emit("system.warhammer-dbc", { action: "horrorSplit", userId: game.user?.id, actorUuid, count, into });
  return { ok: true, pending: true };
}
