// module/combat/pugilist-strikes.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ТЯЖЁЛЫЙ ХУК, НАПРАВЛЯЮЩИЙ УДАР, УДАР С КОЛЕНА — Foundry-обвязка к
//  rules/pugilist-talents.mjs (Таланты Пугилиста, Sahara 3-eddb, стр. 62).
//
//  HAYMAKER / ТЯЖЁЛЫЙ ХУК: «Он может при совершении атаки кулаком (до броска на попадание) выбрать отказаться
//  от атаки еще одной рукой в этот Ход, чтобы дать этой атаке +½ T.b Dmg (окр. ▼), и, если цель получила
//  попадание, она должна пройти встречный тест S+0 vs S+0, или ее Сбивает с ног.»
//    • бонус Dmg, галочка окна и отказ от «Обе руки» — combat/attack.mjs, sheets/attack/*;
//    • «получила попадание» = урон по цели ПРИМЕНЁН (карточка урона, combat/damage.mjs): Избегание, остановившее
//      удар, кнопку урона не оставляет. Кнопка встречного теста — раз на ИСХОДНУЮ карточку атаки (haymakerUsed),
//      сколько бы карточек урона ни вышло; цель уже Ничком — кнопки нет.
//    • проигрыш цели во встречном тесте S+0 vs S+0 — состояние «Ничком» (через Стену: statusApplyFields).
//
//  GOADING STRIKE / НАПРАВЛЯЮЩИЙ УДАР: «Когда персонаж совершает атаку кулаком, он может дать ей штраф –20,
//  чтобы при Успехе (даже если цель Избежала от попадания) сразу же провести против этой цели Давление за
//  свободное действие.» Штраф — строка порога окна (sheets/attack-dialog.mjs); Успех — попадание ПО БРОСКУ, до
//  Избегания, поэтому кнопка Давления рисуется на самой карточке атаки (раз на карточку, goadingPressUsed).
//  Давление — обычное Состязание (MELEE_CONTESTS.press, эффект победы — feint-press.mjs::resolvePressSuccess).
//
//  KNEE STRIKE / УДАР С КОЛЕНА: «Если он успешно взял цель в Захват как минимум 2-мя руками, персонаж может
//  немедленно нанести по цели автоматическое попадание ногой, которой он еще не атаковал в этот Ход, используя
//  профиль безоружного пинка, даже если у него на ноге есть другое оружие. Если он побеждает в тесте Athletics
//  на взятие в Захват на 5+ Успехов, персонаж может нанести это попадание в голову вместо торса и дать ему
//  свойство Concussive (0).»
//    • кнопки — на карточке Захвата (grapple.mjs::resolveGrappleSuccess), «Успехи» берутся оттуда;
//    • в этой системе Захват начинается ОДНОЙ рукой, число рук растёт в окне Борьбы (setGrappleHands) — поэтому
//      «минимум 2 руки» проверяется в момент нажатия кнопки, а не при взятии в Захват;
//    • «ногой, которой ещё не атаковал» — счётчик ударов ногой в Ходу (LEG_ATTACKS_FLAG, пишет attack.mjs);
//    • окно атаки открывается профилем интегрального «Пинок» (чужое оружие на ноге не берётся), Базой и Приёмом
//      «Стандартная», бесплатно (ни ОД, ни Лимита Атак), попадание автоматическое (1 Успех), место — торс или голова.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { MELEE_CONTESTS } from "../constants/combat.mjs";
import { statusApplyFields } from "./status-resist.mjs";
import { writeToTarget } from "./gm-relay.mjs";
import { resolvePressSuccess } from "./feint-press.mjs";
import { isKickWeapon } from "./roundhouse.mjs";
import { legsFree, kneeStrikeHandsOk, kneeStrikeHeadOffered } from "../rules/pugilist-talents.mjs";

const NS = "warhammer-dbc";

// Имя флага числа рук в Захвате дублирует combat/grapple.mjs::GRAPPLE_HANDS_FLAG: grapple.mjs импортирует этот
// файл (кнопки Удара с Колена на карточке Захвата), обратный импорт замкнул бы круг модулей.
const GRAPPLE_HANDS = "grappleHands";
const GRAPPLE_PARTNER = "grapplePartnerUuid";

/** Ключи отметок «раз на карточку» (белый список — card-once.mjs::CARD_ONCE_FLAGS). */
export const HAYMAKER_CARD_FLAG = "haymakerUsed";
export const GOADING_CARD_FLAG = "goadingPressUsed";
export const KNEE_STRIKE_CARD_FLAG = "kneeStrikeUsed";

// ── Тяжёлый Хук ─────────────────────────────────────────────────────────────

/** Состязание S+0 vs S+0 (в общем списке кнопок листа его нет — доступно только с карточки урона). */
export const HAYMAKER_CONTEST = {
  label: "Тяжёлый Хук", wsBonus: 0,
  modLabel: "S vs S",
  defaultChar: "s",
  allowedChars: ["s"],
  note: "S+0 vs S+0 после попадания Тяжёлого Хука. Победа бьющего — цель Сбита с ног (Ничком); цель, выигравшая тест, остаётся стоять.",
  targetDodgeMod: 0, targetParryMod: 0,
  chatNote: "⚡ Состязательный бросок S — сбить удачно попавшего с ног"
};

/** Разметка кнопки (класс .wh-haymaker-btn слушает hooks.mjs). */
export function haymakerButtonHtml({ attackerUuid, targetUuid, targetName = "", sourceMessageId = "" }) {
  return `<div class="roll-defense-section">
    <button class="wh-haymaker-btn" type="button"
      data-attacker-uuid="${esc(attackerUuid)}" data-target-uuid="${esc(targetUuid)}" data-source-message-id="${esc(sourceMessageId)}"
      title="Тяжёлый Хук: цель, получившая попадание, проходит встречный тест S+0 vs S+0 — иначе её Сбивает с ног (Ничком). Раз на атаку.">
      ${rollIcon("sword")}Тяжёлый Хук: ${esc(targetName) || "цель"} — S+0 vs S+0, иначе Ничком
    </button>
  </div>`;
}

/**
 * Секция карточки урона. Пустая строка — кнопки нет (цель уже лежит). Метку «Хук был выбран» несёт сама кнопка урона.
 */
export function haymakerSection({ attackerUuid, targetActor, sourceMessageId = "" }) {
  if (!attackerUuid || !targetActor?.uuid) return "";
  if (targetActor.system?.conditions?.prone) return "";
  return haymakerButtonHtml({ attackerUuid, targetUuid: targetActor.uuid, targetName: targetActor.name, sourceMessageId });
}

/** Победа бьющего во встречном тесте: цель Ничком (Стена и прочие защиты — через общую точку наложения Состояния). */
export async function resolveHaymakerSuccess(actor, { target } = {}) {
  if (!target) return ui.notifications?.warn(`${actor.name}: цель Тяжёлого Хука не найдена — эффект не наложен.`);
  const { fields, resisted, note } = await statusApplyFields(target, "prone", null,
    { attacker: actor, melee: true, source: "Тяжёлый Хук" });
  if (Object.keys(fields).length) await writeToTarget(target, { kind: "update", data: fields }, actor);
  await postTestCard(actor, {
    icon: rollIcon("sword", "#e08a3a"),
    title: resisted ? "Тяжёлый Хук: устоял" : "Тяжёлый Хук: Сбит с ног",
    outcome: resisted ? esc(note) : `${esc(target.name)} сбит(а) с ног.`
  }, { sound: false });
}

/**
 * Открыть встречный тест S+0 vs S+0. Цель — актор, чей uuid несёт кнопка (между ударом и нажатием игрок мог
 * перевыцелить другого). claim — отметка «раз на атаку»: занимается в момент броска, «Отмена» её не съедает.
 */
export async function startHaymaker(attacker, targetUuid, { claim } = {}) {
  const { _showContestDialog } = await import("./techniques.mjs");
  const target = targetUuid ? await fromUuid(targetUuid).catch(() => null) : null;
  if (!target) {
    ui.notifications?.warn(`${attacker.name}: цель Тяжёлого Хука не найдена — состязание не начато.`);
    return false;
  }
  return _showContestDialog(attacker, {
    ...HAYMAKER_CONTEST, opponents: () => [target],
    ...(claim ? { pay: () => claim() } : {}),
    onSuccess: resolveHaymakerSuccess
  });
}

// ── Направляющий Удар ───────────────────────────────────────────────────────

/** Кнопка свободного Давления на карточке атаки (класс .wh-goading-btn слушает hooks.mjs). */
export function goadingStrikeButtonHtml({ actor, targetActor }) {
  if (!actor?.uuid || !targetActor?.uuid) return "";
  return `
    <div class="roll-damage-section roll-goading">
      <div class="roll-damage-label">Направляющий Удар (Талант)</div>
      <button class="wh-goading-btn" type="button"
        data-attacker-uuid="${esc(actor.uuid)}" data-target-uuid="${esc(targetActor.uuid)}"
        title="Успех удара кулаком (даже если цель Избежала) — Давление против цели за свободное действие: WS vs WS, при победе цель отступает на Успехи метров.">
        ${rollIcon("sword")}Давление на ${esc(targetActor.name) || "цель"} (свободное действие)
      </button>
    </div>`;
}

/** Открыть Давление (Состязание WS vs WS) против цели карточки — без траты ОД. */
export async function startGoadingPress(actor, targetUuid, { claim } = {}) {
  const { _showContestDialog } = await import("./techniques.mjs");
  const target = targetUuid ? await fromUuid(targetUuid).catch(() => null) : null;
  if (!target) {
    ui.notifications?.warn(`${actor.name}: цель Направляющего Удара не найдена — Давление не начато.`);
    return false;
  }
  return _showContestDialog(actor, {
    ...MELEE_CONTESTS.press,
    label: "Давление (Направляющий Удар)",
    note: `${MELEE_CONTESTS.press.note} Направляющий Удар: свободное действие после Успешного удара кулаком.`,
    opponents: () => [target],
    onSuccess: resolvePressSuccess,
    ...(claim ? { pay: () => claim() } : {})
  });
}

// ── Удар с Колена ───────────────────────────────────────────────────────────

/** Кнопки на карточке Захвата: в торс всегда, в голову — при победе на 5+ Успехов (класс .wh-knee-strike-btn). */
export function kneeStrikeButtonsHtml({ actorUuid, margin }) {
  const btn = (head, text, tip) => `<button class="wh-knee-strike-btn" type="button" data-head="${head ? 1 : 0}" data-actor-uuid="${esc(actorUuid)}"
      title="${esc(tip)}">${rollIcon("sword")}${esc(text)}</button>`;
  const tip = "Автоматическое попадание ногой, которой ещё не били в этом Ходу, профилем безоружного пинка. Нужно держать цель минимум 2 руками (окно Борьбы). Свободное действие, раз на карточку.";
  return [
    btn(false, "Удар с Колена в торс (авто-попадание)", tip),
    ...(kneeStrikeHeadOffered(margin) ? [btn(true, "Удар с Колена в голову, Оглушающее (0)", `${tip} Победа в Захвате на 5+ Успехов: голова вместо торса и свойство Concussive (0).`)] : [])
  ].join("");
}

/** Профиль безоружного пинка носителя: интегральный «Kick / Пинок» (а не Копыта и не чужое оружие на ноге). */
export function kneeStrikeKick(actor) {
  const kicks = [...(actor?.items ?? [])].filter(i => i?.type === "weapon" && isKickWeapon(i));
  return kicks.find(i => /Kick|Пинок/i.test(String(i.name ?? ""))) ?? null;
}

/**
 * Открыть окно атаки пинком: Стандартная База и Приём, авто-попадание, место торс/голова — всё проверено ДО
 * открытия окна (руки, свободная нога, профиль пинка). Плата «раз на карточку» — «Бросок!» окна (payOnRoll).
 * @param {Actor} actor
 * @param {{head?:boolean, messageId?:string}} opts
 * @returns {Promise<boolean>} окно открыто
 */
export async function startKneeStrike(actor, { head = false, messageId = "" } = {}) {
  const warn = text => { ui.notifications?.warn(`⚠️ Удар с Колена: ${text}`); return false; };
  const hands = Number(actor.getFlag?.(NS, GRAPPLE_HANDS)) || 0;
  if (!kneeStrikeHandsOk(hands)) return warn("цель нужно держать минимум 2 руками — добавьте руку в окне Борьбы.");
  if (legsFree(actor) < 1) return warn("все ноги персонажа уже били в этом Ходу.");
  const kick = kneeStrikeKick(actor);
  if (!kick) return warn("у персонажа нет профиля безоружного пинка («Kick / Пинок»).");
  // Бьём захваченного: выцеливаем партнёра по Борьбе, если токен найден (иначе цель выберет игрок).
  try {
    const partner = await fromUuid(actor.getFlag?.(NS, GRAPPLE_PARTNER) || "").catch(() => null);
    const token = partner?.getActiveTokens?.()?.[0];
    token?.setTarget?.(true, { releaseOthers: true });
  } catch { /* цель выберет игрок сам */ }
  await actor.sheet?._showAttackDialog?.(kick, {
    forceBase: "standard", kneeStrike: { head: !!head },
    ...(messageId ? { payOnRoll: { label: "Удар с Колена", cardId: messageId, cardKey: KNEE_STRIKE_CARD_FLAG } } : {})
  });
  return true;
}
