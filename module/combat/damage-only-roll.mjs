// module/combat/damage-only-roll.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Урон напрямую, без броска атаки (wdbc-6rj) — кнопка «Урон» у оружия на
//  вкладке БОЙ и в боевой панели: когда полноценный диалог Атаки не нужен
//  (урон по сюжету/ловушке, цель без листа, догон уже решённого попадания).
//
//  Сознательно упрощённый путь, НЕ замена sheets/attack-dialog.mjs: берёт
//  только формулу урона самого оружия (с подстановкой бонусов характеристик,
//  resolveCharFormula) и ручной модификатор игрока — ни Пробитие от
//  Избирательной атаки, ни автоматические кубы Свойств Оружия (Меткое/
//  Рассеивание/Максимальный режим), ни бонусы Талантов/Эффектов здесь не
//  считаются. Цель — только подпись карточки (из выбранных токенов или
//  введённая вручную), расчёт по её Броне/Поглощению не идёт: это ручной
//  инструмент, игрок сам прикладывает число к Ранам цели.
// ════════════════════════════════════════════════════════════════════════════

import { resolveCharFormula, esc } from "../helpers/utils.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

/** Имена сейчас выбранных токенов пользователя — только для подписи карточки. */
export function currentTargetNames() {
  return [...(game.user?.targets ?? [])].map(t => t.actor?.name || t.name).filter(Boolean);
}

/**
 * Бросить урон оружия N раз мимо конвейера атаки.
 *
 * @param {Actor} actor
 * @param {Item}  weapon
 * @param {object} [o]
 * @param {number} [o.modifier=0]   ручной плоский модификатор урона (+/−)
 * @param {number} [o.hits=1]       сколько раз бросить (количество попаданий), 1-20
 * @param {string} [o.targetName=""] цель для подписи карточки — необязательна
 */
export async function rollWeaponDamageOnly(actor, weapon, { modifier = 0, hits = 1, targetName = "" } = {}) {
  const sys = weapon?.system ?? {};
  const baseFormula = resolveCharFormula(sys.damage || "0", actor.system?.characteristics, actor.system?.corruptionBonus ?? 0);
  const mod = Number(modifier) || 0;
  const formula = mod !== 0 ? `${baseFormula} + ${mod}` : baseFormula;
  const n = Math.max(1, Math.min(20, Number(hits) || 1));

  const rolls = [];
  const lines = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const roll = await new Roll(formula).evaluate();
    rolls.push(roll);
    total += roll.total;
    lines.push(`<div class="roll-dice">${n > 1 ? `Попадание ${i + 1}: ` : "Урон: "}<b>${roll.total}</b></div>`);
  }

  const specLine = [sys.damageType, sys.penetration ? `Пробитие ${sys.penetration}` : ""].filter(Boolean).join(" · ");

  return postTestCard(actor, {
    icon: rollIcon("blood", "#c94040"),
    title: `${esc(actor.name)} — Урон: ${esc(weapon?.name ?? "")}`,
    lines: [
      targetName ? `<div class="roll-threshold">Цель: ${esc(targetName)}</div>` : "",
      `<div class="roll-threshold">Формула: ${esc(formula)}${specLine ? ` (${esc(specLine)})` : ""}</div>`,
      ...lines,
      n > 1 ? `<div class="roll-outcome">Итого по всем попаданиям: <b>${total}</b></div>` : ""
    ]
  }, { rolls });
}

/** Диалог параметров перед броском — цель (из выбранных токенов или вручную), модификатор, число попаданий. */
export async function showDamageOnlyDialog(actor, weapon) {
  const targets = currentTargetNames();
  const defaultTarget = targets[0] || "";
  const content = `
    <div class="form-group">
      <label>Цель (необязательно)</label>
      <input type="text" name="target" value="${esc(defaultTarget)}" placeholder="без цели"/>
    </div>
    <div class="form-group">
      <label>Модификатор урона</label>
      <input type="number" name="modifier" value="0"/>
    </div>
    <div class="form-group">
      <label>Количество попаданий</label>
      <input type="number" name="hits" value="1" min="1" max="20"/>
    </div>`;

  const result = await foundry.applications.api.DialogV2.prompt({
    window: { title: `Урон: ${weapon?.name ?? ""}` },
    content,
    ok: {
      label: "Бросить",
      callback: (_ev, button) => ({
        target: button.form.elements.target.value.trim(),
        modifier: Number(button.form.elements.modifier.value) || 0,
        hits: Number(button.form.elements.hits.value) || 1
      })
    },
    rejectClose: false
  }).catch(() => null);
  if (!result) return;
  await rollWeaponDamageOnly(actor, weapon, { modifier: result.modifier, hits: result.hits, targetName: result.target });
}
