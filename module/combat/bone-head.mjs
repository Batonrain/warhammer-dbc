// module/combat/bone-head.mjs
// ════════════════════════════════════════════════════════════════════════════
//  BONE-Head Огрина и поле Haywire — обвязка под Foundry. Чистая часть и
//  текст книги — rules/bone-head.mjs; правила теста (потолок Успехов,
//  автопровал I в поле 3+) — rules/library/ogryn.mjs.
//
//  Мощность поля, где стоит Огрин, — флаг актора haywireField:
//   • пишется при попадании оружием с Haywire (combat/damage.mjs::_applyHaywire
//     — там же бросок мощности 1d10) — только у носителя BONE-Head, другим
//     этот флаг не нужен;
//   • гаснет на 2 за Раунд боя (хук updateCombat, module/hooks.mjs) и за
//     каждые 5 секунд Календаря (часы Состояний, combat/condition-clock.mjs);
//   • «или пока не покинет поле» — ГМ снимает Ступор/флаг сам: позиции поля
//     на сцене у системы нет, у Haywire-попадания есть только бросок.
//
//  Аура Дискорданта (Haywire 7) — своя Черта-метка на акторе, её читает
//  предикат rules/predicates.mjs::haywireFieldIntensity; здесь — только
//  Ступор в момент входа (хук createItem).
// ════════════════════════════════════════════════════════════════════════════

import {
  isBoneHead, decayedHaywire, boneHeadHaywireEffects, HAYWIRE_FIELD_FLAG,
  HAYWIRE_IMPAIR_MIN
} from "../rules/bone-head.mjs";
import { itemHasName, DISCORDANT_FIELD_TRAIT, DISCORDANT_HAYWIRE_INTENSITY } from "../rules/predicates.mjs";
import { SECONDS_PER_COMBAT_ROUND } from "../rules/ogryn-regen.mjs";
import { applyConditionWithDuration } from "./condition-effects.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";

const NS = "warhammer-dbc";

const storedField = actor => Number(actor?.getFlag?.(NS, HAYWIRE_FIELD_FLAG)) || 0;

/** Записать мощность поля (0 — снять флаг). */
async function setField(actor, value) {
  const v = Math.max(0, Number(value) || 0);
  if (v === storedField(actor)) return;
  await actor.update(v > 0
    ? { [`flags.${NS}.${HAYWIRE_FIELD_FLAG}`]: v }
    : { [`flags.${NS}.-=${HAYWIRE_FIELD_FLAG}`]: null });
}

/** Ступор на 1 Раунд — через единую точку (иммунитет к Ступору его гасит). */
const stuporOneRound = actor => applyConditionWithDuration(actor, "dazed", { value: 1, unit: "rounds" });

/**
 * Попадание Haywire мощностью `intensity` по актору. Не BONE-Head или поле
 * слабее 3 — пустая строка. Иначе — строка для карточки урона.
 */
export async function applyHaywireToBoneHead(actor, intensity) {
  const i = Number(intensity) || 0;
  if (!isBoneHead(actor) || i < HAYWIRE_IMPAIR_MIN) return "";
  if (i > storedField(actor)) await setField(actor, i);
  const { stupor } = boneHeadHaywireEffects(i);
  const dazed = stupor ? await stuporOneRound(actor) : false;
  return `<div class="dmg-tb-note">🦴 BONE-Head (поле ${i}): имплант сбоит — автопровал тестов I, `
    + `не читает, не пишет и не считает больше пяти, ментальные действия вдвое дольше `
    + `(свободное → полудействие). Поле гаснет на 2 за Раунд.`
    + (stupor ? ` <b>${dazed ? "Ступор на 1 Раунд" : "Ступор не наложен (иммунитет)"}</b> — или пока не покинет поле.` : "")
    + `</div>`;
}

/** Смена Раунда: поля комбатантов гаснут на 2 за каждый Раунд вперёд. */
export async function decayHaywireFields(combat, changed) {
  const now = Number(changed?.round);
  const prev = Number(combat?.previous?.round ?? now - 1);
  const rounds = now - prev;
  if (!(rounds > 0)) return;
  for (const combatant of combat.combatants ?? []) {
    const actor = combatant.actor;
    const cur = storedField(actor);
    if (cur > 0) await setField(actor, decayedHaywire(cur, rounds));
  }
}

/** Часы Состояний: 5 секунд Календаря — один Раунд затухания. */
export async function haywireFieldClock(actor, { from, to }) {
  const cur = storedField(actor);
  if (!cur) return;
  const rounds = Math.floor((Number(to) - Number(from)) / SECONDS_PER_COMBAT_ROUND);
  if (rounds > 0) await setField(actor, decayedHaywire(cur, rounds));
}

/**
 * Хук createItem: на актора легла Черта-метка «В Поле Дискорданта» — это
 * поле Haywire (7), и Огрин впадает в Ступор на 1 Раунд.
 */
export async function onDiscordantFieldEntered(item) {
  const actor = item?.parent;
  if (item?.type !== "trait" || !itemHasName(item, DISCORDANT_FIELD_TRAIT) || !isBoneHead(actor)) return;
  const dazed = await stuporOneRound(actor);
  const rollMode = actor.hasPlayerOwner ? game.settings.get("core", "rollMode") : "gmroll";
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("bolt", "#8fd0ff")}${esc(actor.name)} — BONE-Head</div>
      <div class="roll-threshold">Поле Дискорданта (Haywire ${DISCORDANT_HAYWIRE_INTENSITY}): имплант сбоит — автопровал тестов I, ментальные действия вдвое дольше. ${dazed ? "<b>Ступор на 1 Раунд</b>." : "Ступор не наложен (иммунитет)."}</div>
    </div>`
  }, rollMode));
}
