// module/apps/soul-seer.mjs
// ════════════════════════════════════════════════════════════════════════
//  Мутация «Soul-Seer/Душевидец» (wdbc-1rno) — Foundry-обвязка поверх
//  module/rules/soul-seer.mjs. Кнопка kind:"script", без троттла/цены:
//  видение постоянно наслаивается на обычное зрение, не разовый ресурс.
// ════════════════════════════════════════════════════════════════════════

import { soulSeerCategory, SOUL_SEER_RADIUS_M } from "../rules/soul-seer.mjs";
import { tokensWithinRadius } from "../rules/aoe-target.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";

/**
 * Список душ в радиусе 10м (сквозь преграды — LOS через стены в системе
 * не реализован вообще, обычный радиус без стен и есть «сквозь преграды»).
 */
export async function useSoulSeer(actor, item, tokenDoc) {
  if (!actor) return;
  if (!tokenDoc?.parent) return ui.notifications?.warn("Душевидец: нет токена на сцене — радиус не с чего мерить.");

  const seen = [];
  for (const t of tokensWithinRadius(tokenDoc, SOUL_SEER_RADIUS_M, { includeSelf: false })) {
    const category = soulSeerCategory(t.actor?.type);
    if (category) seen.push({ name: t.actor.name, category });
  }

  await postTestCard(actor, {
    icon: rollIcon("run", "#8fb0c4"),
    title: `Душевидец — ${esc(item.name)}`,
    lines: [seen.length
      ? seen.map(s => `<div class="roll-threshold">${esc(s.name)} — ${s.category}</div>`).join("")
      : `<div class="roll-threshold">В радиусе ${SOUL_SEER_RADIUS_M}м душ не видно.</div>`]
  }, { sound: false });
}
