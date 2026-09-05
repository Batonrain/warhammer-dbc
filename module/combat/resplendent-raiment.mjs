// module/combat/resplendent-raiment.mjs
// ════════════════════════════════════════════════════════════════════════
//  Resplendent Raiment/Блистательные Одеяния (Дар Слаанеш, wdbc-sk8s):
//  «Раз за бой или сцену, потратив Очко Бесчестия, он может приковать к
//  величию своего одеяния всех вокруг: все, кто его видят, кроме тех, кого
//  он осознанно исключил из эффекта, должны пройти тест на W−30 (считается
//  как против психосилы), или до начала следующего Хода персонажа способны
//  видеть только его, считая всех остальных невидимыми.»
//
//  «Раз за бой ИЛИ сцену» — та же неоднозначная формулировка, что у
//  Adrenaline Rush (dodge.core.adrenalineRush, ещё не реализована): в бою
//  используется unit "battle", вне боя — "scene" (см. resplendentUnit()).
//
//  «Все, кто его видят» — LOS нигде в проекте не автоматизирован (см.
//  module/rules/aoe-target.mjs); вместо расчёта видимости берутся ВСЕ
//  токены сцены (кроме исключённых игроком) — сама книга отдаёт исключение
//  на усмотрение кастера («кого он осознанно исключил»), так что ручной
//  список исключений — не упрощение, а буквально то, что написано.
//
//  «Считается как против психосилы» и «видит только его, считая всех
//  остальных невидимыми» — тест проходит как обычный W−30, бонусы
//  психозащиты (Deny the Witch и т.п.) не подключены; эффект невидимости —
//  информационный флаг для стола, тем же уровнем автоматизации, что и
//  «Рейтинг Страха» у Грозного Вопля.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "../rules/predicates.mjs";
import { isThrottleReady, markThrottleUsed } from "../rules/cooldown.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";

const FLAG = "resplendentRaiment";

/** Владеет ли актор Даром Resplendent Raiment / Блистательные Одеяния. */
export function hasResplendentRaiment(actor) {
  return !!actor?.items?.some(i => i.type === "mutation" && itemHasName(i, "Resplendent Raiment"));
}

/** "battle" в бою, иначе "scene" — та же неоднозначность книги, что у Adrenaline Rush. */
export function resplendentUnit() {
  return game.combat?.started ? "battle" : "scene";
}

/** Доступно ли прямо сейчас. */
export function resplendentRaimentAvailable(actor) {
  return hasResplendentRaiment(actor) && isThrottleReady(actor, FLAG, resplendentUnit());
}

/**
 * Применяет эффект: тратит 1 Очко Бесчестия, гоняет W−30 по всем токенам
 * сцены (кроме excludedIds и самого кастера), провалившим ставит
 * информационный флаг «видит только кастера».
 * @param {Actor} caster
 * @param {TokenDocument} casterToken
 * @param {Set<string>} excludedIds — id токенов, которых кастер сознательно исключил
 */
export async function applyResplendentRaiment(caster, casterToken, excludedIds = new Set()) {
  const unit = resplendentUnit();
  // Очко Бесчестия — условие активации: без него не срабатывает и лимит цел.
  const fate = caster.system.fate?.value ?? 0;
  if (fate <= 0) return ui.notifications?.warn("Нет Очка Бесчестия — Блистательное Одеяние не активировано.");
  await caster.update({ "system.fate.value": fate - 1 });
  await markThrottleUsed(caster, FLAG, unit);

  const scene = casterToken?.parent;
  const candidates = (scene?.tokens?.contents ?? [])
    .filter(t => t.actor && t.id !== casterToken?.id && !excludedIds.has(t.id));

  const lines = [];
  for (const tokenDoc of candidates) {
    const targetActor = tokenDoc.actor;
    const threshold = (Number(targetActor.system?.characteristics?.wp?.total) || 0) - 30;
    const roll = await new Roll("1d100").evaluate();
    const { success } = testOutcome(roll.total, threshold);
    if (success) { lines.push(`${esc(targetActor.name)}: устоял(а) (${roll.total} vs ${threshold})`); continue; }
    await targetActor.setFlag("warhammer-dbc", "seesOnlyCaster", { casterUuid: caster.uuid });
    lines.push(`${esc(targetActor.name)}: провал (${roll.total} vs ${threshold}) — видит только ${esc(caster.name)}`);
  }

  await postTestCard(caster, {
    icon: rollIcon("crown", "#e08aff"), title: `Блистательные Одеяния — ${esc(caster.name)}`,
    lines: [
      `<div class="roll-threshold">Тест W−30 (как против психосилы) всем на сцене, кроме исключённых</div>`,
      ...(lines.length ? lines.map(l => `<div>${l}</div>`) : ["<div><i>Больше никого на сцене</i></div>"])
    ]
  }, { sound: false });
}
