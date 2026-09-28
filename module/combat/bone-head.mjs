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
//   • «или пока не покинет поле» — попадание Haywire (X>0) запоминает
//     область поля (флаг haywireFieldArea: центр — где стоял Огрин, радиус
//     X м); хук движения токена (initBoneHeadHooks) снимает поле и
//     наложенный им Ступор, как только токен вышел за радиус. Haywire (0)
//     привязан к цели — области нет, из поля не выйти, только затухание.
//
//  «Тест I — минимум полное действие» — payIntTestAction (2 ОД до броска).
//  «Ментальные действия вдвое дольше» — в трате ОД, combat/action-economy.mjs.
//
//  Аура Дискорданта (Haywire 7) — своя Черта-метка на акторе, её читает
//  предикат rules/predicates.mjs::haywireFieldIntensity; здесь — только
//  Ступор в момент входа (хук createItem).
// ════════════════════════════════════════════════════════════════════════════

import {
  isBoneHead, decayedHaywire, boneHeadHaywireEffects, HAYWIRE_FIELD_FLAG,
  HAYWIRE_IMPAIR_MIN, HAYWIRE_AREA_FLAG, INT_TEST_AP_COST, leftHaywireField
} from "../rules/bone-head.mjs";
import { itemHasName, DISCORDANT_FIELD_TRAIT, DISCORDANT_HAYWIRE_INTENSITY } from "../rules/predicates.mjs";
import { SECONDS_PER_COMBAT_ROUND } from "../rules/ogryn-regen.mjs";
import { applyConditionWithDuration, clearConditionDuration } from "./condition-effects.mjs";
import { isEncounterActive, hasActionEconomy, isOwnTurn, spendActionPoints } from "./action-economy.mjs";
import { conditionRemoveFields } from "../sheets/tabs/conditions.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";

const NS = "warhammer-dbc";

const storedField = actor => Number(actor?.getFlag?.(NS, HAYWIRE_FIELD_FLAG)) || 0;

/** Записать мощность поля (0 — снять флаг, а с ним и область поля). */
async function setField(actor, value) {
  const v = Math.max(0, Number(value) || 0);
  if (v === storedField(actor)) return;
  await actor.update(v > 0
    ? { [`flags.${NS}.${HAYWIRE_FIELD_FLAG}`]: v }
    : { [`flags.${NS}.-=${HAYWIRE_FIELD_FLAG}`]: null, [`flags.${NS}.-=${HAYWIRE_AREA_FLAG}`]: null });
}

/** Центр токена в пикселях сцены. */
function tokenCenter(tokenDoc) {
  const size = Number(tokenDoc?.parent?.grid?.size) || 100;
  return {
    x: (Number(tokenDoc?.x) || 0) + (Number(tokenDoc?.width) || 1) * size / 2,
    y: (Number(tokenDoc?.y) || 0) + (Number(tokenDoc?.height) || 1) * size / 2
  };
}

/** Токен актора на сцене (у связанного — первый активный). */
function sceneTokenOf(actor) {
  if (actor?.token) return actor.token;
  return actor?.getActiveTokens?.()?.[0]?.document ?? null;
}

/**
 * Запомнить область поля, сбившего имплант: центр — где стоит Огрин в
 * момент попадания (поле создаётся «при попадании» вокруг цели), радиус — X
 * у Haywire (X), метры. Haywire (0) привязан к цели (или токена нет) —
 * области нет, прежняя стирается. dazed — Ступор наложен этим полем: при
 * выходе снимается только он, а не чужой.
 */
async function rememberFieldArea(actor, { radius = 0, dazed = false } = {}) {
  const token = sceneTokenOf(actor);
  const r = Number(radius) || 0;
  if (!token || r <= 0) {
    if (actor?.getFlag?.(NS, HAYWIRE_AREA_FLAG)) await actor.update({ [`flags.${NS}.-=${HAYWIRE_AREA_FLAG}`]: null });
    return;
  }
  const c = tokenCenter(token);
  await actor.update({ [`flags.${NS}.${HAYWIRE_AREA_FLAG}`]: {
    sceneId: token.parent?.id ?? "", x: c.x, y: c.y, radius: r, dazed: !!dazed
  } });
}

/** Ступор на 1 Раунд — через единую точку (иммунитет к Ступору его гасит). */
const stuporOneRound = actor => applyConditionWithDuration(actor, "dazed", { value: 1, unit: "rounds" });

/**
 * Попадание Haywire мощностью `intensity` по актору. Не BONE-Head или поле
 * слабее 3 — пустая строка. Иначе — строка для карточки урона.
 */
export async function applyHaywireToBoneHead(actor, intensity, radius = 0) {
  const i = Number(intensity) || 0;
  if (!isBoneHead(actor) || i < HAYWIRE_IMPAIR_MIN) return "";
  const stronger = i > storedField(actor);
  if (stronger) await setField(actor, i);
  const { stupor } = boneHeadHaywireEffects(i);
  const dazed = stupor ? await stuporOneRound(actor) : false;
  // Область запоминает только поле, которое теперь и держит имплант:
  // слабее стоящего — ничего не меняет [допущение: поля не складываются].
  const r = Number(radius) || 0;
  if (stronger) await rememberFieldArea(actor, { radius: r, dazed });
  const where = !stronger ? ""
    : r > 0 ? ` Выйдет из поля (радиус ${r} м) — сбой и Ступор от него снимутся сами.`
      : " Haywire (0): поле привязано к Огрину и едет с ним.";
  return `<div class="dmg-tb-note">🦴 BONE-Head (поле ${i}): имплант сбоит — автопровал тестов I, `
    + `не читает, не пишет и не считает больше пяти, ментальные действия вдвое дольше `
    + `(свободное → полудействие). Поле гаснет на 2 за Раунд.`
    + (stupor ? ` <b>${dazed ? "Ступор на 1 Раунд" : "Ступор не наложен (иммунитет)"}</b> — или пока не покинет поле.` : "")
    + where
    + `</div>`;
}

/**
 * «Любой тест I занимает у Огрина минимум полное действие»: в бою и в свой
 * Ход — 2 ОД до броска (ментальное действие: при сбое импланта вдвое, 4 ОД в
 * Ход не влезают — теста нет); вне боя или не в свой Ход ничего не тратит.
 *
 * @returns {Promise<boolean>} можно ли бросать
 */
export async function payIntTestAction(actor, charKey) {
  if (String(charKey ?? "").toLowerCase() !== "int") return true;
  if (!isEncounterActive() || !hasActionEconomy(actor) || !isOwnTurn(actor)) return true;
  if (!isBoneHead(actor)) return true;
  if (await spendActionPoints(actor, INT_TEST_AP_COST, { physical: false })) return true;
  globalThis.ui?.notifications?.warn?.(`⚠️ ${actor.name}: BONE-Head — тест I занимает Полное действие, ОД не хватает.`);
  return false;
}

/**
 * После перемещения токена: вышел за радиус запомненного поля — поле
 * снимается (сбой импланта кончился) и Ступор, если его наложило это поле.
 * Поле уже погасло — стирается и область.
 */
export async function checkHaywireFieldExit(tokenDoc) {
  const actor = tokenDoc?.actor;
  const area = actor?.getFlag?.(NS, HAYWIRE_AREA_FLAG);
  if (!area) return;
  if (!storedField(actor)) {
    await actor.update({ [`flags.${NS}.-=${HAYWIRE_AREA_FLAG}`]: null });
    return;
  }
  if (area.sceneId && tokenDoc.parent?.id && tokenDoc.parent.id !== area.sceneId) return;
  const grid = tokenDoc.parent?.grid ?? {};
  if (!leftHaywireField(area, tokenCenter(tokenDoc), { gridSize: grid.size, gridDistance: grid.distance })) return;

  const removed = ["сбой импланта"];
  const patch = { [`flags.${NS}.-=${HAYWIRE_FIELD_FLAG}`]: null, [`flags.${NS}.-=${HAYWIRE_AREA_FLAG}`]: null };
  if (area.dazed && actor.system?.conditions?.dazed) {
    await clearConditionDuration(actor, "dazed");
    Object.assign(patch, conditionRemoveFields("dazed"));
    removed.push("Ступор");
  }
  await actor.update(patch);
  await postTestCard(actor, {
    icon: rollIcon("bolt", "#8fd0ff"), title: `${esc(actor.name)} — вышел из поля Haywire`,
    lines: [`<div class="roll-threshold">BONE-Head: снято — ${removed.join(", ")}.</div>`]
  }, { sound: false });
}

/** Хук движения: проверяет только клиент, двинувший токен (как squeeze.mjs). */
export function initBoneHeadHooks() {
  Hooks.on("updateToken", async (tokenDoc, changes, options, userId) => {
    if (userId !== game.user?.id) return;
    if (!Object.hasOwn(changes, "x") && !Object.hasOwn(changes, "y")) return;
    await checkHaywireFieldExit(tokenDoc);
  });
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
