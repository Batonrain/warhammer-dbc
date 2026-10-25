// module/combat/disease-infection.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Тест заражения болезнью (wdbc-dbveg) — Foundry-обвязка поверх module/rules/
//  disease-infection.mjs. Кнопка «Заражение» на болезни в списке болезней
//  вкладки ЭФФЕКТЫ: ГМ кладёт болезнь актору неактивной, жертва бросает
//  T±N выбранного пути передачи; провал включает болезнь (system.active),
//  успех оставляет её выключенной.
//
//  Образец — яды (hooks.mjs, сопротивление Toxic; ctx.poisonTest): общий сбор
//  модификаторов с флагом ctx.diseaseTest (область "disease" в resolve-test.mjs)
//  и Преимущество Крепкого как Камень / Живучести Сплайса — бросок дважды,
//  лучший (rules/squat-traits.mjs::diseaseResistReroll).
//
//  Метка Нургла «не заражается»: иммунитет из rules/disease-immunity.mjs
//  останавливает заражение до броска.
// ════════════════════════════════════════════════════════════════════════════

import { diseaseVectors, vectorLabel, infectionPlan, infectionBlockedBy } from "../rules/disease-infection.mjs";
import { diseaseResistReroll } from "../rules/squat-traits.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { rollD100WithReroll } from "../rules/test-kind-widget.mjs";
import { isItemActive, syncItemEffectsDisabled } from "../apps/effects.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

const ICON = () => rollIcon("warp", "#9fd13f");

/** Какой из путей передачи проверять: один — сразу, несколько — выбор игрока. */
async function chooseVector(vectors) {
  if (vectors.length === 1) return vectors[0];
  const index = await foundry.applications.api.DialogV2.wait({
    window: { title: "Заражение: путь передачи" },
    classes: ["wh-roll-dialog-window"],
    content: `<p>Как болезнь добралась до персонажа?</p>`,
    buttons: vectors.map((v, i) => ({
      action: `v${i}`, label: vectorLabel(v), default: i === 0, callback: () => i
    })),
    rejectClose: false
  });
  return Number.isInteger(index) ? vectors[index] : null;
}

/**
 * Тест заражения. Возвращает "infected" | "resisted" | "blocked" | null (нечего
 * бросать или игрок отказался).
 * @param {Actor} actor
 * @param {Item}  item   предмет типа disease на этом акторе
 * @param {{vector?:object}} [o]  путь передачи заранее (тесты); иначе — выбор
 */
export async function rollInfectionTest(actor, item, { vector = null } = {}) {
  if (!actor || item?.type !== "disease") return null;
  if (item.system?.active) {
    ui.notifications?.info(`${item.name}: болезнь уже действует.`);
    return null;
  }
  const vectors = diseaseVectors(item);
  if (!vectors.length) {
    ui.notifications?.info(`${item.name}: книга не даёт Порога заражения (на усмотрение МИ или авто-заражение) — включите болезнь вручную (▶).`);
    return null;
  }

  const blocked = infectionBlockedBy(actor, isItemActive);
  if (blocked) {
    await postTestCard(actor, {
      icon: ICON(),
      title: `Заражение: ${esc(item.name)} — ${esc(actor.name)}`,
      outcome: outcomeHtml(true, `${esc(blocked)} — тест не нужен`)
    }, { sound: false });
    return "blocked";
  }

  const picked = vector ?? await chooseVector(vectors);
  if (!picked) return null;

  const plan = infectionPlan(actor, picked);
  const ruleMods = collectTestMods(actor, { kind: "skill", char: picked.char, diseaseTest: true });
  const threshold = plan.threshold + ruleMods.total;
  const advantage = diseaseResistReroll(actor);
  const { rv, rolls } = await rollD100WithReroll(advantage);
  const { success } = testOutcome(rv, threshold);

  if (!success) {
    await item.update({ "system.active": true });
    // ActiveEffect болезни включается вместе с ней (isItemActive, wdbc-dbveg).
    await syncItemEffectsDisabled(item);
  }

  const sign = picked.mod < 0 ? "−" : "+";
  const notes = [];
  if (advantage) notes.push(`<div class="roll-threshold">${esc(advantage.label)}: броски ${rolls.map(r => r.total).join(" и ")}, берётся лучший.</div>`);
  if (!success && item.system?.incubation) notes.push(`<div class="roll-threshold">Инкубация: ${esc(item.system.incubation)}</div>`);

  await postTestCard(actor, {
    icon: ICON(),
    title: `Заражение: ${esc(item.name)} — ${esc(actor.name)}`,
    threshold: rollStatLine({
      label: plan.charLabel, base: plan.base,
      parts: [`${sign}${Math.abs(picked.mod)} ${esc(picked.label)}`, ...ruleMods.parts.map(esc)],
      threshold, rv
    }),
    outcome: notes.join("") + (success
      ? outcomeHtml(true, "Успех — организм отбился, болезнь не прижилась")
      : outcomeHtml(false, "Провал — 🦠 заражён, болезнь действует"))
  }, { rolls });
  return success ? "resisted" : "infected";
}
