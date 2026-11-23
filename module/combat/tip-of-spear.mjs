// module/combat/tip-of-spear.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Острие Копья — Foundry-сторона rules/tip-of-spear.mjs (Разобрать stnbt).
//
//    tipOfSpearButtonHtml(attackerUuid) — кнопка на карточке рукопашного
//      попадания носителя Таланта (combat/attack.mjs → attack-card.mjs);
//    resolveTipOfSpearClick(attackerUuid) — Charm+0 свободным действием; при
//      Успехе каждый соратник, связанный той же рукопашной (в контакте с любым
//      врагом, с которым в контакте Герольд), получает флаг переброса.
//      Чужим акторам флаг пишет активный ГМ (command-state.mjs::updateOrRelay).
// ════════════════════════════════════════════════════════════════════════════

import { registerRerollLimiter, collectTestMods } from "../rules/roll-mods.mjs";
import { TIP_OF_SPEAR_FLAG, TIP_OF_SPEAR_LIMIT, tipOfSpearSource, tipOfSpearGrant, hasTipOfSpear } from "../rules/tip-of-spear.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { postTestCard, rollStatLine } from "../helpers/test-card.mjs";
import { esc, _degWord } from "../helpers/utils.mjs";
import { enemyContactTokenDocs } from "./free-attack.mjs";
import { updateOrRelay } from "./command-state.mjs";

registerRerollLimiter(TIP_OF_SPEAR_LIMIT, actor => tipOfSpearSource(actor));

/** Кнопка карточки атаки (класс .wh-tip-of-spear-btn слушает hooks.mjs). */
export function tipOfSpearButtonHtml(attackerUuid) {
  return `<button class="wh-tip-of-spear-btn" type="button" data-attacker-uuid="${esc(attackerUuid)}"
    title="Острие Копья: свободным действием Charm+0 — при Успехе каждый соратник в этой рукопашной получает переброс атаки или Парирования раз в Раунд до начала вашего следующего Хода">
    🗡 Острие Копья — Charm+0
  </button>`;
}

/** Соратники Герольда в той же рукопашной: в контакте с любым его противником. */
export function meleeAlliesOf(heraldToken, contactsOf = enemyContactTokenDocs) {
  const out = new Map();
  for (const enemy of contactsOf(heraldToken) ?? []) {
    for (const ally of contactsOf(enemy) ?? []) {
      if (ally.id === heraldToken.id || !ally.actor) continue;
      out.set(ally.actor.uuid ?? ally.id, ally.actor);
    }
  }
  return [...out.values()];
}

const charmThreshold = actor => {
  const v = Number(actor?.system?.skills?.charm?.total);
  return Number.isFinite(v) ? v : Math.floor((Number(actor?.system?.characteristics?.fel?.total) || 0) - 20);
};

export async function resolveTipOfSpearClick(attackerUuid) {
  const doc = await fromUuid(attackerUuid).catch(() => null);
  const herald = doc?.actor ?? doc;
  if (!herald) return ui.notifications.warn("⚠️ Герольд не найден.");
  if (!herald.isOwner) return ui.notifications.warn("⚠️ Нет прав на этого актора.");
  if (!hasTipOfSpear(herald)) return ui.notifications.warn("⚠️ У актора нет Таланта Острие Копья.");
  const combat = game.combat;
  if (!combat) return ui.notifications.warn("⚠️ Острие Копья действует только в бою.");
  const token = herald.getActiveTokens?.(false, true)?.[0] ?? null;
  if (!token) return ui.notifications.warn("⚠️ Токен Герольда не на сцене — не видно, кто в той же рукопашной.");

  const base = charmThreshold(herald);
  const ruleMods = collectTestMods(herald, { kind: "skill", skill: "charm", char: "fel" });
  const threshold = base + ruleMods.total;
  const roll = await new Roll("1d100").evaluate();
  const { success, deg } = testOutcome(roll.total, threshold);

  let outcome;
  if (success) {
    const allies = meleeAlliesOf(token);
    const grant = tipOfSpearGrant(herald, combat);
    for (const ally of allies) await updateOrRelay(ally, { [`flags.warhammer-dbc.${TIP_OF_SPEAR_FLAG}`]: grant });
    outcome = allies.length
      ? `<span class="roll-success">Успех — переброс атаки или Парирования раз в Раунд до начала следующего Хода ${esc(herald.name)}: ${allies.map(a => esc(a.name)).join(", ")}.</span>`
      : `<span class="roll-success">Успех — но рядом нет соратников в этой рукопашной.</span>`;
  } else {
    outcome = `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}: соратники перебросов не получают.</span>`;
  }
  await postTestCard(herald, {
    icon: "🗡", title: `Острие Копья — ${esc(herald.name)}`,
    threshold: rollStatLine({ label: "Charm", base, parts: ruleMods.parts, threshold, rv: roll.total }),
    outcome
  }, { rolls: [roll] });
  // Бросок состоялся — карточка отмечена при любом исходе: Charm+0 не повторяют.
  return true;
}
