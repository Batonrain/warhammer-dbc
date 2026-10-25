// module/combat/covering-fire.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ПРИКРЫВАЮЩИЙ ОГОНЬ / Covering Fire (Стрелок, core.json; Sahara 3-5fbf,
//  решения владельца 24.10.2026):
//
//   «Отступая из рукопашной, персонаж прикрывает свое отступление огнем.
//    Когда он совершает Выход из Боя, в конце движения персонаж может за
//    свободное действие совершить короткую или длинную очередь из пистолета
//    или винтовки (но не дл. винтовки) в персонажей, из рукопашной с которыми
//    он выходил, со штрафом –20. Если цели в свой следующий Ход попытаются
//    совершить Натиск на персонажа, они должны пройти тест на Подавление+10 /
//    +0 (для короткой / длинной очереди).»
//
//  Как устроено:
//   1. Выход из Боя (movement-actions.mjs::declareDisengage) запоминает на
//      стрелке всех врагов в контакте (метка coveringFireOffer) и кладёт в
//      карточку кнопку на каждого — очередь по ОДНОМУ выбранному.
//   2. Кнопка открывает окно атаки (techniqueOpts.freeShot = "coveringFire"):
//      только Короткая/Длинная очередь, −20, без ОД, лимит Атак не проверяется.
//   3. После очереди ВСЕ запомненные враги (вариант «В» владельца) получают
//      метку на стрелке (coveringFireMarks: токен → +10/+0), и когда такой враг
//      объявляет Натиск (declareCharge), система спрашивает «Натиск на
//      стрелка?» и бросает Подавление.
//  Обе метки живут на стрелке и гаснут в начале его следующего Хода
//  (rules/turn-flags.mjs): враги ходят до этого.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { COVERING_FIRE_OFFER_FLAG, COVERING_FIRE_MARKS_FLAG, hasGunnerTalent, coveringFireEligibleWeapon,
  coveringFireSuppressionMod } from "../rules/gunner-talents.mjs";
import { enemyContactTokenDocs } from "./free-attack.mjs";
import { rollSuppressionTest } from "./suppression.mjs";

const NS = "warhammer-dbc";

/** Экипированное оружие, из которого можно прикрывать (Пистолет/Ручное, не длинная винтовка), или null. */
export function coveringFireWeapon(actor) {
  if (!hasGunnerTalent(actor, "coveringFire")) return null;
  return [...(actor?.items ?? [])].find(i => i.system?.equipped && coveringFireEligibleWeapon(i)) ?? null;
}

/**
 * Вызывается из Выхода из Боя ДО перемещения: запоминает врагов в контакте и
 * возвращает разметку кнопок для карточки ("" — Таланта/оружия/врагов нет).
 */
export async function offerCoveringFire(actor) {
  if (!coveringFireWeapon(actor)) return "";
  const token = actor.getActiveTokens?.(false, true)?.[0] ?? null;
  const enemies = (token ? enemyContactTokenDocs(token) : [])
    .map(d => ({ tokenUuid: d.uuid, actorUuid: d.actor?.uuid ?? "", name: d.name ?? d.actor?.name ?? "?" }));
  if (!enemies.length) return "";
  await actor.setFlag(NS, COVERING_FIRE_OFFER_FLAG, enemies);
  return `<div class="roll-threshold">Прикрывающий Огонь: в конце движения — свободным действием очередь (Короткая/Длинная) из Пистолета или винтовки по одному из бывших противников, −20. Все они потом, пытаясь Натиском достать стрелка, проходят тест Подавления +10 (короткая) / +0 (длинная).</div>
    ${enemies.map(e => `<button class="wh-covering-fire-btn" type="button" data-actor-uuid="${actor.uuid}" data-token-uuid="${esc(e.tokenUuid)}">🔫 Очередь по «${esc(e.name)}»</button>`).join("")}`;
}

/** Клик по кнопке карточки: выбрать цель и открыть окно атаки в режиме Прикрывающего Огня. */
export async function activateCoveringFire(actorUuid, tokenUuid) {
  const actor = await fromUuid(actorUuid).catch(() => null);
  if (!actor) return ui.notifications?.warn("Прикрывающий Огонь: персонаж не найден.");
  if (actor.isOwner === false) return ui.notifications?.warn("Прикрывающий Огонь: решать может только владелец персонажа (или ГМ).");
  const offer = actor.getFlag?.(NS, COVERING_FIRE_OFFER_FLAG);
  if (!Array.isArray(offer) || !offer.length) return ui.notifications?.warn("Прикрывающий Огонь: очередь уже сделана или Ход закончился.");
  const item = coveringFireWeapon(actor);
  if (!item) return ui.notifications?.warn("Прикрывающий Огонь: нужен экипированный Пистолет или винтовка (не длинная).");
  const tokenDoc = await fromUuid(tokenUuid).catch(() => null);
  const token = tokenDoc?.object ?? null;
  // Цель очереди — выбранный враг; остальные бывшие противники получат только метку Подавления.
  token?.setTarget?.(true, { releaseOthers: true, groupSelection: false });
  const { showAttackDialog } = await import("../sheets/attack-dialog.mjs");
  return showAttackDialog(actor, item, { freeShot: "coveringFire" });
}

/**
 * Очередь сделана: все запомненные враги получают метку (Подавление +10/+0 при их Натиске).
 * @param {Actor} actor  стрелок
 * @param {"semi"|"full"} rofMode
 */
export async function applyCoveringFireMarks(actor, rofMode) {
  const offer = actor?.getFlag?.(NS, COVERING_FIRE_OFFER_FLAG);
  if (!Array.isArray(offer) || !offer.length) return;
  const mod = coveringFireSuppressionMod(rofMode);
  const marks = {};
  for (const e of offer) marks[e.tokenUuid] = { mod, actorUuid: e.actorUuid, name: e.name };
  await actor.setFlag(NS, COVERING_FIRE_MARKS_FLAG, marks);
  await actor.unsetFlag(NS, COVERING_FIRE_OFFER_FLAG);
}

/** Стрелки с живой меткой Прикрывающего Огня против этого врага (по токенам боя). */
export function coveringFireShootersFor(enemyActor) {
  const enemyTokens = new Set((enemyActor?.getActiveTokens?.(false, true) ?? []).map(d => d.uuid));
  const out = [];
  for (const c of game.combat?.combatants ?? []) {
    const shooter = c.actor;
    const marks = shooter?.getFlag?.(NS, COVERING_FIRE_MARKS_FLAG);
    if (!marks || shooter === enemyActor) continue;
    const key = Object.keys(marks).find(k => enemyTokens.has(k) || marks[k]?.actorUuid === enemyActor?.uuid);
    if (key) out.push({ shooter, mod: Number(marks[key].mod) || 0 });
  }
  return out;
}

/**
 * Враг объявляет Натиск: если на нём метка Прикрывающего Огня — спросить, не на
 * этого ли стрелка Натиск, и бросить Подавление +10/+0.
 * @returns {Promise<boolean>} true — Натиск можно объявлять; false — тест Подавления провален
 */
export async function coveringFireChargeCheck(enemyActor) {
  let allowed = true;
  for (const { shooter, mod } of coveringFireShootersFor(enemyActor)) {
    const ok = await Dialog.confirm({
      title: "Прикрывающий Огонь",
      content: `<p>${esc(shooter.name)} прикрывал отход огнём. Натиск ${esc(enemyActor.name)} — на ${esc(shooter.name)}?</p><p>Если да — тест Подавления ${mod >= 0 ? "+" : ""}${mod}.</p>`
    });
    if (ok) {
      const res = await rollSuppressionTest(enemyActor, { mod, sourceLabel: "Прикрывающий Огонь", sourceActor: shooter });
      if (res && res.success === false) allowed = false;
    }
  }
  return allowed;
}
