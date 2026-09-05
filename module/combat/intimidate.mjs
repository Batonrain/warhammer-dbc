// module/combat/intimidate.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ЗАПУГИВАНИЕ (Intimidate) как встречная проверка книги (ОПИСАНИЯ НАВЫКОВ,
//  packs-src/books core.json): «Встречные тесты против Intimidate являются
//  тестами Морали» — нападающий бросает Intimidate, цель отвечает тестом
//  Морали (Воля+0), обе стороны сравниваются по степени успеха/провала
//  (module/rules/test-kind.mjs::resolveOpposed — та же арифметика встречного
//  теста, что в книге на стр. 25 для любого другого встречного теста).
//
//  В отличие от Страха/Подавления (fear.mjs/suppression.mjs), у Intimidate
//  обе стороны бросают СРАЗУ, поэтому ближе по форме к Героическому Концу
//  Отряда (module/sheets/squad-sheet.mjs::_heroicRoll) — только не привязано
//  к отряду и не завязано на Command, а использует новые общие хелперы
//  (module/rules/roll-outcome.mjs::testOutcome, не устаревший
//  degreesOfSuccess) для единообразия с остальным конвейером тестов.
//
//  Саркофаг Дредноута (стр. 57, wdbc-drn): цель с sarcophagus.autoPassFear
//  автоматически проходит свою половину независимо от броска — тем же
//  приёмом, что уже подключён в fear.mjs/suppression.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { testOutcome } from "../rules/roll-outcome.mjs";
import { resolveOpposed } from "../rules/test-kind.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";
import { esc, _degWord } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { rootEl } from "../sheets/v2-helpers.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";

/** Порог Intimidate нападающего — обычный тест Навыка (уже посчитан листом). */
export function intimidateThreshold(attacker, mod = 0) {
  return (Number(attacker?.system?.skills?.intimidate?.total) || 0) + (Number(mod) || 0);
}

/** Порог теста Морали цели (Воля+mod) — то, чем книга встречает Intimidate. */
export function moraleThreshold(target, mod = 0) {
  return (Number(target?.system?.characteristics?.wp?.total) || 0) + (Number(mod) || 0);
}

/**
 * Встречная проверка Запугивания: оба d100 бросаются здесь и сравниваются
 * сразу — итог у книги один («Успехи нападающего больше Провалов цели» —
 * то же самое, что margin > 0 у обычного встречного теста).
 *
 * @param {Actor} attacker
 * @param {Actor} target
 * @param {{attackerMod?:number, targetMod?:number}} [opts]
 * @returns {Promise<{winner:"mine"|"theirs"|null, margin:number}>}
 */
export async function rollIntimidateContest(attacker, target, { attackerMod = 0, targetMod = 0 } = {}) {
  // Общий сбор модификаторов обеим сторонам (wdbc-ct65.3): встречный тест —
  // это два теста, и каждый обязан видеть свои Черты и своё состояние тела.
  // Оба помечены morale:true — Запугивание книга прямо называет тестом Морали
  // (rules/resolve-test.mjs::isMoraleOpposedSkill), и цель отвечает им же.
  const atkMods = collectTestMods(attacker, { kind: "skill", skill: "intimidate", char: "wp", morale: true });
  const tgtMods = collectTestMods(target, { kind: "skill", char: "wp", morale: true });
  const atkThreshold = intimidateThreshold(attacker, attackerMod) + atkMods.total;
  const tgtThreshold = moraleThreshold(target, targetMod) + tgtMods.total;
  const atkRoll = await new Roll("1d100").evaluate();
  const tgtRoll = await new Roll("1d100").evaluate();
  const atkRv = atkRoll.total, tgtRv = tgtRoll.total;

  const autoPass = hasRuleFlag(target, "sarcophagus.autoPassFear");
  const atkOutcome = testOutcome(atkRv, atkThreshold);
  const tgtOutcome = testOutcome(tgtRv, tgtThreshold, { autoSuccess: autoPass });

  const mine   = { ...atkOutcome, threshold: atkThreshold };
  const theirs = { ...tgtOutcome, threshold: tgtThreshold };
  const { winner, margin } = resolveOpposed(mine, theirs);

  await _postIntimidateMsg(attacker, target, {
    atkThreshold, tgtThreshold, atkRv, tgtRv, atkOutcome, tgtOutcome,
    // Подписи модификаторов обеих сторон (wdbc-kuun): Порог считался с ними,
    // но в карточке стояло голое число.
    atkParts: atkMods.parts, tgtParts: tgtMods.parts,
    winner, margin, sarcophagusSaved: autoPass && tgtRv > tgtThreshold,
    rolls: [atkRoll, tgtRoll]
  });

  return { winner, margin };
}

async function _postIntimidateMsg(attacker, target, data) {
  const { atkThreshold, tgtThreshold, atkRv, tgtRv, atkOutcome, tgtOutcome, atkParts = [], tgtParts = [],
          winner, margin, sarcophagusSaved, rolls } = data;

  const outcomeLine = winner === "mine"
    ? `<span class="roll-success">${esc(attacker.name)} побеждает, margin <b>${margin}</b></span>`
    : winner === "theirs"
    ? `<span class="roll-failure">${esc(target.name)} сохраняет самообладание, margin <b>${margin}</b></span>`
    : `<span>Ничья — решает ГМ</span>`;

  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("skull", "#ff9a4d")}Запугивание — ${esc(attacker.name)} → ${esc(target.name)}</div>
        <div class="roll-threshold">Intimidate (${esc(attacker.name)}): <b>${atkThreshold}</b>${atkParts.length ? ` (${atkParts.join(", ")})` : ""} → бросок <b>${atkRv}</b> —
          ${atkOutcome.success ? "Успех" : "Провал"} ${atkOutcome.deg} ${_degWord(atkOutcome.deg)}</div>
        <div class="roll-threshold">Тест Морали (${esc(target.name)}): <b>${tgtThreshold}</b>${tgtParts.length ? ` (${tgtParts.join(", ")})` : ""} → бросок <b>${tgtRv}</b> —
          ${tgtOutcome.success ? "Успех" : "Провал"} ${tgtOutcome.deg} ${_degWord(tgtOutcome.deg)}${sarcophagusSaved ? " (Саркофаг Дредноута)" : ""}</div>
        <div class="roll-outcome">${outcomeLine}</div>
        <div class="roll-threshold">Исход по книге решает ГМ: подчинение требуемому, паническое бегство или Шок.</div>
      </div>`,
    rolls, sound: CONFIG.sounds.dice
  }, rollMode));
}

/** Диалог: модификаторы обеих сторон, порог уже виден до броска. */
async function intimidateDialog(actor, target) {
  if (!target) return;
  const base = intimidateThreshold(actor);
  const targetBase = moraleThreshold(target);

  const picked = await foundry.applications.api.DialogV2.prompt({
    window: { title: `Запугивание — ${actor.name} → ${target.name}` },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<div class="wh-attack-form cmd-free-form">
      <div class="atk-dlg-row"><label>Intimidate (${esc(actor.name)}):</label><span><b>${base}</b></span></div>
      <div class="atk-dlg-row"><label>Модификатор:</label><input id="intim-atk-mod" type="number" value="0"/></div>
      <div class="atk-dlg-row"><label>Тест Морали (${esc(target.name)}):</label><span><b>${targetBase}</b></span></div>
      <div class="atk-dlg-row"><label>Модификатор цели:</label><input id="intim-tgt-mod" type="number" value="0"/></div>
    </div>`,
    ok: {
      label: "Бросок!", icon: "fas fa-dice-d10",
      callback: (event, button) => ({
        attackerMod: parseInt(button.form.querySelector("#intim-atk-mod")?.value) || 0,
        targetMod: parseInt(button.form.querySelector("#intim-tgt-mod")?.value) || 0
      })
    }
  }).catch(() => null);
  if (!picked) return;

  return rollIntimidateContest(actor, target, picked);
}

/**
 * Слушатель кнопки «Запугивание» на вкладке СОЦИУМ. Цель — тем же приёмом,
 * что «Применить на другом» у Препаратов (actor-sheet.mjs::_resolveOtherTargetActor):
 * нацеленный, иначе выделенный токен сцены, ровно один, не сам актор.
 */
export function activateIntimidateListeners(root, actor, { resolveOtherTargetActor, editable = true } = {}) {
  const el = rootEl(root);
  if (!el?.querySelector || !editable) return;
  el.querySelectorAll("[data-intimidate-roll]").forEach(node =>
    node.addEventListener("click", () => intimidateDialog(actor, resolveOtherTargetActor?.())));
}
