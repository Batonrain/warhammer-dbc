// module/combat/legacy-weapon-excess.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Наследие Излишеств, Оружие Наследия, вторая половина (wdbc-1rno.35,
//  История 6, стр. 427): «...если он проваливает этот тест [с выбранным
//  +10], должен пройти тест на W+0 или получить 1 Порчи.» Каскад — тем же
//  приёмом, что «Вспыльчивость» (rules/quick-to-anger.mjs::
//  rollQuickToAngerTest): авто-W+0, своя тематическая карточка, провал даёт
//  Порчу. Отдельный от rules/legacy-weapon.mjs файл — тот регистрируется в
//  sources.mjs (module/rules/sources.mjs → collect.mjs → ЭТОТ файл, будь он
//  там же, замкнул бы sources.mjs ↔ resolve-test.mjs циклом импортов, см.
//  заголовок sources.mjs про wdbc-795h).
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { autoTestMods } from "../rules/roll-mods.mjs";
import { postTestCard, rollStatLine } from "../helpers/test-card.mjs";

/** Вызывается ТОЛЬКО когда тест с +10 Наследия Излишеств провален. */
export async function rollExcessLegacyRiskTest(actor) {
  const wp = Number(actor.system?.characteristics?.wp?.total) || 0;
  const ruleMods = autoTestMods(actor, { kind: "skill", char: "wp" });
  const threshold = wp + ruleMods.total;
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const success = rv <= threshold;

  if (!success) {
    const cur = Number(actor.system?.corruption?.value) || 0;
    await actor.update({ "system.corruption.value": cur + 1 });
  }

  await postTestCard(actor, {
    icon: "⚠️", title: `Наследие Излишеств — риск не оправдался — ${esc(actor.name)}`,
    threshold: rollStatLine({ label: "W", base: wp, parts: ruleMods.parts, threshold, rv }),
    outcome: success
      ? `<span class="roll-success">Успех — обошлось без Порчи</span>`
      : `<span class="roll-failure">Провал — +1 Порчи</span>`
  }, { rolls: [roll] });

  return success;
}
