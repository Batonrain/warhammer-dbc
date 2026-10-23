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
import { isInRage } from "../rules/rage.mjs";
import { psychThreshold, applyPsychDamage } from "./horde-psych.mjs";
import { psychDamageFor } from "../rules/horde-damage.mjs";
import { esc, _degWord } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { rootEl } from "../sheets/v2-helpers.mjs";
import { resolveTest } from "../rules/resolve-test.mjs";
import { rollD100WithReroll } from "../rules/test-kind-widget.mjs";
import { intoTheJawsOfHellActive, anyRadiantPresenceHolderExists, anyIntoTheJawsOfHellHolderExists } from "../rules/leadership-talents.mjs";

/**
 * Модификаторы и переброс стороны — тем же приёмом, что rules/morale-test.mjs
 * ::rollMoraleTest: оба катаются здесь, без промежуточного диалога-галочки
 * (в отличие от Страха), так что переброс области "morale" (Unshakeable
 * Will/Несокрушимая Воля и подобные) применяется автоматически, а не
 * предлагается чекбоксом. rules/roll-mods.mjs::collectTestMods сюда не
 * подходит — он отбрасывает `.rerolls`, оставляя только суммарный модификатор
 * (task-284f, живая проверка 22.10.2026: переброс молча не доезжал).
 */
function _sideModsAndReroll(resolved) {
  const list = [...resolved.autoMods, ...resolved.mods.filter(m => !m.askOnly)];
  const total = list.reduce((sum, m) => sum + (Number(m.value) || 0), 0);
  const parts = list.map(m => `${m.label} ${Number(m.value) >= 0 ? "+" : ""}${m.value}`);
  const reroll = resolved.rerolls.find(r => r.who !== "target");
  return { total, parts, reroll: reroll ? { mode: reroll.mode, rolls: reroll.rolls, label: reroll.label } : null };
}

/** Порог Intimidate нападающего — обычный тест Навыка (уже посчитан листом). */
export function intimidateThreshold(attacker, mod = 0) {
  return (Number(attacker?.system?.skills?.intimidate?.total) || 0) + (Number(mod) || 0);
}

/**
 * Порог теста Морали цели (Воля+mod) — то, чем книга встречает Intimidate.
 * Орда («Орды», Психологический урон) получает к нему бонус, равный своей
 * Магнитуде (и −10 Ослабленной) — тот же порог, что у её теста на Страх.
 */
export function moraleThreshold(target, mod = 0) {
  if (target?.type === "horde") return psychThreshold(target, mod);
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
export async function rollIntimidateContest(attacker, target, { attackerMod = 0, targetMod = 0,
                                                                   radiantPresence = false, intoTheJawsOfHell = false } = {}) {
  // Общий сбор модификаторов обеим сторонам (wdbc-ct65.3): встречный тест —
  // это два теста, и каждый обязан видеть свои Черты и своё состояние тела.
  // Оба помечены morale:true — Запугивание книга прямо называет тестом Морали
  // (rules/resolve-test.mjs::isMoraleOpposedSkill), и цель отвечает им же.
  // radiantPresence — галочка диалога (решение стола), только на стороне цели.
  // targetActor — противоположная сторона теста (Angel Hunters и подобные
  // правила с when.target*), тем же приёмом, что атака/навык/Страх.
  const atkResolved = resolveTest({ actor: attacker, kind: "skill", skill: "intimidate", char: "wp", morale: true, targetActor: target });
  const tgtResolved = resolveTest({ actor: target, kind: "skill", char: "wp", morale: true, radiantPresence, targetActor: attacker });
  const atkMods = _sideModsAndReroll(atkResolved);
  const tgtMods = _sideModsAndReroll(tgtResolved);
  const atkThreshold = intimidateThreshold(attacker, attackerMod) + atkMods.total;
  const tgtThreshold = moraleThreshold(target, targetMod) + tgtMods.total;
  const { roll: atkRoll, rv: atkRv, rolls: atkRolls, rerollNote: atkRerollNote } = await rollD100WithReroll(atkMods.reroll);
  const { roll: tgtRoll, rv: tgtRv, rolls: tgtRolls, rerollNote: tgtRerollNote } = await rollD100WithReroll(tgtMods.reroll);

  // Несломляемая Орда (immuneFear) «автоматически проходит тесты против
  // Запугивания» — тот же автопасс, что у Саркофага. Into the Jaws of
  // Hell/В Самое Пекло (Sahara 3-ac78, 19.10.2026) — та же галочка диалога,
  // решение стола, не вычисление «рядом ли».
  // Ярость цели (Frenzy, стр. 62): «автоматически проходит тесты Морали» —
  // встречный тест против Запугивания это тест Морали (rules/rage.mjs).
  const autoPass = hasRuleFlag(target, "sarcophagus.autoPassFear")
    || isInRage(target)
    || (target?.type === "horde" && !!target.system?.immuneFear)
    || intoTheJawsOfHellActive(intoTheJawsOfHell);
  const atkOutcome = testOutcome(atkRv, atkThreshold);
  const tgtOutcome = testOutcome(tgtRv, tgtThreshold, { autoSuccess: autoPass });

  const mine   = { ...atkOutcome, threshold: atkThreshold };
  const theirs = { ...tgtOutcome, threshold: tgtThreshold };
  const { winner, margin } = resolveOpposed(mine, theirs);
  // Проигранный встречный против Запугивания — проваленный тест Морали:
  // снимает Командование (глава «Командование», combat/command-state.mjs).
  if (winner === "mine") {
    const { handleMoraleFailure } = await import("./command-state.mjs");
    await handleMoraleFailure(target);
  }
  // Орда: Провалы её теста против Запугивания — психологический урон ×1 в
  // Магнитуду (applyPsychDamage сам пропускает Несломляемую).
  const hordePsych = (target?.type === "horde" && winner === "mine" && !tgtOutcome.success)
    ? await applyPsychDamage(target, psychDamageFor("intimidate", tgtOutcome.deg)) : 0;

  await _postIntimidateMsg(attacker, target, {
    atkThreshold, tgtThreshold, atkRv, tgtRv, atkOutcome, tgtOutcome,
    // Подписи модификаторов обеих сторон (wdbc-kuun): Порог считался с ними,
    // но в карточке стояло голое число.
    atkParts: atkMods.parts, tgtParts: tgtMods.parts, atkRerollNote, tgtRerollNote,
    winner, margin, sarcophagusSaved: autoPass && tgtRv > tgtThreshold, hordePsych,
    rolls: [...atkRolls, ...tgtRolls]
  });

  return { winner, margin };
}

async function _postIntimidateMsg(attacker, target, data) {
  const { atkThreshold, tgtThreshold, atkRv, tgtRv, atkOutcome, tgtOutcome, atkParts = [], tgtParts = [],
          atkRerollNote = "", tgtRerollNote = "", winner, margin, sarcophagusSaved, hordePsych = 0, rolls } = data;

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
        ${atkRerollNote}
        <div class="roll-threshold">Тест Морали (${esc(target.name)}): <b>${tgtThreshold}</b>${tgtParts.length ? ` (${tgtParts.join(", ")})` : ""} → бросок <b>${tgtRv}</b> —
          ${tgtOutcome.success ? "Успех" : "Провал"} ${tgtOutcome.deg} ${_degWord(tgtOutcome.deg)}${sarcophagusSaved ? (target.type === "horde" ? " (Орда не знает страха)" : isInRage(target) ? " (Ярость)" : " (Саркофаг Дредноута)") : ""}</div>
        ${tgtRerollNote}
        <div class="roll-outcome">${outcomeLine}</div>
        ${hordePsych > 0 ? `<div class="roll-threshold">Орда: психологический урон <b>${hordePsych}</b> Магнитуды (Провалы×1)</div>` : ""}
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
  // Radiant Presence/Into the Jaws of Hell (Sahara 3-ac78, 19.10.2026) —
  // галочки на стороне ЦЕЛИ (решение стола), показываются только если в
  // мире вообще есть носитель.
  const radiantPresenceHtml = anyRadiantPresenceHolderExists(game.actors ?? [])
    ? `<div class="atk-dlg-row"><label title="Цель видит или слышит союзника/нейтрального с Блистательным Присутствием — +10 на её тест Морали"><input id="intim-radiant" type="checkbox"/> Блистательное Присутствие (+10 цели)</label></div>` : "";
  const jawsOfHellHtml = anyIntoTheJawsOfHellHolderExists(game.actors ?? [])
    ? `<div class="atk-dlg-row"><label title="Рядом с целью сражается её командующий с В Самое Пекло — тест цели проходит автоматически"><input id="intim-jaws" type="checkbox"/> В Самое Пекло (авто-успех цели)</label></div>` : "";

  const picked = await foundry.applications.api.DialogV2.prompt({
    window: { title: `Запугивание — ${actor.name} → ${target.name}` },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<div class="wh-attack-form cmd-free-form">
      <div class="atk-dlg-row"><label>Intimidate (${esc(actor.name)}):</label><span><b>${base}</b></span></div>
      <div class="atk-dlg-row"><label>Модификатор:</label><input id="intim-atk-mod" type="number" value="0"/></div>
      <div class="atk-dlg-row"><label>Тест Морали (${esc(target.name)}):</label><span><b>${targetBase}</b></span></div>
      <div class="atk-dlg-row"><label>Модификатор цели:</label><input id="intim-tgt-mod" type="number" value="0"/></div>
      ${radiantPresenceHtml}
      ${jawsOfHellHtml}
    </div>`,
    ok: {
      label: "Бросок!", icon: "fas fa-dice-d10",
      callback: (event, button) => ({
        attackerMod: parseInt(button.form.querySelector("#intim-atk-mod")?.value) || 0,
        targetMod: parseInt(button.form.querySelector("#intim-tgt-mod")?.value) || 0,
        radiantPresence: !!button.form.querySelector("#intim-radiant")?.checked,
        intoTheJawsOfHell: !!button.form.querySelector("#intim-jaws")?.checked
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
