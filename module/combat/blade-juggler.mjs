// module/combat/blade-juggler.mjs
// ════════════════════════════════════════════════════════════════════════
//  ЖОНГЛЁР КЛИНКОМ / Blade Juggler (Талант Разбойника, стр. 62; задача Sahara
//  3-bfbf, решения владельца 24.10.2026).
//
//  «Когда он вооружен ножом и имеет пустую руку, персонаж может раз в Ход за
//  ментальное свободное действие пройти против любого противника тест
//  Deceive(WS)+0 vs Awareness(P)+0, при победе накладывая на цель штраф
//  Успехи×5 на ее тесты Избеганий от его следующей атаки ножом в этот Ход.
//  Независимо от победы или проигрыша, это занимает свободную руку, что не
//  дает совершать ею атаки в этот Ход.»
//
//  ЧТО АВТОМАТИЗИРОВАНО
//  • Кнопка на листе Таланта (apps/talent-actions.mjs): проверяет нож в руках,
//    свободную руку и «раз в Ход», открывает общий встречный тест (techniques.mjs::
//    _showContestDialog) против выцеленного противника: Deceive с базой WS
//    (Навык Deceive в системе на Fel, поэтому база WS подставлена поправкой
//    extraBonus = WS − Fel) против Awareness(P).
//  • Победа: на носителе метка bladeJugglerMark { цель, штраф = Успехи победы × 5 }
//    (rules/rogue-talents.mjs). Следующая атака ножом по этой цели в окне атаки
//    снимает метку и вычитает штраф из порога её Уклонения и Парирования (attack.mjs).
//    Метка и «раз в Ход» снимаются в начале Хода носителя (hooks.mjs).
//
//  НЕ автоматизировано: «Успехи» читаются как Успехи победы во встречном тесте
//  (разница степеней, как в Талантах Пугилиста) — книга не уточняет; «занятая
//  свободная рука» — подсказка в карточке (система не отслеживает, какой рукой
//  бьют).
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { isEncounterActive } from "./action-economy.mjs";
import { handsOccupied } from "../rules/hands.mjs";
import { isKnifeWeapon } from "../rules/unseen-talents.mjs";
import {
  bladeJugglerPenalty, bladeJugglerUsedThisTurn, markBladeJuggler, BLADE_JUGGLER_USE_FLAG
} from "../rules/rogue-talents.mjs";

const NS = "warhammer-dbc";

/** Победа во встречном тесте: метка на носителе + карточка с величиной штрафа. */
export async function resolveBladeJugglerSuccess(actor, { target, margin: rawMargin = 0, deg } = {}) {
  if (!target) return;
  // Победа «меньшим провалом» (свой тест провален, deg 0) Успехов не даёт — как у Талантов Пугилиста.
  const margin = deg === 0 ? 0 : rawMargin;
  const penalty = bladeJugglerPenalty(margin);
  await markBladeJuggler(actor, target.uuid, penalty);
  await postTestCard(actor, {
    icon: rollIcon("sword", "#e08a3a"), title: `Жонглёр Клинком — ${esc(actor.name)} → ${esc(target.name)}`,
    sections: [
      `<div class="roll-threshold">Победа на ${margin} Успех. — ${esc(target.name)} получает <b>−${penalty}</b> на Уклонение и Парирование `
      + `от следующей атаки ножом ${esc(actor.name)} в этот Ход (ляжет в окно атаки само).</div>`,
      `<div class="roll-threshold" style="font-size:0.85em;">Свободная рука занята до конца Хода — ею в этот Ход не атаковать.</div>`
    ]
  }, { sound: false });
}

/**
 * Начать проверку Жонглёра Клинком (кнопка на листе Таланта).
 * @returns {Promise<boolean>} true — окно открыто
 */
export async function startBladeJuggler(actor) {
  if (!actor) return false;
  const knife = (actor.items ?? []).some(i => i?.type === "weapon" && i.system?.equipped && isKnifeWeapon(i));
  if (!knife) { ui.notifications?.warn(`${actor.name}: Жонглёр Клинком — нужен экипированный нож.`); return false; }
  if (handsOccupied(actor).free < 1) {
    ui.notifications?.warn(`${actor.name}: Жонглёр Клинком — нужна пустая рука (нож перекидывается в неё).`);
    return false;
  }
  // «Раз в Ход» существует только в бою: вне боя Хода нет, флаг некому снять, и он блокировал бы Талант навсегда.
  if (isEncounterActive() && bladeJugglerUsedThisTurn(actor)) {
    ui.notifications?.warn(`${actor.name}: Жонглёр Клинком уже использован в этом Ходу.`);
    return false;
  }
  const { _showContestDialog } = await import("./techniques.mjs");
  const ch = actor.system?.characteristics ?? {};
  await _showContestDialog(actor, {
    label: "Жонглёр Клинком", wsBonus: 0,
    modLabel: "Deceive(WS) vs Awareness(P)",
    defaultChar: "ws", allowedChars: ["ws"],
    skills: { ws: "deceive" }, charLabels: { ws: "Deceive(WS)" },
    // Навык Deceive в системе идёт на Fel, а книга велит WS: поправка переводит базу на WS, Ранг остаётся.
    extraBonus: (Number(ch.ws?.total) || 0) - (Number(ch.fel?.total) || 0),
    resist: [{ skill: "awareness" }],
    // Свободное ментальное действие раз в Ход: отметка — в момент броска, чтобы «Отмена» её не съедала.
    pay: async () => {
      if (!isEncounterActive()) return true;   // вне боя «раз в Ход» не отмечается (см. выше)
      if (bladeJugglerUsedThisTurn(actor)) {
        ui.notifications?.warn(`${actor.name}: Жонглёр Клинком уже использован в этом Ходу.`);
        return false;
      }
      await actor.setFlag(NS, BLADE_JUGGLER_USE_FLAG, true);
      return true;
    },
    note: "Deceive(WS)+0 vs Awareness(P)+0. Победа: штраф Успехи×5 на Избегания цели от следующей атаки ножом в этот Ход. Свободная рука занята до конца Хода при любом исходе.",
    chatNote: "🔪 Жонглёр Клинком: Deceive(WS) vs Awareness(P)",
    onSuccess: resolveBladeJugglerSuccess
  });
  return true;
}
