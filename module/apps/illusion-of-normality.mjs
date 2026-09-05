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
//
//  «Активно поддерживаемая» (книга): персонаж может ПЕРЕСТАТЬ поддерживать
//  иллюзию — простой тумблер flags.warhammer-dbc.illusionMaintained на самой
//  Мутации, тем же приёмом, что techActive у энергосистем (sheets/tabs/
//  tech.mjs). По умолчанию (флага ещё нет) иллюзия поддерживается — так
//  ведёт себя способность у только что полученной Мутации. Выключенная
//  иллюзия — нечего замечать: кнопка «заметить» гейтится этим же флагом.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "../rules/predicates.mjs";
import { itemIs } from "../rules/item-marker.mjs";
import { isRuleUsageUsed, markRuleUsageUsed } from "../rules/cooldown.mjs";
import { psyniscienceNoticeBonus, noticeFlagKey, seeThroughFlagKey } from "../rules/illusion-detection.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { postTestCard, outcomeHtml } from "../helpers/test-card.mjs";

const NAME = "Illusion of Normality";
const CAPABILITY_KEY = "mutation.illusionOfNormality";
const MAINTAIN_FLAG = "illusionMaintained";

/** Это предмет-Мутация «Иллюзия Нормальности»? */
export function isIllusionOfNormalityItem(item) {
  return itemIs(item, "mutation", "mutation.illusionOfNormality", NAME);
}

/** Поддерживается ли иллюзия сейчас — по умолчанию (флага ещё нет) да. */
export function isIllusionMaintained(item) {
  return item?.getFlag?.("warhammer-dbc", MAINTAIN_FLAG) !== false;
}

/** Тумблер на листе предмета — персонаж сам решает, поддерживать иллюзию или нет. */
export async function setIllusionMaintained(item, maintained) {
  if (!isIllusionOfNormalityItem(item)) return;
  await item.setFlag("warhammer-dbc", MAINTAIN_FLAG, !!maintained);
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

/**
 * Тонкая обёртка над общим сборщиком (helpers/test-card.mjs, wdbc-kuun).
 * Раньше здесь лежала СВОЯ копия карточки теста — ровно тот случай, ради
 * которого сборщик и заводился: разметка расходилась с боевыми карточками, а
 * улучшать её пришлось бы отдельно.
 */
async function postIllusionCard({ actor, headerIcon, header, thresholdHtml, roll, rv, success, note }) {
  await postTestCard(actor, {
    icon: headerIcon, title: esc(header),
    threshold: `<div class="roll-threshold">${thresholdHtml}</div>`,
    rv,
    outcome: outcomeHtml(success, success ? "Успех" : "Провал"),
    sections: [
      note ? `<div class="roll-threshold" style="font-size:.85em;opacity:.8;">${note}</div>` : "",
      `<details class="roll-dice-details"><summary>${rollIcon("chart", "#8fd0ff")}Показать кубы</summary>${await roll.render()}</details>`
    ]
  }, { rolls: [roll] });
}

/**
 * Наблюдатель (текущая цель) тестирует Психонауку (Пси-чутьё), чтобы вообще
 * заметить активную иллюзию ЭТОГО мутанта. actor — владелец Мутации.
 */
export async function attemptNoticeIllusion(item, actor) {
  if (!isIllusionOfNormalityItem(item) || !actor) return;
  if (!isIllusionMaintained(item))
    return ui.notifications?.warn("Иллюзия сейчас не поддерживается — мутации персонажа видны как обычно.");
  const observer = currentObserver();
  if (!observer) return ui.notifications?.warn("Выберите Foundry-целью токен наблюдателя.");

  const bonus = psyniscienceNoticeBonus(otherMutationCount(actor, item.id));
  const skill = observer.system.skills?.psyniscience?.total ?? -20;
  // Общий сбор модификаторов (wdbc-ct65.3): раньше этот тест катался мимо
  // реестра правил — ни Усталость, ни Черты/Таланты в него не попадали.
  // Тест НАБЛЮДАТЕЛЯ: замечает он, значит и модификаторы его.
  const ruleMods = collectTestMods(observer, { kind: "skill", skill: "psyniscience", char: "per" });
  const threshold = skill + bonus + ruleMods.total;
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const success = rv <= threshold;

  if (success) await markRuleUsageUsed(observer, noticeFlagKey(CAPABILITY_KEY, actor.id));

  await postIllusionCard({
    actor: observer,
    headerIcon: rollIcon("target", "#8fd0ff"),
    header: `Психонаука — замечает иллюзию (${actor.name})`,
    thresholdHtml: `Психонаука: <b>${skill}</b> + 5×Прочие мутации(${otherMutationCount(actor, item.id)}) = <b>${bonus}</b>${ruleMods.parts.map(p => ` ${p}`).join("")} → Порог: <b>${threshold}</b>`,
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
  // Тот же общий сбор, что у теста Псинауки выше (wdbc-ct65.3).
  const ruleMods = collectTestMods(observer, { kind: "skill", char: "wp" });
  const wpThreshold = wp + ruleMods.total;
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const success = rv <= wpThreshold;

  // Попытка расходуется в любом случае — «не более одной попытки», а не
  // «пока не получится».
  await markRuleUsageUsed(observer, seeThroughFlagKey(CAPABILITY_KEY, actor.id));

  await postIllusionCard({
    actor: observer,
    headerIcon: rollIcon("warp", "#c9a8ff"),
    header: `W+0 — видит сквозь иллюзию (${actor.name})`,
    // Порог показывался как голое WP, хотя успех считался по wpThreshold —
    // с Усталостью и Чертами наблюдателя. Игрок видел не то число, по
    // которому его бросок сравнивали (wdbc-kuun).
    thresholdHtml: `WP: <b>${wp}</b>${ruleMods.parts.map(p => ` ${p}`).join("")} → Порог: <b>${wpThreshold}</b>`,
    roll, rv, success,
    note: success ? "Мутации персонажа снова видны наблюдателю." : "Раз за бой/сцену на этого мутанта — попытка потрачена."
  });
}

/** Панель на листе предмета — пусто, если это не «Иллюзия Нормальности» или нет актора. */
export function illusionOfNormalityHtml(item, actor) {
  if (!isIllusionOfNormalityItem(item) || !actor) return "";
  const maintained = isIllusionMaintained(item);
  const maintainToggle = `<label class="illusion-maintain-toggle">
      <input type="checkbox" class="illusion-maintain-cb" data-item-id="${item.id}" ${maintained ? "checked" : ""}/>
      Активно поддерживается
    </label>`;

  if (!maintained) {
    return `<div class="illusion-of-normality-panel">
      ${maintainToggle}
      <div class="illusion-of-normality-status">Иллюзия сейчас не поддерживается — мутации персонажа видны как обычно, обнаруживать нечего.</div>
    </div>`;
  }

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
    ${maintainToggle}
    <div class="illusion-of-normality-status">${status}</div>
    <button type="button" class="illusion-notice-btn" data-item-id="${item.id}">
      ${rollIcon("target", "#8fd0ff")}Наблюдатель пытается заметить (Психонаука)
    </button>
    <button type="button" class="illusion-see-through-btn" data-item-id="${item.id}">
      ${rollIcon("warp", "#c9a8ff")}Увидеть сквозь иллюзию (W+0)
    </button>
  </div>`;
}
