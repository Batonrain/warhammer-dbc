// module/apps/talent-actions.mjs
// ════════════════════════════════════════════════════════════════════════
//  Кнопки-действия на листе Таланта (3-b530): Талант, чей эффект — не бросок,
//  а подготовка «до следующего теста», получает на своём листе панель с
//  кнопкой (тот же приём, что Рука-Пушка / Чёрная Мантия: HTML для шаблона
//  talent.hbs + обработчик в sheets/item-sheet.mjs).
//
//  • Предусмотрительность (Foresight, sage.core.foresight): «Обдумать 5 минут» —
//    ставит флаг актора foresightReady; ситуативное правило rules/situational.mjs
//    даёт +10 на следующий тест I, sheets/actor-sheet.mjs::_runTest гасит флаг
//    после теста Int. Книга: «если тот сам не требует более часа работы» и сами
//    5 минут игрового времени — на совести стола.
// ════════════════════════════════════════════════════════════════════════

import { itemHasKey, itemIs } from "../rules/item-marker.mjs";
import { FORESIGHT_READY_FLAG } from "../rules/situational.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";

const SYSTEM = "warhammer-dbc";
export const FORESIGHT_KEY = "sage.core.foresight";

export const isForesightItem = item => item?.type === "talent" && itemHasKey(item, FORESIGHT_KEY);
export const foresightReady = actor => !!actor?.getFlag?.(SYSTEM, FORESIGHT_READY_FLAG);

/** Гасит подготовку после теста I (вызывается из _runTest). Не трогает флаг, если его не было. */
export async function clearForesight(actor) {
  if (foresightReady(actor)) await actor.unsetFlag(SYSTEM, FORESIGHT_READY_FLAG);
}

export const BLADE_JUGGLER_KEY = "rogue.core.bladeJuggler";
export const isBladeJugglerItem = item => item?.type === "talent" && itemHasKey(item, BLADE_JUGGLER_KEY);

export const WAR_CRY_KEY = "social.core.warCry";
export const isWarCryItem = item => item?.type === "talent" && itemHasKey(item, WAR_CRY_KEY);

export const TANDEM_KEY = "weaponsmith.core.tandem";
// Предметы у игроков — снимки: Талант, купленный до появления записи Конструктора, ключа не несёт, поэтому и по имени.
export const isTandemItem = item => itemIs(item, "talent", TANDEM_KEY, "Tandem");
export const MELTDOWN_KEY = "weaponsmith.core.meltdown";
export const isMeltdownItem = item => itemIs(item, "talent", MELTDOWN_KEY, "Meltdown");

// Драконий Рыцарь (Всадник): предмет у игрока — снимок, поэтому опознаётся и по имени.
export const DRAGON_KNIGHT_KEY = "rider.core.dragonKnight";
export const isDragonKnightItem = item => itemIs(item, "talent", DRAGON_KNIGHT_KEY, "Dragon Knight");

export const BLESSING_OF_STEEL_KEY = "mechanicum.core.blessingOfSteel";
// Предметы у игроков — снимки: Талант, купленный до появления записи, ключа не несёт, поэтому и по имени.
export const isBlessingOfSteelItem = item => itemIs(item, "talent", BLESSING_OF_STEEL_KEY, "Blessing of Steel");

/** Панель(и) для листа Таланта; пусто у прочих Талантов и у предмета вне актора. */
export function talentActionsHtml(item, actor) {
  if (!actor) return "";
  if (isDragonKnightItem(item)) {
    return `<div class="talent-action-panel">
      <button type="button" class="talent-action-btn" data-talent-action="dragonKnight" data-item-id="${esc(item.id)}"
        title="Полудействие, всадник и скакун в одну Инициативу: Survival−10 — скакун получает +3×Успехи на все Атаки или все Избегания до начала следующего Хода.">
        ${rollIcon("shield", "#ffb84d")}Вдохновить скакуна (Survival−10)
      </button>
    </div>`;
  }
  if (isBlessingOfSteelItem(item)) {
    return `<div class="talent-action-panel">
      <button type="button" class="talent-action-btn" data-talent-action="blessingOfSteel" data-item-id="${esc(item.id)}"
        title="5 минут ритуала: оружие или набор брони получает +1 к Качеству до конца следующего боя. Только один предмет одновременно.">
        ${rollIcon("wrench", "#ffb84d")}Благословить предмет (ритуал 5 минут)
      </button>
    </div>`;
  }
  if (isMeltdownItem(item)) {
    return `<div class="talent-action-panel">
      <button type="button" class="talent-action-btn" data-talent-action="meltdown" data-item-id="${esc(item.id)}"
        title="Полудействие: лаз-оружие в руках с Power Setting и металлический нож — тест Tech-Use+10. Провал — оружие сломано; Успех — взрыв через 1d5 Раундов в начале Хода (3d10+10, Pen 14, Blast 3); 1–4 Успеха срок бросает ГМ втайне; Критический Провал — взрыв сразу.">
        ${rollIcon("bolt", "#ffb84d")}Расплавить лаз-оружие (полудействие)
      </button>
    </div>`;
  }
  if (isTandemItem(item)) {
    return `<div class="talent-action-panel">
      <button type="button" class="talent-action-btn" data-talent-action="tandemEmbed" data-item-id="${esc(item.id)}"
        title="За ¼ смены встроить пистолет или винтовку в Тяжёлое оружие: оно получает второй профиль (свой магазин, скорострельность, боеприпас), встроенное оружие уходит с листа. Вместе с Полным Огнём можно стрелять из обоих разом.">
        ${rollIcon("wrench", "#ffb84d")}Встроить оружие в тяжёлое
      </button>
      <button type="button" class="talent-action-btn" data-talent-action="tandemExtract" data-item-id="${esc(item.id)}"
        title="Достать встроенное оружие обратно отдельным предметом (с остатком патронов в магазине).">
        ${rollIcon("wrench", "#ffb84d")}Извлечь встроенное
      </button>
    </div>`;
  }
  if (isWarCryItem(item)) {
    return `<div class="talent-action-panel">
      <button type="button" class="talent-action-btn" data-talent-action="warCry" data-item-id="${esc(item.id)}"
        title="Свободное действие в начале своего Хода: рейтинг Страха 1 (или +1 к текущему) до начала следующего Хода. Стоит 1 Усталости.">
        ${rollIcon("skull", "#ff8a8a")}Боевой клич (+1 Усталости)
      </button>
    </div>`;
  }
  if (isBladeJugglerItem(item)) {
    return `<div class="talent-action-panel">
      <button type="button" class="talent-action-btn" data-talent-action="bladeJuggler" data-item-id="${esc(item.id)}"
        title="Раз в Ход, с ножом в руке и пустой второй рукой: Deceive(WS)+0 против Awareness(P)+0 выцеленного противника. Победа — штраф Успехи×5 на его Избегания от следующей атаки ножом в этот Ход.">
        ${rollIcon("sword", "#e08a3a")}Жонглировать клинком (выцельте противника)
      </button>
    </div>`;
  }
  if (isForesightItem(item)) {
    const ready = foresightReady(actor);
    return `<div class="talent-action-panel">
      <div class="talent-action-status">${ready
        ? "Курс действий обдуман: +10 на следующий тест I (гаснет после него)."
        : "Подготовка не проведена."}</div>
      <button type="button" class="talent-action-btn" data-talent-action="foresight" data-item-id="${esc(item.id)}"
        title="Потратив 5 минут на обдумывание задачи — +10 на следующий тест I, если тот сам не требует более часа работы (5 минут игрового времени считает стол).">
        ${rollIcon("chart", "#8fd0ff")}Обдумать 5 мин
      </button>
    </div>`;
  }
  return "";
}

/** Обработчик кнопки. Возвращает true, если действие выполнено. */
export async function runTalentAction(action, item, actor) {
  if (!actor) return false;
  if (action === "dragonKnight") {
    if (!isDragonKnightItem(item)) return false;
    const { dragonKnightTest } = await import("../combat/mount.mjs");
    return !!(await dragonKnightTest(actor));
  }
  if (action === "blessingOfSteel") {
    if (!isBlessingOfSteelItem(item)) return false;
    const { startBlessingOfSteel } = await import("../combat/blessing-of-steel.mjs");
    return !!(await startBlessingOfSteel(actor));
  }
  if (action === "meltdown") {
    if (!isMeltdownItem(item)) return false;
    const { startMeltdown } = await import("../combat/meltdown.mjs");
    return !!(await startMeltdown(actor));
  }
  if (action === "tandemEmbed" || action === "tandemExtract") {
    if (!isTandemItem(item)) return false;
    const { startTandemEmbed, startTandemExtract } = await import("../combat/tandem.mjs");
    return action === "tandemEmbed" ? startTandemEmbed(actor) : startTandemExtract(actor);
  }
  if (action === "warCry") {
    if (!isWarCryItem(item)) return false;
    // Усталость — единая точка начисления (учитывает иммунитеты и счётчик).
    const { addFatigue } = await import("../sheets/tabs/conditions.mjs");
    await addFatigue(actor, 1);
    const own = Number(actor.system?.fearRating) || 0;
    await postTestCard(actor, {
      icon: rollIcon("skull", "#ff8a8a"), title: `Боевой клич — ${esc(actor.name)}`,
      threshold: `<div class="roll-threshold">Свободное действие в начале Хода: рейтинг Страха <b>${own > 0 ? `${own} → ${own + 1}` : "1"}</b> до начала следующего Хода (врагам — тест Страха против него). Усталость <b>+1</b> учтена. Пси-чутьё засекает клич как сверхъестественный.</div>`
    }, { sound: false });
    return true;
  }
  if (action === "bladeJuggler") {
    if (!isBladeJugglerItem(item)) return false;
    const { startBladeJuggler } = await import("../combat/blade-juggler.mjs");
    return startBladeJuggler(actor);
  }
  if (action === "foresight") {
    if (!isForesightItem(item)) return false;
    await actor.setFlag(SYSTEM, FORESIGHT_READY_FLAG, true);
    await postTestCard(actor, {
      icon: rollIcon("chart", "#8fd0ff"), title: `Предусмотрительность — ${esc(actor.name)}`,
      threshold: `<div class="roll-threshold">5 минут раздумий: курс действий выбран — <b>+10</b> на следующий тест I (если тот сам не требует более часа работы).</div>`
    }, { sound: false });
    return true;
  }
  return false;
}
