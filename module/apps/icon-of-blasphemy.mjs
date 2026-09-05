// module/apps/icon-of-blasphemy.mjs
// ════════════════════════════════════════════════════════════════════════
//  Мутация «Icon of Blasphemy / Икона Богохульства» (wdbc-zbc0) — раз за
//  бой/сцену свободным действием мутант проявляет вокруг себя иллюзию на
//  1 Раунд. См. module/rules/icon-of-blasphemy.mjs про то, чем это ОТЛИЧАЕТСЯ
//  от Illusion of Normality (свой кулдаун на самом мутанте, не на
//  наблюдателе; два РАЗНЫХ теста для двух групп свидетелей) и про то, как
//  автоматически определяется группа каждой цели (classifyWitness —
//  Лоялист/не-Лоялист, Пси-чутьё/Ноосфера по Черте Psyker или Боевым Латам
//  Скитарии).
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
//   • Не-Лоялист среди целей — иллюзия на него/неё не действует вовсе,
//     строка в карточке без броска.
// ════════════════════════════════════════════════════════════════════════

import { isIconOfBlasphemyItem, classifyWitness } from "../rules/icon-of-blasphemy.mjs";
import { isRuleUsageUsed, markRuleUsageUsed } from "../rules/cooldown.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";

export { isIconOfBlasphemyItem };

const FLAG = "iconOfBlasphemy";

/** Текущие Foundry-цели как акторы (без дублей/пустышек). */
function currentTargetActors() {
  return [...(game.user?.targets ?? [])].map(t => t.actor).filter(Boolean);
}

/**
 * Тест W+0 на каждую цель (группа — classifyWitness), Ярость/флейвор-
 * принуждение, одна сводная чат-карточка. actor — мутант (спикер карточки).
 */
export async function resolveIconOfBlasphemy(actor, targets) {
  const rows = [];
  for (const target of targets) {
    const group = classifyWitness(target);
    if (!group) {
      rows.push(`<div class="roll-threshold">— <b>${esc(target.name)}</b> — не Лоялист, иллюзия на него/неё не действует</div>`);
      continue;
    }
    const psychic = group === "psychic";
    const wp = target.system.characteristics?.wp?.total ?? 0;
    // Общий сбор модификаторов (wdbc-ct65.3) — по ЦЕЛИ: сопротивляется она,
    // значит и Усталость с Чертами считаются её, а не носителя Иконы.
    const ruleMods = collectTestMods(target, { kind: "skill", char: "wp" });
    const threshold = wp + ruleMods.total;
    const roll = await new Roll("1d100").evaluate();
    const { success } = testOutcome(roll.total, threshold);
    let note;
    if (psychic) {
      note = success ? "устоял(а)" : "провал — вынужден(а) весь следующий Ход атаковать персонажа";
    } else {
      note = success ? "устоял(а)" : "провал — впадает в Ярость (единственный враг в поле зрения)";
      if (!success) await target.update({ "system.inRage": true });
    }
    rows.push(`<div class="roll-threshold">${psychic ? "🧠" : "👁"} <b>${esc(target.name)}</b> — WP ${wp}${ruleMods.parts.map(p => ` ${p}`).join("")}${ruleMods.total ? ` → ${threshold}` : ""}, бросок ${roll.total}: ` +
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

/** Кнопка на листе предмета: гейт кулдауна/целей, авто-классификация, делегирует resolveIconOfBlasphemy. */
export async function activateIconOfBlasphemy(item, actor) {
  if (!isIconOfBlasphemyItem(item) || !actor) return;
  if (isRuleUsageUsed(actor, FLAG))
    return ui.notifications?.warn("Икона Богохульства уже проявлялась в этом бою/сцене.");

  const targets = currentTargetActors();
  if (!targets.length)
    return ui.notifications?.warn("Выберите Foundry-целями токены, что увидели проявление.");

  // Сама активация расходуется в любом случае, как только иллюзия
  // проявлена — исходы тестов целей на это не влияют.
  await markRuleUsageUsed(actor, FLAG);
  await resolveIconOfBlasphemy(actor, targets);
}

/** Панель на листе предмета — пусто, если это не «Икона Богохульства» или нет актора. */
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
