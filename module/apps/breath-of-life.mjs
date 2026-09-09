// module/apps/breath-of-life.mjs
//
// UI/действие Дара Нургла «Breath of Life / Дыхание Жизни» (wdbc-1rno) —
// арифметика и разбор книжных оговорок в module/rules/breath-of-life.mjs.
//
// Цель берётся штатным таргетингом Foundry (game.user.targets), как у любого
// другого адресного действия системы: «труп» это токен на сцене, выбранный
// игроком. Проверить, что он мёртв и умер не позже трёх дней назад, движку
// нечем — понятия смерти в системе нет; ответственность за выбор цели
// остаётся за столом, карточка об этом честно напоминает.

import { isBreathOfLifeItem, breathOfLifeAvailable, breathOfLifeSelfWounds,
         revivedCorpseUpdate, woundsFullyHealed, BREATH_SPENT_FLAG } from "../rules/breath-of-life.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";

export { isBreathOfLifeItem };

const NS = "warhammer-dbc";

/** Нажатие кнопки «Вдохнуть жизнь» на листе Дара. */
export async function useBreathOfLife(actor, item) {
  if (!isBreathOfLifeItem(item) || !actor) return;

  const spent = !!actor.getFlag(NS, BREATH_SPENT_FLAG);
  if (!breathOfLifeAvailable(actor.system, spent))
    return ui.notifications?.warn("Дыхание Жизни: недоступно, пока Раны не вылечены полностью.");

  const target = game.user.targets?.first?.() ?? [...(game.user.targets ?? [])][0];
  const targetActor = target?.actor;
  if (!targetActor)
    return ui.notifications?.warn("Дыхание Жизни: выберите цель — токен трупа, в который вдыхают жизнь.");

  const selfWounds = breathOfLifeSelfWounds(actor.system);
  const selfUpdate = { [`flags.${NS}.${BREATH_SPENT_FLAG}`]: true };
  if (selfWounds !== null) selfUpdate["system.wounds.value"] = selfWounds;
  await actor.update(selfUpdate);
  await targetActor.update(revivedCorpseUpdate());

  await postTestCard(actor, {
    icon: rollIcon("warp", "#7fd36a"),
    title: "Дыхание Жизни",
    lines: [
      selfWounds !== null
        ? `<div class="roll-threshold">Раны ${esc(actor.name)}: <b>0</b> — отданы целиком.</div>`
        : `<div class="roll-threshold">Раны ${esc(actor.name)} и так были на нуле или ниже — цена не взята (книга: «если они не были ниже»).</div>`,
      `<div class="roll-threshold">${esc(targetActor.name)} возвращается к жизни с <b>0</b> Ран, отрицательные сняты.</div>`,
      `<div class="roll-threshold" style="opacity:.8;">Повторно — только после полного излечения Ран. Срок смерти цели (не более 3 дней) и выбор Тзинчита/Слаанешита «остаться мёртвым либо потерять покровительство» решает стол.</div>`
    ]
  }, { sound: false });
}

/** Кнопка на листе предмета — пусто, если это не «Дыхание Жизни» или нет актора. */
export function breathOfLifeButtonHtml(item, actor) {
  if (!isBreathOfLifeItem(item) || !actor) return "";
  const spent = !!actor.getFlag?.(NS, BREATH_SPENT_FLAG);
  const ready = breathOfLifeAvailable(actor.system, spent);
  const hint = ready
    ? "Выберите цель — токен трупа — и нажмите: свои Раны уйдут в 0, цель встанет с 0 Ран."
    : `Использовано. Снова станет доступно, когда Раны будут вылечены полностью${woundsFullyHealed(actor.system) ? "" : " (сейчас — нет)"}.`;
  return `<div class="breath-of-life-panel">
    <div class="breath-of-life-hint">${hint}</div>
    <button type="button" class="breath-of-life-btn" data-item-id="${item.id}" ${ready ? "" : "disabled"}>
      ${rollIcon("warp","#7fd36a")}Вдохнуть жизнь
    </button>
  </div>`;
}
