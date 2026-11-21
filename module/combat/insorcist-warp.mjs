// module/combat/insorcist-warp.mjs
// ════════════════════════════════════════════════════════════════════════
//  Инзорцизм в Варп-Нестабильности (combat/warp-instability.mjs):
//   • призванный Инзорцистом демон «автоматически проходит тесты на
//     Нестабильность, если не более W м от Инзорциста»;
//   • изгнанный — снова призывается через W.b + Inf.b часов (печать помнит).
//  Призванный опознаётся по system.masterUuid (apps/demon-summon.mjs, asMinion)
//  и совпадению имени с печатью. Лёгкий модуль — без импорта всей обвязки.
// ════════════════════════════════════════════════════════════════════════

import {
  SEALS_FLAG, hasInsorcism, sealsOf, sealMatchesName, banishCooldownSeconds, insorcistAnchorsInstability
} from "../rules/insorcist-talents.mjs";
import { actorsDistance } from "./psyker-elite-common.mjs";

const NS = "warhammer-dbc";

function insorcistOf(demon) {
  const uuid = demon?.system?.masterUuid;
  if (!uuid) return null;
  const master = globalThis.fromUuidSync?.(uuid) ?? null;
  if (!master || !hasInsorcism(master)) return null;
  const seal = sealsOf(master).find(s => sealMatchesName(s, demon.name));
  return seal ? { master, seal } : null;
}

/** Нестабильность проходит сама: демон Инзорциста не дальше W м от него. */
export function insorcistAnchorsDemon(demon) {
  const hit = insorcistOf(demon);
  if (!hit) return null;
  const wp = Number(hit.master.system?.characteristics?.wp?.total) || 0;
  return insorcistAnchorsInstability(actorsDistance(demon, hit.master), wp) ? hit.master : null;
}

/** Изгнание в Варп демона Инзорциста: печать запоминает срок до нового призыва. */
export async function insorcistOnBanished(demon) {
  const hit = insorcistOf(demon);
  if (!hit) return;
  const wpb = Number(hit.master.system?.characteristics?.wp?.bonus) || 0;
  const seals = sealsOf(hit.master).map(s => s.id === hit.seal.id
    ? { ...s, bannedUntil: (Number(game.time?.worldTime) || 0) + banishCooldownSeconds(wpb, s), summonedUntil: 0 } : s);
  try { await hit.master.setFlag(NS, SEALS_FLAG, seals); } catch (e) { console.warn("warhammer-dbc | Инзорцизм: печать", e); }
}
