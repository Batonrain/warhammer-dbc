// module/combat/hamstring.mjs
// ════════════════════════════════════════════════════════════════════════════
//  HAMSTRING / ПОДРЕЗАТЬ СУХОЖИЛЬЯ — Foundry-обвязка к rules/melee-talents.mjs
//  (Таланты «Рукопашные», Sahara 3-8dc5).
//
//  Книга: «Раз в Ход, когда Избирательная рукопашная атака персонажа в ногу наносит
//  непоглощенный урон по цели, он может пройти встречный тест A+0 vs A+0 и при Успехе
//  сбить цель с ног. Если персонаж побеждает на 5+ Успехов, цель также теряет одно
//  полудействие в свой следующий Ход. Этот Талант не работает с приемами от Талантов
//  Swift Attack и Lightning Attack.»
//
//  Кнопка рисуется в карточке урона (combat/damage.mjs), когда карточка несёт метку
//  hamstring (атака в Ногу Избирательно, не Быстрая/Молниеносная), урон реально прошёл
//  и цель ещё на ногах. Клик (hooks.mjs, .wh-hamstring-btn) открывает общий встречный
//  тест (combat/techniques.mjs::_showContestDialog): атакующий бросает A+0, цель
//  сопротивляется кнопкой «Сопротивляться» (combat/opposed-contest.mjs). Победа —
//  Состояние «Повален» через единую точку наложения (иммунитет и Стена учтены), на 5+
//  Успехов — долг полудействия на цели (тот же флаг, что у Пожирателя Времени,
//  combat/action-economy.mjs читает его в начале следующего Хода цели). Запись в цель
//  идёт через ГМ-релей (combat/gm-relay.mjs): игрок цель-NPC не владеет.
//
//  «Раз в Ход» мерится Раундом (одна метка на Раунд, HAMSTRING_ROUND_FLAG) — отметка
//  ставится в момент «Бросок!» окна (pay), «Отмена» её не съедает.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, outcomeHtml } from "../helpers/test-card.mjs";
import { statusApplyFields } from "./status-resist.mjs";
import { writeToTarget } from "./gm-relay.mjs";
import { HAMSTRING_ROUND_FLAG, HAMSTRING_HALF_ACTION_DEG, hamstringOffered } from "../rules/melee-talents.mjs";
import { isThrottleReady } from "../rules/cooldown.mjs";

/** Ключ отметки на карточке (белый список сокета — card-once.mjs::CARD_ONCE_FLAGS). */
export const HAMSTRING_CARD_FLAG = "hamstringUsed";

/** Определение Состязания: A+0 vs A+0 (Ловкость), без выбора другой характеристики. */
export const HAMSTRING_CONTEST = {
  label: "Подрезать Сухожилья", wsBonus: 0,
  modLabel: "A vs A",
  defaultChar: "ag",
  allowedChars: ["ag"],
  note: "A+0 vs A+0 после Избирательного попадания в ногу. Победа — цель Ничком; 5+ Успехов — цель теряет полудействие в свой следующий Ход.",
  targetDodgeMod: 0, targetParryMod: 0,
  chatNote: "⚡ Состязательный бросок A — сбить с ног подрезанным сухожилием"
};

/** Разметка кнопки (класс .wh-hamstring-btn слушает hooks.mjs). */
export function hamstringButtonHtml({ attackerUuid, targetUuid, targetName = "" }) {
  return `<div class="roll-defense-section">
    <button class="wh-hamstring-btn" type="button"
      data-attacker-uuid="${esc(attackerUuid)}" data-target-uuid="${esc(targetUuid)}"
      title="Подрезать Сухожилья: A+0 vs A+0 — при победе цель Ничком, на 5+ Успехов теряет полудействие в свой следующий Ход">
      ${rollIcon("sword")}Подрезать Сухожилья: ${esc(targetName)} (A+0 vs A+0)
    </button>
  </div>`;
}

/**
 * Секция карточки урона. Пустая строка — Талант не сработал.
 * @param {object} p attackerUuid, targetUuid, targetName, armed, net, targetProne
 */
export async function hamstringSection(p) {
  if (!p.attackerUuid || !p.targetUuid) return "";
  const attacker = await fromUuid(p.attackerUuid).catch(() => null);
  if (!attacker) return "";
  if (!hamstringOffered(attacker, { ...p, roundAvailable: isThrottleReady(attacker, HAMSTRING_ROUND_FLAG, "round") })) return "";
  return hamstringButtonHtml(p);
}

/**
 * Победа во встречном тесте: Повален; 5+ Успехов — долг полудействия цели.
 * Запись в цель — через ГМ (writeToTarget).
 */
export async function resolveHamstringSuccess(actor, { deg, target } = {}) {
  if (!target) return ui.notifications?.warn(`${actor.name}: цель Подрезать Сухожилья не найдена — эффект не наложен.`);
  const { fields, resisted, note } = await statusApplyFields(target, "prone", null,
    { attacker: actor, melee: true, source: "Подрезать Сухожилья" });
  if (Object.keys(fields).length && !(await writeToTarget(target, { kind: "update", data: fields }, actor))) return;

  const sections = [resisted
    ? `<div class="roll-threshold">${esc(note)}</div>`
    : `<div class="roll-threshold">${esc(target.name)} сбит(а) с ног (Ничком).</div>`];
  if (deg >= HAMSTRING_HALF_ACTION_DEG) {
    const ok = await writeToTarget(target, { kind: "apDebt" }, actor);
    if (ok) sections.push(`<div class="roll-threshold">${deg} Успехов: ${esc(target.name)} теряет одно полудействие (1 ОД) в свой следующий Ход.</div>`);
  }
  await postTestCard(actor, {
    icon: rollIcon("sword", "#e08a3a"),
    title: `Подрезать Сухожилья: ${esc(target.name)}`,
    outcome: outcomeHtml(true, `Победа — ${deg} степеней`),
    sections
  }, { sound: false });
}

/**
 * Открыть встречный тест. pay — отметка карточки и Раунда в момент «Бросок!»
 * (вызывается внутри окна, «Отмена» ничего не съедает).
 */
export async function startHamstring(attacker, target, { pay } = {}) {
  const { _showContestDialog } = await import("./techniques.mjs");
  await _showContestDialog(attacker, {
    ...HAMSTRING_CONTEST, opponents: () => [target], onSuccess: resolveHamstringSuccess,
    ...(pay ? { pay } : {})
  });
}

export { HAMSTRING_ROUND_FLAG };
