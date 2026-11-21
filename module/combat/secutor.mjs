// module/combat/secutor.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Кнопки и запись состояния Талантов Секутора (Элитные архетипы). Арифметика —
//  rules/secutor-talents.mjs. Успех кнопки — undefined, отказ — строка
//  (runMechScriptEntry тогда не списывает цену/лимит).
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { postTestCard, outcomeHtml, rollStatLine } from "../helpers/test-card.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { rollD100WithReroll } from "../rules/test-kind-widget.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { combatOfActor } from "./actor-combat.mjs";
import {
  DESTRUCTOR_FLAG, GUNZERKER_FLAG, SUSTAINED_FLAG, hasDestructor, hasGunzerker, hasSustainedAssault, sustainedNext
} from "../rules/secutor-talents.mjs";

const NS = "warhammer-dbc";
const ICON = "⚙️ ";

/**
 * Destructor / Деструктор: «Может потратить Очко Бесчестия, чтобы до конца
 * боя при Структурном Анализе добавлять ещё +½I.b (окр.▲) к Pen». Очко
 * списывает цена записи; здесь — метка боя.
 */
export async function useDestructor(actor) {
  if (!actor || !hasDestructor(actor)) return "нет Таланта";
  const combat = combatOfActor(actor);
  if (!combat?.id) { ui.notifications.warn("⚠️ Деструктор действует до конца боя — начните бой."); return "вне боя"; }
  if (actor.getFlag?.(NS, DESTRUCTOR_FLAG) === combat.id) { ui.notifications.warn("⚠️ Деструктор уже включён в этом бою."); return "уже"; }
  await actor.setFlag(NS, DESTRUCTOR_FLAG, combat.id);
  const ib = Number(actor.system?.characteristics?.int?.bonus) || 0;
  await postTestCard(actor, {
    icon: ICON, title: `Деструктор — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">До конца боя: одиночная Избирательная атака со Структурным Анализом по цели с высокотехнологичной бронёй, машине или зданию получает ещё +${Math.ceil(ib / 2)} к Pen (½I.b, окр.▲) — карточка атаки прибавит сама.</div>`]
  }, { sound: false });
  return undefined;
}

/**
 * Gunzerker / Берсерк-Стрелок: «В начале Хода может пройти тест W+0, чтобы
 * использовать все бонусы Таланта Hatred и Талантов группы Берсерк в
 * стрельбе». Успех — метка Раунда; +10 Ненависти к стрельбе по Ненавистной
 * цели добавляет источник правил.
 */
export async function useGunzerker(actor) {
  if (!actor || !hasGunzerker(actor)) return "нет Таланта";
  const combat = combatOfActor(actor);
  if (!combat?.id) { ui.notifications.warn("⚠️ Тест в начале Хода — только в бою."); return "вне боя"; }
  const w = Number(actor.system?.characteristics?.wp?.total) || 0;
  const mods = collectTestMods(actor, { kind: "skill", char: "wp" });
  const threshold = w + mods.total;
  const { rv, rolls } = await rollD100WithReroll(null);
  const { success, deg } = testOutcome(rv, threshold);
  if (success) await actor.setFlag(NS, GUNZERKER_FLAG, { combatId: combat.id, round: Number(combat.round) || 0 });
  await postTestCard(actor, {
    icon: ICON, title: `Берсерк-Стрелок — ${esc(actor.name)}`,
    threshold: rollStatLine({ label: "W+0", base: w, parts: mods.parts.map(esc), threshold, rv }),
    lines: [success ? "<div class=\"roll-threshold\">До конца Раунда: +10 Ненависти работает и в стрельбе по Ненавистным целям (окно атаки добавит само). Прочие Таланты группы Берсерк в стрельбе — за столом. One Will Go Down — только интегрированным энергетическим оружием, урон персонажу E вместо R.</div>" : ""],
    outcome: outcomeHtml(success, success ? `Успех (${deg}) — ярость в прицеле` : "Провал — бонусы только в рукопашной")
  }, { rolls });
  return undefined;
}

/** Непрерывный Натиск: запомнить цель после атаки (combat/attack.mjs). */
export async function noteSustainedAssault(actor, targetActor) {
  if (!actor || !targetActor || !hasSustainedAssault(actor)) return;
  const combatId = combatOfActor(actor)?.id ?? "";
  const next = sustainedNext(actor.getFlag?.(NS, SUSTAINED_FLAG), targetActor, combatId);
  if (next) await actor.setFlag(NS, SUSTAINED_FLAG, next);
}
