// module/combat/roundhouse.mjs
// ════════════════════════════════════════════════════════════════════════
//  ПИНОК С РАЗВОРОТА / Roundhouse Kick (Талант Пугилиста, стр. 62; задача
//  Sahara 3-eddb, решение владельца 24.10.2026).
//
//  «Когда он попадает по цели равного или меньше Размера ударом ногой с
//  Натиска или цель Парирует этот удар (но не если Уклоняется от него),
//  персонаж может пройти против цели тест Athletics(S)+10 vs Athletics(S)+0.
//  При победе он отбрасывает цель от себя на ½м за Успех, но не дальше ½S.b м.
//  Цель, отброшенная дальше ¼ ее A.b, также Сбивается с ног. Если у персонажа
//  хватает дистанции Натиска, он может выбрать продолжить Натиск за целью или
//  остаться на месте.»
//
//  ЧТО АВТОМАТИЗИРОВАНО
//  • Кнопка на карточке успешной атаки Пинком с Базы «Натиск» по цели не
//    крупнее атакующего. Условие «цель Парирует, но не Уклоняется» на момент
//    карточки неизвестно (защита ещё не брошена): кнопка показана при любом
//    попадании, и игрок не нажимает её, если цель Уклонилась (подсказка в самой
//    кнопке).
//  • Встречный тест — общий диалог Состязаний (techniques.mjs::_showContestDialog,
//    образец Повалить/Напролом): Athletics(S)+10 инициатора против Athletics(S)+0
//    цели, цель отвечает кнопкой в карточке.
//  • Дальность отброса = ½ м за Успех, не дальше ½S.b м. Сбив с ног — если
//    дальность СТРОГО больше ¼A.b цели в метрах. Округления нет: дальность
//    кратна ½ м, а «¼A.b» сравнивается точным числом (A.b 3 → 0,75 м; отброс на
//    1 м сбивает, на 0,5 м — нет). Книга округления не оговаривает.
//
//  ЧЕСТНЫЙ ПРЕДЕЛ: токен цели (и, при желании, самого пинающего — «продолжить
//  Натиск») двигает игрок/ГМ руками — в системе нет принудительного сдвига
//  токена цели; карточка называет дальность и направление «от персонажа».
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { statusApplyFields } from "./status-resist.mjs";
import { writeToTarget } from "./gm-relay.mjs";
import { sizeOf } from "../rules/predicates.mjs";
import { hasPugilistTalent } from "../rules/pugilist-talents.mjs";
import { isIntegralAttack } from "./equipped-melee.mjs";

/** Бонус инициатора: Athletics(S)+10 против Athletics(S)+0. */
export const ROUNDHOUSE_INITIATOR_BONUS = 10;

const bonusOf = (actor, key) => Number(actor?.system?.characteristics?.[key]?.bonus) || 0;

/**
 * Дальность отброса и сбив с ног по книге.
 * @returns {{distance:number, cap:number, knockdownThreshold:number, knockedDown:boolean}}
 */
export function roundhouseKnockback({ deg, strengthBonus, targetAgilityBonus }) {
  const cap = Math.max(0, Number(strengthBonus) || 0) / 2;
  const distance = Math.min(Math.max(0, Number(deg) || 0) * 0.5, cap);
  const knockdownThreshold = Math.max(0, Number(targetAgilityBonus) || 0) / 4;
  return { distance, cap, knockdownThreshold, knockedDown: distance > knockdownThreshold };
}

/** Удар ногой? Хват «Ног» (Пинок, копыта) у интегральной атаки. */
export function isKickWeapon(weapon) {
  return isIntegralAttack(weapon) && /Ног/.test(String(weapon?.system?.grips ?? ""));
}

/**
 * Можно ли предложить Пинок с Разворота после этой атаки: носитель Таланта,
 * удар ногой с Натиска, попадание, цель не крупнее.
 */
export function roundhouseOffered({ actor, weapon, baseKey, hit, targetActor }) {
  if (!hit || !targetActor || baseKey !== "charge") return false;
  if (!isKickWeapon(weapon) || !hasPugilistTalent(actor, "roundhouseKick")) return false;
  return sizeOf(targetActor) <= sizeOf(actor);
}

/** Блок кнопки для карточки атаки; пустая строка, если Таланта/условий нет. */
export function roundhouseButtonHtml(args) {
  if (!roundhouseOffered(args)) return "";
  const { actor, targetActor } = args;
  return `
    <div class="roll-damage-section roll-roundhouse">
      <div class="roll-damage-label">Пинок с Разворота (Талант)</div>
      <button class="wh-roundhouse-btn" type="button"
        data-attacker-uuid="${esc(actor.uuid ?? "")}" data-target-uuid="${esc(targetActor.uuid ?? "")}"
        title="Если цель Парировала или пинок попал: Athletics(S)+10 против Athletics(S)+0. Если цель Уклонилась — не нажимайте.">
        ${rollIcon("sword")}Отбросить цель (Athletics(S)+10 vs Athletics(S))
      </button>
    </div>`;
}

/** Победа в состязании: дальность отброса и, если дальше ¼A.b цели, Ничком. */
export async function resolveRoundhouseSuccess(actor, { deg, target } = {}) {
  if (!target) {
    return ui.notifications?.warn(`${actor.name}: цель Пинка с Разворота не найдена — эффект не наложен.`);
  }
  const k = roundhouseKnockback({
    deg, strengthBonus: bonusOf(actor, "s"), targetAgilityBonus: bonusOf(target, "ag")
  });
  const sections = [
    `<div class="roll-threshold">${esc(target.name)} отброшен(а) от ${esc(actor.name)} на <b>${k.distance}</b> м `
    + `(½ м за Успех, не дальше ½S.b = ${k.cap} м) — сдвиньте токен вручную.</div>`
  ];
  if (k.distance <= 0) {
    sections.push(`<div class="roll-threshold">Дальность 0 — цель остаётся на месте.</div>`);
  } else if (k.knockedDown) {
    // Стена (Талант Стойкости) вправе остановить падение — общая точка наложения.
    const { fields, resisted, note } = await statusApplyFields(target, "prone", null,
      { attacker: actor, melee: true, source: "Пинок с Разворота" });
    // Цель обычно чужой NPC — запись через ГМа (combat/gm-relay.mjs); без ГМа writeToTarget предупредит сам,
    // а карточка всё равно нужна: в ней дальность/проход/урон, не только «Ничком».
    if (Object.keys(fields).length) await writeToTarget(target, { kind: "update", data: fields }, actor);
    sections.push(resisted
      ? `<div class="roll-threshold">Дальше ¼A.b (${k.knockdownThreshold} м): ${esc(note)}</div>`
      : `<div class="roll-threshold">Отброшена дальше ¼A.b (${k.knockdownThreshold} м) — ${esc(target.name)} сбит(а) с ног.</div>`);
  } else {
    sections.push(`<div class="roll-threshold">Не дальше ¼A.b (${k.knockdownThreshold} м) — на ногах.</div>`);
  }
  sections.push(`<div class="roll-threshold">Хватает дистанции Натиска — можно продолжить Натиск за целью или остаться на месте.</div>`);
  await postTestCard(actor, {
    icon: rollIcon("sword", "#e08a3a"),
    title: `Пинок с Разворота: ${esc(target.name)}`,
    sections
  }, { sound: false });
}

/**
 * Открыть общий диалог Состязания. Цель — актор, чей uuid несёт кнопка карточки
 * (data-target-uuid): между атакой и нажатием игрок мог перевыцелить другого, а
 * отбросить надо того, кого ударили. Без uuid (старая карточка) — выцеленный токен.
 * claim — «раз на карточку» (hooks.mjs): занимается в момент броска, чтобы «Отмена» не гасила кнопку.
 */
export async function startRoundhouse(actor, { targetUuid = "", claim } = {}) {
  const { _showContestDialog } = await import("./techniques.mjs");
  const target = targetUuid ? await fromUuid(targetUuid).catch(() => null) : null;
  if (targetUuid && !target) {
    ui.notifications?.warn(`${actor.name}: цель карточки Пинка с Разворота не найдена — состязание не начато.`);
    return false;
  }
  return _showContestDialog(actor, {
    ...(target ? { opponents: () => [target] } : {}),
    ...(claim ? { pay: () => claim() } : {}),
    label: "Пинок с Разворота", wsBonus: 0,
    modLabel: "Ath vs Ath",
    defaultChar: "s",
    skills: { s: "athletics" },
    resist: [{ skill: "athletics" }],
    defaultMod: ROUNDHOUSE_INITIATOR_BONUS,
    note: "Athletics(S)+10 vs Athletics(S)+0. Победа: цель отброшена на ½ м за Успех (не дальше ½S.b м); отброшенная дальше ¼A.b — сбита с ног.",
    chatNote: "⚡ Состязательный бросок Athletics (Пинок с Разворота: +10 пинающему)",
    onSuccess: resolveRoundhouseSuccess
  });
}
