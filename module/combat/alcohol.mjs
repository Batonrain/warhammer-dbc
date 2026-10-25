// module/combat/alcohol.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Алкоголь: счётчик Провалов (3-edc4 п.8, Декаданс). Правила и арифметика —
//  rules/alcohol.mjs. Вызывается из sheets/tabs/drugs.mjs при применении
//  препарата «Алкоголь»: тест T+0 (от яда) с накапливающимся −10 за каждую
//  рюмку после первой, Провалы копятся во флаге актора, каждые 20 минут по
//  Календарю уходит один (считается при следующей рюмке). Декаданс удваивает
//  пороги ступеней опьянения. 15 Провалов (30 с Декадансом) — потеря сознания.
//
//  Не автоматизировано: сами бонусы/штрафы ступеней (+30 социальным, +20/+40
//  против Страха и др., штраф Физическим) — карточка называет действующую
//  ступень, применяет стол; они не вшиты в пороги тестов.
// ════════════════════════════════════════════════════════════════════════════

import { collectTestMods } from "../rules/roll-mods.mjs";
import { hasResilienceTalent } from "../rules/resilience-talents.mjs";
import {
  ALCOHOL_FLAG, isAlcoholName, alcoholDecayed, alcoholDrinkPenalty, alcoholFailsOf,
  alcoholEffects, alcoholEffectsText
} from "../rules/alcohol.mjs";
import { conditionApplyFields } from "../sheets/tabs/conditions.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";

const NS = "warhammer-dbc";

/** Препарат — алкоголь? */
export function isAlcoholItem(item) {
  return item?.type === "drug" && isAlcoholName(item.name);
}

/** Текущее состояние опьянения актора с учётом спада к `now`. */
export function alcoholStateOf(actor, now = game.time?.worldTime ?? 0) {
  return alcoholDecayed(actor?.getFlag?.(NS, ALCOHOL_FLAG), now);
}

/**
 * Рюмка: тест T+0 (от яда) со штрафом −10 за каждую рюмку после первой,
 * Провалы (не Успехи) складываются. Возвращает итоговое состояние.
 */
export async function applyAlcoholDrink(actor, item) {
  if (!actor) return null;
  const now = game.time?.worldTime ?? 0;
  const before = alcoholStateOf(actor, now);
  const decadence = hasResilienceTalent(actor, "decadence");

  const t = Number(actor.system?.characteristics?.t?.total) || 0;
  const ruleMods = collectTestMods(actor, { kind: "skill", char: "t", poisonTest: true });
  const stack = alcoholDrinkPenalty(before.drinks);
  const threshold = t + stack + ruleMods.total;
  const roll = await new Roll("1d100").evaluate();
  const gained = alcoholFailsOf(roll.total, threshold);

  const after = { fails: before.fails + gained, drinks: before.drinks + 1, at: before.fails > 0 ? before.at : now };
  try { await actor.setFlag(NS, ALCOHOL_FLAG, after); } catch { /* нет прав на лист */ }

  const fx = alcoholEffects(after.fails, decadence);
  if (fx.unconscious) {
    try { await actor.update(conditionApplyFields("unconscious", null, actor)); } catch { /* нет прав на лист */ }
  }

  await postTestCard(actor, {
    icon: rollIcon("warn", "#d9a066"), title: `Алкоголь — ${esc(actor.name)}${item?.name ? ` (${esc(item.name)})` : ""}`,
    threshold: rollStatLine({
      label: "T", base: t,
      parts: [stack ? `${stack} (рюмка №${before.drinks + 1})` : "", ...ruleMods.parts].filter(Boolean).map(esc),
      threshold, rv: roll.total
    }),
    outcome: gained
      ? outcomeHtml(false, `Провалов +${gained} — всего ${after.fails}`)
      : outcomeHtml(true, `Тело справилось — Провалов нет (всего ${after.fails})`),
    sections: [
      `<div class="roll-threshold">${esc(alcoholEffectsText(fx))}${decadence ? " <i>(Декаданс: пороги ступеней ×2)</i>" : ""}</div>`,
      `<div class="roll-threshold" style="font-size:.85em;opacity:.8;">Каждые 20 минут — −1 Провал (считается по Календарю при следующей рюмке).</div>`
    ]
  }, { rolls: [roll] });
  return after;
}
