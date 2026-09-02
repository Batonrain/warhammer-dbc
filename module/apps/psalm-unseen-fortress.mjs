// module/apps/psalm-unseen-fortress.mjs
//
// Ресинк доли «Купола Рефрактора» (Psalm of the Unseen Fortress, wdbc-173l)
// ПОСЛЕ того, как общий ablative пул уменьшился по другой причине (боевое
// поглощение урона) — сама выдача живёт в module/sheets/tabs/tech.mjs::
// activateTechMiracle (единый конвейер активации ВСЕХ Техночудес), здесь
// только хук на updateActor, тем же приёмом, что flayed.mjs/daemonblood.mjs.

import { PSALM_UNSEEN_FORTRESS_FLAG, psalmUnseenFortressShrinkToFit } from "../rules/psalm-unseen-fortress.mjs";

const FLAG = "warhammer-dbc";

export async function reconcilePsalmUnseenFortressToFit(actor) {
  const prev = Number(actor.getFlag(FLAG, PSALM_UNSEEN_FORTRESS_FLAG)) || 0;
  if (prev <= 0) return;
  const result = psalmUnseenFortressShrinkToFit(actor.system, prev);
  if (!result) return;
  await actor.update({
    "system.wounds.ablativeMax": result.ablativeMax,
    [`flags.${FLAG}.${PSALM_UNSEEN_FORTRESS_FLAG}`]: result.contribution
  });
}
