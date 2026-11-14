// module/combat/snare.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Связывающее (Snare X) — вторая половина правила, книга «Особые Свойства
//  Оружия»: «Связанная цель в свой Ход может за полное действие повторить этот
//  тест [A−10×X или S−10×X] и при Успехе выбраться из пут или разорвать их.
//  Другой персонаж в базовом контакте со связанным может за полудействие
//  разрезать путы любым клинковым рукопашным оружием, если у него в руках такое
//  есть.» Первое наложение (тест при попадании) — hooks.mjs::_applyWeaponPropEffect;
//  здесь только кнопки «вырваться» и «разрезать», которые он кладёт в карточку.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { rollConditionCharTest } from "./condition-ticks.mjs";
import { conditionRemoveFields } from "../sheets/tabs/conditions.mjs";
import { basesInContact } from "../rules/master-of-executions.mjs";
import { heldWeapons } from "../rules/dual-wield-talents.mjs";

/** Клинковое рукопашное оружие: рукопашное с Режущим типом урона. */
export const isBladeWeapon = w => String(w?.system?.weaponClass ?? "") === "melee"
  && String(w?.system?.damageType ?? "") === "rending";

/**
 * Кто из токенов может перерезать путы (чистая функция): другой токен в базовом контакте со связанным,
 * не враждебный ему по диспозиции, с клинком в руках (решение владельца 13.11.2026).
 * @param {{id:string,x:number,y:number,width?:number,height?:number,disposition?:number}} bound
 * @param {Array<{id:string,x:number,y:number,width?:number,height?:number,disposition?:number,name?:string,blade:boolean}>} others
 * @returns {string[]} имена подходящих токенов
 */
export function bondCutters(bound, others, size = 100) {
  const bd = Number(bound?.disposition ?? 0);
  return (others || [])
    .filter(t => t.id !== bound.id && t.blade
      && Number(t.disposition ?? 0) * bd !== -1
      && basesInContact(bound, t, size))
    .map(t => t.name || t.id);
}

/** Подходящие «резаки» на сцене для актора (токен связанного ищется среди его активных токенов). */
function bondCuttersOnScene(actor) {
  const tokens = canvas?.tokens?.placeables ?? [];
  const mine = actor.getActiveTokens?.() ?? [];
  const size = canvas?.grid?.size || 100;
  const data = t => ({ id: t.id, x: t.document.x, y: t.document.y, width: t.document.width, height: t.document.height,
    disposition: t.document.disposition, name: t.name, blade: t.actor ? heldWeapons(t.actor).some(isBladeWeapon) : false });
  const others = tokens.map(data);
  return mine.flatMap(m => bondCutters(data(m), others, size));
}

/** Кнопки под карточкой наложения Связывающего. */
export function snareEscapeButtonsHtml(actorUuid, rating) {
  const r = Number(rating) || 0;
  const b = (kind, char, label, title) =>
    `<button class="wh-snare-btn" type="button" data-kind="${kind}" data-actor-uuid="${esc(actorUuid)}" data-char="${char}" data-rating="${r}" title="${esc(title)}">${label}</button>`;
  return `<div class="wh-crit-pills">
    ${b("escape", "ag", `Вырваться — Ловкость−${10 * r}`, "Своя очередь, полное действие: повторить тест, при Успехе выбраться из пут")}
    ${b("escape", "s", `Вырваться — Сила−${10 * r}`, "Своя очередь, полное действие: повторить тест, при Успехе разорвать путы")}
    ${b("cut", "", "Перерезать путы (союзник)", "Другой персонаж в базовом контакте, полудействие, клинковое рукопашное оружие в руках")}
  </div>`;
}

/** Клик по кнопке: тест на освобождение либо разрезание. */
export async function resolveSnareButton(actor, { kind, char, rating }) {
  if (!actor?.system?.conditions?.helpless) {
    return ui.notifications?.info?.(`${actor?.name ?? ""}: уже не связана.`);
  }
  if (kind === "cut") {
    // Книга: другой персонаж в базовом контакте, клинок в руках. Без готового холста проверять нечего.
    if (canvas?.ready) {
      const cutters = bondCuttersOnScene(actor);
      if (!cutters.length) {
        return ui.notifications?.warn?.(`${actor.name}: перерезать путы некому — нужен другой персонаж в базовом контакте с клинковым рукопашным оружием в руках.`);
      }
    }
    await actor.update(conditionRemoveFields("helpless"));
    return postTestCard(actor, {
      title: `Путы перерезаны — ${esc(actor.name)}`, actorUuid: actor.uuid,
      outcome: `<span class="roll-success">Путы перерезаны клинком — Беспомощность снята.</span>`
    });
  }
  const mod = -10 * (Number(rating) || 0);
  const t = await rollConditionCharTest(actor, char, mod);
  if (t.success) await actor.update(conditionRemoveFields("helpless"));
  return postTestCard(actor, {
    title: `Освободиться от пут (${char.toUpperCase()}${mod}) — ${esc(actor.name)}`, actorUuid: actor.uuid,
    threshold: `порог <b>${t.eff}</b>, бросок <b>${t.rv}</b>`,
    outcome: t.success
      ? `<span class="roll-success">Успех — путы порваны, Беспомощность снята.</span>`
      : `<span class="roll-failure">Провал — остаётся связана (повтор — в свой следующий Ход, полное действие).</span>`
  }, { rolls: [t.roll] });
}
