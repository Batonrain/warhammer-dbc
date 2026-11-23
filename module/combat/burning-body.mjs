// module/combat/burning-body.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Пылающее Тело / Burning Body (wdbc-1rno.16) — обвязка. Логика —
//  rules/burning-body.mjs.
//
//   • «Подавить пламя» (кнопка): тест W+0, успех — флаг SUPPRESS_FLAG на
//     мутации на 1 час (worldTime). isItemActive гасит мутацию целиком —
//     вместе с иммунитетами к Горению и к Жаре/Холоду. «Вернуть пламя» —
//     свободное действие, снимает флаг; по истечении часа снимает ГМ-хук
//     updateWorldTime (burningExpiryTick).
//   • Ответное пламя на карточке атаки (attack.mjs): рукопашная атака с
//     Rng 0-1 или Захват по носителю — тест A+0 атакующего бросается сразу,
//     провал — кнопка урона 1d10 E(Fl) Pen 0 по атакующему (Tainted — пометкой).
//   • Борьба: противник носителя в начале своего Хода получает такое
//     попадание автоматически (ГМ-хук updateCombat → burningGrappleTurnStart).
//   • Субмутации: «2-3» Tearing (не при промахе по носителю), «8» 2d10/3d10
//     против псайкеров, «9» подсказка «+1 Порчи при непоглощённом уроне».
// ════════════════════════════════════════════════════════════════════════════

import {
  burningBodyItem, burningSubKind, suppressionExpired, burningRetaliates, burningHitProfile,
  SUPPRESS_FLAG, SUPPRESS_SECONDS
} from "../rules/burning-body.mjs";
import { isItemActive } from "../apps/effects.mjs";
import { isPsykerActor } from "../rules/null-zones.mjs";
import { applyDamageDiceMods } from "./weapon-properties.mjs";
import { grapplePartner } from "./grapple.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";

const NS = "warhammer-dbc";
const ICON = () => rollIcon("fire", "#ff7a2f");
const now = () => Number(game.time?.worldTime) || 0;

/** Пламя горит: мутация есть и не подавлена (isItemActive читает SUPPRESS_FLAG). */
export function burningBodyActive(actor) {
  const item = burningBodyItem(actor);
  return !!item && isItemActive(item);
}

/** Кнопка «Подавить пламя»: тест W+0, успех — пламя и иммунитеты гаснут на 1 час. */
export async function suppressBurningBody(actor) {
  const item = burningBodyItem(actor);
  if (!item) return null;
  if (item.getFlag?.(NS, SUPPRESS_FLAG)) {
    ui.notifications?.info(`${actor.name}: пламя уже подавлено.`);
    return null;
  }
  const base = Number(actor.system?.characteristics?.wp?.total) || 0;
  const mods = collectTestMods(actor, { kind: "characteristic", char: "wp" });
  const eff = base + mods.total;
  const roll = await new Roll("1d100").evaluate();
  const { success, deg } = testOutcome(roll.total, eff);
  if (success) await item.setFlag(NS, SUPPRESS_FLAG, { until: now() + SUPPRESS_SECONDS });
  await postTestCard(actor, {
    icon: ICON(), title: `Пылающее Тело: подавить пламя — ${esc(actor.name)}`,
    threshold: rollStatLine({ label: "W+0", base, parts: mods.parts, threshold: eff, rv: roll.total }),
    outcome: success
      ? outcomeHtml(true, `Успех (${deg}) — пламя погасло на 1 час: иммунитеты к Горению и экстремальным температурам не действуют`)
      : outcomeHtml(false, `Провал (${deg}) — пламя не унять`)
  }, { rolls: [roll] });
  return success;
}

/** Кнопка «Вернуть пламя» (свободное действие). */
export async function restoreBurningBody(actor, { silent = false } = {}) {
  const item = burningBodyItem(actor);
  if (!item?.getFlag?.(NS, SUPPRESS_FLAG)) return false;
  await item.unsetFlag(NS, SUPPRESS_FLAG);
  if (!silent) ui.notifications?.info(`${actor.name}: Пылающее Тело снова в огне.`);
  return true;
}

/** ГМ-хук updateWorldTime: час прошёл — пламя возвращается само. */
export async function burningExpiryTick(actor, worldTime = now()) {
  const item = burningBodyItem(actor);
  if (!item) return false;
  if (!suppressionExpired(item.getFlag?.(NS, SUPPRESS_FLAG), worldTime)) return false;
  await item.unsetFlag(NS, SUPPRESS_FLAG);
  return true;
}

/** Бросок урона пламени по атакующему (нужна жертва — для «3d10 против псайкеров»). */
async function rollFlame(defender, victim, { attackMissed = false } = {}) {
  const sub = burningSubKind(burningBodyItem(defender)?.system?.submutation?.label);
  const prof = burningHitProfile(sub, { psyker: isPsykerActor(victim), attackMissed });
  const formula = applyDamageDiceMods(prof.formula, { tearing: prof.tearing });
  const roll = await new Roll(formula).evaluate();
  return { roll, prof, total: roll.total };
}

function flameButtonHtml(defender, victim, { total, prof }) {
  const label = prof.label;
  const props = ["Проб. 0", "Tainted", ...(prof.tearing ? ["Рвущее"] : [])].join(", ");
  return `
      <div class="roll-damage-label">${esc(label)} — ответное пламя (${prof.formula} E(Fl), ${props}): <b>${total}</b></div>
      <button class="wh-apply-dmg-btn" type="button"
        data-force-target="${victim?.uuid ?? ""}"
        data-damage="${total}" data-penetration="0"
        data-damage-type="energy" data-damage-subtype="flame"
        data-hit-location="Торс"
        data-weapon-name="${esc(label)}" data-attacker="${esc(defender.name)}" data-attacker-uuid="${defender.uuid ?? ""}">
        Применить урон: ${total} → ${esc(victim?.name ?? "атакующему")}
      </button>
      ${prof.corruption ? `<div class="roll-defense-note">Колдовское пламя: непоглощённый урон — ещё +1 Порчи жертве.</div>` : ""}
      <div class="roll-defense-note">Tainted — свойство пламени; движок урона его не читает, учесть по тексту.</div>`;
}

/**
 * Блок ответного пламени для карточки атаки: defender — цель атаки (носитель),
 * attacker — тот, кто атаковал. Тест A+0 атакующего бросается здесь же.
 * @returns {Promise<{html:string, rolls:Roll[]}>}
 */
export async function burningRetaliationHtml(defender, attacker, { isMelee, technique = "", edgeM = null, hit = false } = {}) {
  if (!defender || !attacker || !burningBodyActive(defender)) return { html: "", rolls: [] };
  if (!burningRetaliates({ isMelee, technique, edgeM })) return { html: "", rolls: [] };
  const base = Number(attacker.system?.characteristics?.ag?.total) || 0;
  const mods = collectTestMods(attacker, { kind: "characteristic", char: "ag" });
  const eff = base + mods.total;
  const test = await new Roll("1d100").evaluate();
  const { success, deg } = testOutcome(test.total, eff);
  const rolls = [test];
  const head = `<div class="roll-damage-label">Пылающее Тело ${esc(defender.name)}: тест A+0 ${esc(attacker.name)} — ${test.total} против ${eff}</div>`;
  if (success) {
    return { rolls, html: `<div class="roll-damage-section roll-counter-attack">${head}${outcomeHtml(true, `Успех (${deg}) — отдёрнулся от пламени`)}</div>` };
  }
  const dmg = await rollFlame(defender, attacker, { attackMissed: !hit });
  rolls.push(dmg.roll);
  return { rolls, html: `<div class="roll-damage-section roll-counter-attack">${head}${outcomeHtml(false, `Провал (${deg}) — обожжён`)}${flameButtonHtml(defender, attacker, dmg)}</div>` };
}

/**
 * Начало Хода актора в Борьбе с носителем: автоматическое попадание пламени.
 * @returns {Promise<boolean>} было ли попадание.
 */
export async function burningGrappleTurnStart(actor) {
  const partner = grapplePartner(actor);
  if (!partner || partner === actor || !burningBodyActive(partner)) return false;
  const dmg = await rollFlame(partner, actor);
  await postTestCard(partner, {
    icon: ICON(), title: `Пылающее Тело: ${esc(actor.name)} в Борьбе с ${esc(partner.name)}`,
    lines: [`<div class="roll-threshold">Противник в Борьбе с носителем автоматически получает попадание пламени в начале своего Хода.</div>`],
    sections: [`<div class="roll-damage-section roll-counter-attack">${flameButtonHtml(partner, actor, dmg)}</div>`]
  }, { rolls: [dmg.roll] });
  return true;
}
