// module/apps/icon-of-blasphemy.mjs
// ════════════════════════════════════════════════════════════════════════
//  Мутация «Icon of Blasphemy / Икона Богохульства» (wdbc-zbc0) — раз за
//  бой/сцену свободным действием мутант проявляет вокруг себя иллюзию на
//  1 Раунд. См. module/rules/icon-of-blasphemy.mjs про то, чем это ОТЛИЧАЕТСЯ
//  от Illusion of Normality (свой кулдаун на самом мутанте, не на
//  наблюдателе; два РАЗНЫХ теста для двух групп свидетелей).
//
//  Кто есть кто среди текущих Foundry-целей (game.user.targets) — выбор ГМа
//  на момент активации, диалогом с чекбоксом на каждой цели («засёк
//  Пси-чутьём/Ноосферой» — иначе считается обычным «увидел»): надёжного
//  автоопределения психайкера/Механикум по данным актора в системе нет,
//  придумывать его не стали (тот же принцип, что «LOS нигде не
//  автоматизирован» по всему проекту).
//
//  Последствия:
//   • «Видел» (Ярость) — провал W+0 у цели включает system.inRage (простой
//     тумблер, module/combat/frenzy.mjs, уже открытый для сторонних
//     источников). «Считает персонажа единственным врагом» — не
//     автоматизировано (Ярость как система принуждения нигде не
//     реализована), только флейвор-строка в карточке.
//   • «Засёк Пси-чутьём/Ноосферой» (принуждение к атаке) — провал W+0 НЕ
//     включает Ярость, само принуждение атаковать следующий Ход — тоже
//     только флейвор-строка (нет движка принудительных целей).
// ════════════════════════════════════════════════════════════════════════

import { isIconOfBlasphemyItem } from "../rules/icon-of-blasphemy.mjs";
import { isRuleUsageUsed, markRuleUsageUsed } from "../rules/cooldown.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

export { isIconOfBlasphemyItem };

const FLAG = "iconOfBlasphemy";

/** Текущие Foundry-цели как акторы (без дублей/пустышек). */
function currentTargetActors() {
  return [...(game.user?.targets ?? [])].map(t => t.actor).filter(Boolean);
}

/** Диалог: список текущих целей с чекбоксом «засёк Пси-чутьём/Ноосферой». Возвращает Map(actor→psychic) или null. */
async function promptWitnessGroups(targets) {
  const rows = targets.map((actor, i) => `
    <div class="form-group">
      <label>
        <input type="checkbox" name="psychic-${i}"/>
        ${esc(actor.name)} — засёк Пси-чутьём/Ноосферным Сканированием
      </label>
    </div>`).join("");
  const content = `<form class="hw-choice-form">
    <p>По умолчанию цель просто «увидела» проявление (тест на Ярость).
       Отметьте тех, кто засёк его именно Пси-чутьём/Ноосферным Сканированием
       (тест на принуждение атаковать, без Ярости).</p>
    ${rows}
  </form>`;
  return foundry.applications.api.DialogV2.wait({
    window: { title: "Икона Богохульства: кто и как заметил" },
    classes: ["warhammer-dbc", "wh-holo", "hw-choice-dialog"],
    content,
    rejectClose: false,
    buttons: [
      {
        action: "ok", label: "Проявить", icon: "fas fa-burst", default: true,
        callback: (event, button) => targets.map((actor, i) =>
          ({ actor, psychic: !!button.form.elements[`psychic-${i}`]?.checked }))
      },
      { action: "cancel", label: "Отмена", callback: () => null }
    ]
  });
}

/**
 * Ядро уже РЕШЁННОГО проявления — тест W+0 на каждую цель группы, Ярость/
 * флейвор-принуждение, одна сводная чат-карточка. Отделено от диалога
 * (activateIconOfBlasphemy ниже) тем же приёмом, что applyHandOfDeathFusion/
 * useHandOfDeath (apps/hand-of-death.mjs) — тестируется без стаба DialogV2.
 * groups — [{actor, psychic}], actor — мутант (для спикера карточки).
 */
export async function resolveIconOfBlasphemy(actor, groups) {
  const rows = [];
  for (const { actor: target, psychic } of groups) {
    const wp = target.system.characteristics?.wp?.total ?? 0;
    const roll = await new Roll("1d100").evaluate();
    const { success } = testOutcome(roll.total, wp);
    let note;
    if (psychic) {
      note = success ? "устоял(а)" : "провал — вынужден(а) весь следующий Ход атаковать персонажа";
    } else {
      note = success ? "устоял(а)" : "провал — впадает в Ярость (единственный враг в поле зрения)";
      if (!success) await target.update({ "system.inRage": true });
    }
    rows.push(`<div class="roll-threshold">${psychic ? "🧠" : "👁"} <b>${esc(target.name)}</b> — WP ${wp}, бросок ${roll.total}: ` +
      `<span class="${success ? "roll-success" : "roll-failure"}">${note}</span></div>`);
  }

  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("burst", "#ff8f4d")}Икона Богохульства — ${esc(actor.name)}</div>
      ${rows.join("")}
    </div>`,
    sound: CONFIG.sounds.dice
  }, game.settings.get("core", "rollMode")));
}

/** Кнопка на листе предмета: гейт кулдауна/целей, диалог выбора групп, делегирует resolveIconOfBlasphemy. */
export async function activateIconOfBlasphemy(item, actor) {
  if (!isIconOfBlasphemyItem(item) || !actor) return;
  if (isRuleUsageUsed(actor, FLAG))
    return ui.notifications?.warn("Икона Богохульства уже проявлялась в этом бою/сцене.");

  const targets = currentTargetActors();
  if (!targets.length)
    return ui.notifications?.warn("Выберите Foundry-целями токены, что увидели проявление.");

  const groups = await promptWitnessGroups(targets);
  if (!groups) return;

  // Сама активация расходуется в любом случае, как только иллюзия
  // проявлена — исходы тестов целей на это не влияют.
  await markRuleUsageUsed(actor, FLAG);
  await resolveIconOfBlasphemy(actor, groups);
}

/** Кнопка на листе предмета — пусто, если это не «Икона Богохульства» или нет актора. */
export function iconOfBlasphemyButtonHtml(item, actor) {
  if (!isIconOfBlasphemyItem(item) || !actor) return "";
  const ready = !isRuleUsageUsed(actor, FLAG);
  return `<div class="icon-of-blasphemy-panel">
    <div class="icon-of-blasphemy-status">${ready ? "Готово" : "Уже проявлена в этом бою/сцене"}</div>
    <button type="button" class="icon-of-blasphemy-btn" data-item-id="${item.id}" ${ready ? "" : "disabled"}>
      ${rollIcon("burst", "#ff8f4d")}Проявить (свободное действие)
    </button>
  </div>`;
}
