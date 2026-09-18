// module/combat/force-move.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Через Силу (стр. 27): поднять/перевернуть/толкнуть предмет ЗА ПРЕДЕЛАМИ
//  своего весового лимита — тест Athletics(S)+0, всегда Полное действие (2 ОД)
//  и обе руки. Успех сдвигает предмет: Толкание — 0,5м за Успех, до SPD;
//  Подъём/Переворот — 0,5м за Успех, до 2м. (Та же формула Успехов, что
//  «временно +1 к сумме S.b+T.b за Успех» из раздела «Максимальный Вес»,
//  стр. 27 — это ОДНО действие, описанное книгой в двух местах; вес самого
//  предмета не отслеживается системой для произвольных реквизитов/техники,
//  поэтому авто-проверка «хватило ли» здесь не считается — тест сам говорит,
//  удалось ли, дистанция — что получилось сделать при успехе.)
//
//  Массивные Предметы (там же): цель Размером больше актора — тест получает
//  штраф Athletics(S)−10×<разница в Размерах>. Если это совпадает с Через
//  Силу (throughForce=true), это ОДИН тест с суммарным штрафом, но
//  дополнительно Помеха (rollD100WithReroll — тот же механизм, что общий
//  диалог теста, «бросить дважды и оставить худший»); если предмет массивный,
//  но НЕ за пределами лимита, Помехи нет — только штраф.
// ════════════════════════════════════════════════════════════════════════════

import { spendActionPoints } from "./action-economy.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { rollD100WithReroll } from "../rules/test-kind-widget.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";

/**
 * Чистая часть — считает Порог/дистанцию, ничего не бросает и не пишет.
 * @param {object} actor
 * @param {"push"|"lift"} mode         Толкание (до SPD) или Подъём/Переворот (до 2м)
 * @param {number} sizeDiff            Разница в Размерах (предмет − актор), ≤0 — не массивный
 * @param {boolean} throughForce       Через Силу — за пределами весового лимита (Помеха при massive)
 */
export function forceMoveThreshold(actor, { sizeDiff = 0 } = {}) {
  const athletics = actor?.system?.skills?.athletics?.total ?? -20;
  const ruleMods = collectTestMods(actor, { kind: "skill", skill: "athletics", char: "s" });
  const massive = sizeDiff > 0;
  const sizePenalty = massive ? -10 * sizeDiff : 0;
  const parts = [...ruleMods.parts];
  if (sizePenalty) parts.push(`Разница в Размерах ${sizePenalty}`);
  return { threshold: athletics + ruleMods.total + sizePenalty, base: athletics, parts, massive };
}

/** Дистанция (м) при успехе — 0,5м за Успех, до SPD (push) или до 2м (lift). */
export function forceMoveDistance(mode, successes, spd) {
  const cap = mode === "push" ? (Number(spd) || 0) : 2;
  return Math.min((Number(successes) || 0) * 0.5, cap);
}

/**
 * Через Силу / Массивные Предметы — тест + карточка. `sizeDiff>0` включает
 * штраф массивности; `throughForce` (по умолчанию true — это и есть «Через
 * Силу», за пределами лимита) добавляет Полное действие/обе руки и, если
 * ВМЕСТЕ с sizeDiff>0, Помеху тому же одному тесту (книга: «один тест... но
 * получает Помеху»). Массивный предмет, который ещё в пределах лимита
 * (throughForce:false) — просто штраф без Полного действия и без Помехи.
 */
export async function useForceMove(actor, { mode = "lift", sizeDiff = 0, throughForce = true } = {}) {
  if (!actor) return;
  if (throughForce && !await spendActionPoints(actor, 2, { physical: true })) {
    return ui.notifications.warn("⚠️ Не хватает ОД на Полное действие (обе руки).");
  }
  const { threshold, base, parts, massive } = forceMoveThreshold(actor, { sizeDiff });
  const disadvantage = throughForce && massive;

  const { roll, rv, rolls, rerollNote } = await rollD100WithReroll(
    disadvantage ? { rolls: 2, mode: "disadvantage", label: "Помеха (Массивный предмет + Через Силу)" } : null
  );
  const { success, deg } = testOutcome(rv, threshold);
  const successes = success ? deg : 0;
  const spd = actor.system?.movement?.spd ?? 0;
  const distance = throughForce ? forceMoveDistance(mode, successes, spd) : 0;

  const dice = await roll.render();
  const modeLabel = mode === "push" ? "Толкание" : "Подъём/Переворот";
  await postTestCard(actor, {
    icon: rollIcon("run", "#b0a080"),
    title: `${esc(actor.name)} — ${throughForce ? "Через Силу" : "Массивный предмет"} (${modeLabel})`,
    threshold: rollStatLine({ label: "Athletics(S)", base, parts, threshold, rv }),
    outcome: success
      ? outcomeHtml(true, `Успех${throughForce ? ` — сдвинуто на ${distance}м (${successes} Усп.)` : ""}`)
      : outcomeHtml(false, "Провал — не удалось сдвинуть"),
    rerollNote,
    sections: [
      throughForce ? `<div class="roll-threshold" style="font-size:.85em;opacity:.8;">Полное действие, обе руки заняты (стр. 27).</div>` : "",
      massive && !disadvantage ? `<div class="roll-threshold" style="font-size:.85em;opacity:.8;">Размер больше актора на ${sizeDiff} — штраф уже в Пороге.</div>` : "",
      `<details class="roll-dice-details"><summary>${rollIcon("chart", "#8fd0ff")}Показать кубы</summary>${dice}</details>`
    ]
  }, { rolls });
}
