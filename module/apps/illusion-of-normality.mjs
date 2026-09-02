// module/apps/illusion-of-normality.mjs
// ════════════════════════════════════════════════════════════════════════
//  Мутация «Illusion of Normality / Иллюзия Нормальности» (wdbc-zbc0):
//  «Персонаж не привлекает к себе внимания... Любые внешние проявления
//  мутаций игнорируются наблюдателями... работает как активно поддерживаемая
//  психосила и может быть замечена тестом Пси-чутья (Психонаука) с бонусом
//  +5 за каждую прочую мутацию персонажа. Псайкеры, что засекли действие
//  этой мутации, могут пройти тест на W+0, чтобы увидеть сквозь иллюзию, но
//  не более одной попытки за бой/сцену.»
//
//  Раньше подсистемы «замечен/не замечен как мутант» в движке не было вовсе
//  (capabilities.mjs::mutation.illusionOfNormality стояла честной заглушкой,
//  reader:""). Два разных действующих лица, два разных теста — обвязка живёт
//  здесь, чистые формула/ключи флагов — в rules/illusion-detection.mjs
//  (переиспользуемая часть, см. её файловый комментарий про Icon of
//  Blasphemy). Нет отдельного вида Механики Конструктора ради одной пары
//  Мутаций — тем же принципом, что Рука Смерти/Сус-ан Мембрана/Тест Страха:
//  свой маленький модуль + кнопка на листе предмета.
//
//  Наблюдатель берётся из текущего Foundry-таргета (game.user.targets) —
//  тот же приём выбора «второй стороны» взаимодействия, что и у Раковой
//  Мутации-исцеления (apps/cancerous-healing.mjs, если/когда домёржена) и
//  Bone Song. Состояние («заметил» / «потратил попытку увидеть сквозь»)
//  хранится флагом НА АКТОРЕ НАБЛЮДАТЕЛЯ — это его знание и его лимит, не
//  свойство мутанта — через готовый scene-scope кулдаун rules/cooldown.mjs
//  (isRuleUsageUsed/markRuleUsageUsed), составным именем флага на пару
//  наблюдатель↔мутант.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "../rules/predicates.mjs";
import { isRuleUsageUsed, markRuleUsageUsed } from "../rules/cooldown.mjs";
import { psyniscienceNoticeBonus, noticeFlagKey, seeThroughFlagKey } from "../rules/illusion-detection.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

const NAME = "Illusion of Normality";
const CAPABILITY_KEY = "mutation.illusionOfNormality";

/** Это предмет-Мутация «Иллюзия Нормальности»? */
export function isIllusionOfNormalityItem(item) {
  return item?.type === "mutation" && itemHasName(item, NAME);
}

/** Актор текущей Foundry-цели (game.user.targets) — наблюдатель, или null. */
function currentObserver() {
  const token = [...(game.user?.targets ?? [])][0];
  return token?.actor ?? null;
}

/** Число ПРОЧИХ Мутаций/Даров (type:"mutation") персонажа, без самой Иллюзии. */
function otherMutationCount(actor, excludeItemId) {
  return [...(actor?.items ?? [])].filter(i => i.type === "mutation" && i.id !== excludeItemId).length;
}

async function postTestCard({ actor, headerIcon, header, thresholdLine, roll, rv, success, note }) {
  const rollMode = game.settings.get("core", "rollMode");
  const dice = await roll.render();
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${headerIcon}${esc(header)}</div>
        <div class="roll-threshold">${thresholdLine}</div>
        <div class="roll-dice">Бросок: <b>${rv}</b></div>
        <div class="roll-outcome">${success
          ? `<span class="roll-success">Успех</span>`
          : `<span class="roll-failure">Провал</span>`}</div>
        ${note ? `<div class="roll-threshold" style="font-size:.85em;opacity:.8;">${note}</div>` : ""}
        <details class="roll-dice-details"><summary>${rollIcon("chart", "#8fd0ff")}Показать кубы</summary>${dice}</details>
      </div>`,
    rolls: [roll],
    sound: CONFIG.sounds.dice
  }, rollMode));
}

/**
 * Наблюдатель (текущая цель) тестирует Психонауку (Пси-чутьё), чтобы вообще
 * заметить активную иллюзию ЭТОГО мутанта. actor — владелец Мутации.
 */
export async function attemptNoticeIllusion(item, actor) {
  if (!isIllusionOfNormalityItem(item) || !actor) return;
  const observer = currentObserver();
  if (!observer) return ui.notifications?.warn("Выберите Foundry-целью токен наблюдателя.");

  const bonus = psyniscienceNoticeBonus(otherMutationCount(actor, item.id));
  const skill = observer.system.skills?.psyniscience?.total ?? -20;
  const threshold = skill + bonus;
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const success = rv <= threshold;

  if (success) await markRuleUsageUsed(observer, noticeFlagKey(CAPABILITY_KEY, actor.id));

  await postTestCard({
    actor: observer,
    headerIcon: rollIcon("target", "#8fd0ff"),
    header: `Психонаука — замечает иллюзию (${actor.name})`,
    thresholdLine: `Психонаука: <b>${skill}</b> + 5×Прочие мутации(${otherMutationCount(actor, item.id)}) = <b>${bonus}</b> → Порог: <b>${threshold}</b>`,
    roll, rv, success,
    note: success ? "Наблюдатель теперь знает про активную иллюзию — доступна попытка увидеть сквозь." : ""
  });
}

/**
 * Наблюдатель (текущая цель), уже заметивший иллюзию, тестирует W+0, чтобы
 * увидеть сквозь неё — не более одной попытки за бой/сцену НА ЭТОГО мутанта.
 */
export async function attemptSeeThroughIllusion(item, actor) {
  if (!isIllusionOfNormalityItem(item) || !actor) return;
  const observer = currentObserver();
  if (!observer) return ui.notifications?.warn("Выберите Foundry-целью токен наблюдателя.");

  if (!isRuleUsageUsed(observer, noticeFlagKey(CAPABILITY_KEY, actor.id)))
    return ui.notifications?.warn(`${observer.name} ещё не замечал(а) активную иллюзию этого персонажа.`);
  if (isRuleUsageUsed(observer, seeThroughFlagKey(CAPABILITY_KEY, actor.id)))
    return ui.notifications?.warn("Попытка увидеть сквозь иллюзию уже потрачена в этом бою/сцене.");

  const wp = observer.system.characteristics?.wp?.total ?? 0;
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const success = rv <= wp;

  // Попытка расходуется в любом случае — «не более одной попытки», а не
  // «пока не получится».
  await markRuleUsageUsed(observer, seeThroughFlagKey(CAPABILITY_KEY, actor.id));

  await postTestCard({
    actor: observer,
    headerIcon: rollIcon("warp", "#c9a8ff"),
    header: `W+0 — видит сквозь иллюзию (${actor.name})`,
    thresholdLine: `WP: <b>${wp}</b> → Порог: <b>${wp}</b>`,
    roll, rv, success,
    note: success ? "Мутации персонажа снова видны наблюдателю." : "Раз за бой/сцену на этого мутанта — попытка потрачена."
  });
}

/** Панель на листе предмета — пусто, если это не «Иллюзия Нормальности» или нет актора. */
export function illusionOfNormalityHtml(item, actor) {
  if (!isIllusionOfNormalityItem(item) || !actor) return "";
  const observer = currentObserver();
  let status;
  if (!observer) {
    status = "Foundry-цель не выбрана — наведите таргет на токен наблюдателя.";
  } else {
    const noticed = isRuleUsageUsed(observer, noticeFlagKey(CAPABILITY_KEY, actor.id));
    const usedUp  = isRuleUsageUsed(observer, seeThroughFlagKey(CAPABILITY_KEY, actor.id));
    status = `Цель: <b>${esc(observer.name)}</b> — ${noticed ? "заметил(а) иллюзию" : "ещё не заметил(а)"}` +
      (noticed ? `, попытка увидеть сквозь ${usedUp ? "потрачена" : "доступна"}` : "");
  }
  return `<div class="illusion-of-normality-panel">
    <div class="illusion-of-normality-status">${status}</div>
    <button type="button" class="illusion-notice-btn" data-item-id="${item.id}">
      ${rollIcon("target", "#8fd0ff")}Наблюдатель пытается заметить (Психонаука)
    </button>
    <button type="button" class="illusion-see-through-btn" data-item-id="${item.id}">
      ${rollIcon("warp", "#c9a8ff")}Увидеть сквозь иллюзию (W+0)
    </button>
  </div>`;
}
