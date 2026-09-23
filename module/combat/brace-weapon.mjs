// module/combat/brace-weapon.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ЗАКРЕПЛЕНИЕ (стр. 35, wdbc-x1nz.2.56): «Действие: Полудействие. Тип:
//  Физическое. Персонаж устанавливает тяжёлое оружие на удобную позицию,
//  будь это укрытие, лафет, бипод, трипод. Пока он не сдвинется с места, или
//  не повернёт оружие вне сектора обстрела (±45° для большинства) оружие
//  считается Закреплённым.»
//
//  Раньше «Закрепление» жило только галочкой в диалоге атаки, которая на
//  ЛЮБОЙ атаке безусловно снимала штраф −30/−10 тяжёлого оружия — без цены,
//  без состояния, без проверки геометрии. Теперь это настоящее Действие с
//  ОД и персистентным состоянием на акторе: {weaponId, x, y, rotation},
//  снимаемым при движении токена или повороте вне сектора.
//
//  НЕ СМОДЕЛИРОВАНО (честная урезка): «Закрепить с плеча» для оружия,
//  интегрированного в бионику, и «некоторых видов тяжёлого оружия» — свой
//  подтип без фиксированного сектора, но с потолком ±90°/Ход. В схеме
//  предмета нет поля, различающего такое оружие от обычного тяжёлого —
//  вводить его ради одной книжной оговорки без явного запроса не стали;
//  ВСЕ тяжёлые считаются «для большинства» (±45°, обычная установка).
// ════════════════════════════════════════════════════════════════════════════

import { spendActionPoints } from "./action-economy.mjs";
import { tokenCenter, tokenRotation } from "./facing.mjs";
import { normalizeAngle180 } from "../rules/facing.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { registerBraceCheck } from "./weapon-profiles.mjs";

const NS = "warhammer-dbc";
const FLAG_KEY = "braceState";

/** Сектор обстрела «для большинства» тяжёлого оружия (стр. 35) — половина на сторону. */
export const BRACE_ARC_WIDTH = 45;

function actorToken(actor) {
  return actor?.getActiveTokens?.(false, true)?.[0] ?? null;
}

/**
 * Закреплено ли ИМЕННО это оружие прямо сейчас: флаг стоит на нём же, токен
 * не сдвинулся с точки Закрепления и не довернут вне сектора ±BRACE_ARC_WIDTH/2
 * от разворота на момент Закрепления. Токена нет вовсе (снят со сцены,
 * актор — NPC без токена) — Закрепление считается утраченным: геометрию
 * посчитать не из чего, а «молча продолжает действовать» было бы менее
 * честным дефолтом, чем «слетело».
 */
export function isBraced(actor, weapon) {
  const state = actor?.getFlag?.(NS, FLAG_KEY);
  if (!state || state.weaponId !== weapon?.id) return false;
  const token = actorToken(actor);
  if (!token) return false;
  const pos = tokenCenter(token);
  if (!pos || pos.x !== state.x || pos.y !== state.y) return false;
  const rotationDrift = Math.abs(normalizeAngle180(tokenRotation(token) - state.rotation));
  return rotationDrift <= BRACE_ARC_WIDTH / 2;
}

// Профиль «Ударить оружием» гасится у Закреплённого тяжёлого (Безоружный Бой,
// wdbc-x1nz.2.71) — отдаём ему эту проверку, см. weapon-profiles.mjs.
registerBraceCheck(isBraced);

/** Снять Закрепление явно (например, когда игрок сам решает его прекратить). */
export async function clearBrace(actor) {
  if (actor?.getFlag?.(NS, FLAG_KEY)) await actor.unsetFlag(NS, FLAG_KEY);
}

/**
 * «Закрепление»: Полудействие (1 ОД). Только тяжёлое оружие (weaponClass
 * "heavy") — лёгкому/среднему книга Закрепления не предлагает вовсе.
 */
export async function declareBrace(actor, weapon) {
  if (!actor || !weapon) return;
  if (weapon.system?.weaponClass !== "heavy") {
    return ui.notifications?.warn(`${weapon.name}: Закрепление — только для тяжёлого оружия.`);
  }
  const token = actorToken(actor);
  if (!token) return ui.notifications?.warn("⚠️ Нет токена на сцене — Закрепление не от чего отмерить.");
  if (!await spendActionPoints(actor, 1, { physical: true })) {
    return ui.notifications?.warn("⚠️ Не хватает ОД на Закрепление (Полудействие).");
  }
  const pos = tokenCenter(token);
  await actor.setFlag(NS, FLAG_KEY, {
    weaponId: weapon.id, x: pos.x, y: pos.y, rotation: tokenRotation(token)
  });
  await postTestCard(actor, {
    icon: rollIcon("target", "#c9a86a"),
    title: `${esc(actor.name)} — Закрепление: ${esc(weapon.name)}`,
    lines: [`<div class="roll-threshold">Закреплено (Полудействие). Держится, пока не сдвинется с места и не довернёт оружие больше чем на ${BRACE_ARC_WIDTH / 2}° от текущего разворота (стр. 35).</div>`]
  }, { sound: false });
}
