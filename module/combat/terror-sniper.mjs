// module/combat/terror-sniper.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Terror Sniper / Снайпер Ужаса — поток (правила и трактовка — rules/terror-sniper.mjs).
//
//  1. Кнопка на карточке попадания (attack-card.mjs) → resolveTerrorSniperClick:
//     Intimidate(BS)+0; при Успехе радиус = число Успехов в метрах от места
//     попадания (токен цели).
//  2. В радиусе — враги стрелка (по расположению токенов), видевшие попадание
//     (isTokenInSight на токен цели, rules/vision-target.mjs — приближённо, без
//     стен). Для каждого в карточке строка: галочка «знает, где стрелок»
//     (по умолчанию — стрелок у него в поле зрения) и кнопка теста Подавления.
//  3. Кнопка строки → rollTerrorSniperSuppression: rollSuppressionTest(+0 / −20).
//     Бросает владелец врага или ГМ.
// ════════════════════════════════════════════════════════════════════════════

import { tokensWithinRadius } from "../rules/aoe-target.mjs";
import { tokenRelationship } from "../regions/auras.mjs";
import { isTokenInSight } from "../rules/vision-target.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { terrorSniperThreshold, terrorSniperSuppressMod, hasTerrorSniper } from "../rules/terror-sniper.mjs";
import { postTestCard, rollStatLine } from "../helpers/test-card.mjs";
import { esc } from "../helpers/utils.mjs";
import { runCardOnce } from "./card-once.mjs";
import { rollSuppressionTest } from "./suppression.mjs";

/**
 * Враги стрелка в радиусе от места попадания, видевшие попадание.
 * @returns {{token: TokenDocument, knows: boolean}[]} knows — стрелок в поле зрения врага
 */
export function terrorSniperAffected({ shooterDoc, targetDoc, radius }) {
  const grid = targetDoc?.parent?.grid;
  if (!shooterDoc || !targetDoc || !grid) return [];
  const out = [];
  for (const token of tokensWithinRadius(targetDoc, radius, { includeSelf: true })) {
    if (token.id === shooterDoc.id) continue;
    if (tokenRelationship(shooterDoc.disposition, token.disposition) !== "enemy") continue;
    if (!isTokenInSight(token, targetDoc, grid)) continue;          // не видел попадание
    out.push({ token, knows: isTokenInSight(token, shooterDoc, grid) });
  }
  return out;
}

const rowHtml = ({ token, knows }, attackerUuid) => `
  <div class="wh-terror-row" style="display:flex;gap:6px;align-items:center;margin:2px 0;">
    <b>${esc(token.name ?? token.actor?.name ?? "?")}</b>
    <label style="font-size:0.85em;"><input type="checkbox" class="wh-terror-knows-cb"${knows ? " checked" : ""}> знает, где стрелок (−20)</label>
    <button class="wh-terror-suppress-btn" type="button" data-actor-uuid="${esc(token.actor?.uuid ?? "")}" data-attacker-uuid="${esc(attackerUuid)}">Тест на Подавление</button>
  </div>`;

/** Клик по кнопке карточки попадания. */
export async function resolveTerrorSniperClick(attackerUuid, targetTokenUuid, message) {
  const actor = await fromUuid(attackerUuid).catch(() => null);
  if (!actor) return ui.notifications.warn("⚠️ Стрелок не найден.");
  if (!actor.isOwner) return ui.notifications.warn("⚠️ Нет прав на этого актора.");
  if (!hasTerrorSniper(actor)) return ui.notifications.warn(`⚠️ ${actor.name}: нет Таланта «Снайпер Ужаса».`);
  const targetDoc = await fromUuid(targetTokenUuid).catch(() => null);
  const shooterDoc = actor.getActiveTokens?.()?.[0]?.document ?? null;

  return runCardOnce(message, "terrorSniperRolled", async () => {
    const { base } = terrorSniperThreshold(actor);
    const ruleMods = collectTestMods(actor, { kind: "skill", skill: "intimidate", char: "bs" });
    const threshold = base + ruleMods.total;
    const roll = await new Roll("1d100").evaluate();
    const rv = roll.total;
    const { success, deg } = testOutcome(rv, threshold);

    let outcome;
    let sections = [];
    if (!success) {
      outcome = `<span class="roll-failure">Провал — враги не напуганы.</span>`;
    } else {
      const affected = terrorSniperAffected({ shooterDoc, targetDoc, radius: deg });
      outcome = `<span class="roll-success">Успех (${deg}) — враги в радиусе ${deg} м от места попадания, видевшие попадание, проходят Подавление.</span>`;
      sections = [affected.length
        ? `<div class="roll-terror-sniper"><div style="font-size:0.85em;">Галочка «знает, где стрелок» — по умолчанию там, где стрелок виден врагу; поправьте, если иначе. Не знает: Подавление +0, знает: −20.</div>${
            affected.map(a => rowHtml(a, attackerUuid)).join("")}</div>`
        : `<div class="roll-allout-note">В радиусе ${deg} м нет врагов, видевших попадание${shooterDoc && targetDoc ? "" : " (токен стрелка или цели не найден на сцене — определите врагов вручную)"}.</div>`];
    }
    await postTestCard(actor, {
      icon: "💀", title: `Снайпер Ужаса — ${esc(actor.name)}`,
      threshold: rollStatLine({ label: "Intimidate(BS)+0", base, parts: ruleMods.parts, threshold, rv }),
      outcome, sections
    }, { rolls: [roll] });
    return true;
  }, "Снайпер Ужаса с этого попадания уже пробовали.");
}

/** Тест Подавления одного врага из карточки Снайпера Ужаса. */
export async function rollTerrorSniperSuppression(actorUuid, attackerUuid, knows) {
  const actor = await fromUuid(actorUuid).catch(() => null);
  if (!actor) return ui.notifications.warn("⚠️ Цель не найдена.");
  if (!actor.isOwner && !game.user?.isGM) return ui.notifications.warn(`⚠️ Нет прав бросать за ${actor.name} — тест проведёт его владелец или ГМ.`);
  const sourceActor = await fromUuid(attackerUuid || "").catch(() => null);
  return rollSuppressionTest(actor, { mod: terrorSniperSuppressMod(knows), sourceLabel: "Снайпер Ужаса", sourceActor });
}
