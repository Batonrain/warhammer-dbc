// module/combat/kenetai-state.mjs
// Метки Раунда Кенетаи (Оккультный Клинок / Выжигание Души) — отдельно от
// combat/kenetai.mjs, чтобы окно манифестации (psyker-elite-hooks.mjs) не
// тянуло обратно sheets/tabs/psychic.mjs.

import { OCCULT_BLADE_FLAG } from "../rules/kenetai-talents.mjs";
import { isEncounterActive } from "./action-economy.mjs";

const NS = "warhammer-dbc";

/** Метка Раунда (вне боя — null: ограничений «раз в Раунд» нет). */
export function roundTag() {
  if (!isEncounterActive()) return null;
  return `${game.combat?.id}:${game.combat?.round}`;
}

/** Отметить применение Оккультного Клинка этим оружием в этом Раунде. */
export async function markOccultBladeUse(actor, weaponUuid) {
  const tag = roundTag();
  if (!tag) return;
  const st = actor.getFlag(NS, OCCULT_BLADE_FLAG);
  const weapons = st?.tag === tag ? [...(st.weapons ?? [])] : [];
  weapons.push(weaponUuid || "?");
  await actor.setFlag(NS, OCCULT_BLADE_FLAG, { tag, weapons });
}
