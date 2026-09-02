// module/apps/subrace-choice.mjs
// ════════════════════════════════════════════════════════════════════════
//  Африэль/Эльданар (wdbc-iu53): «N Характеристик и M Навыков по выбору
//  игрока становятся Дружественными, независимо от Покровительства» —
//  ВЫБОР при получении субрасы, не статичная запись (как у Серого Человека,
//  wdbc-zk69). Диалог по аналогии с промптом Родного мира/Предсказания
//  (module/apps/origin-shared.mjs::promptGrantChoices), но результат другой:
//  не Навыки/Таланты/Черты, а записи kind:"capability"+capabilityMode:
//  "aptOverride" (module/rules/item-rules.mjs) — они ЖИВОЙ запрос движка
//  правил (module/rules/aptitude-overrides.mjs, module/rules/collect.mjs),
//  вступают в силу сразу после item.update(), без ActiveEffect и без
//  повторного applyItemMechanics.
//
//  capabilityAptMatch для scope:"skill" — РУССКИЙ label Навыка (не ключ, не
//  английское имя): resolveAptitudeOverride сравнивает подстрокой против
//  def?.label, которым его кормят advance.mjs/duplicate-refund.mjs (то же
//  поле, что читает и cultureCat ДО фикса wdbc-ko14 — здесь другой потребитель,
//  русский label верен именно для этого пути). Для scope:"characteristic" —
//  ключ характеристики ("s","ws"...), сравнивается ТОЧНО, не подстрокой.
// ════════════════════════════════════════════════════════════════════════

import { CHARACTERISTICS } from "../constants/characteristics.mjs";
import { SKILLS_DEF } from "../constants/skills.mjs";
import { blankMechEntry } from "./mechanics.mjs";
import { esc } from "../helpers/utils.mjs";

/** Ключ субрасы → {charCount, skillCount} — сколько Характеристик/Навыков выбирает игрок. */
export const SUBRACE_APTITUDE_CHOICES = {
  afriel:  { charCount: 2, skillCount: 3 },
  eldanar: { charCount: 3, skillCount: 6 }
};

export function needsAptitudeChoice(subraceKey) {
  return !!SUBRACE_APTITUDE_CHOICES[subraceKey];
}

/**
 * Чистая функция: picks → одна AND-группа Конструктора (capability/aptOverride
 * на каждую выбранную Характеристику/Навык). Пустые/повторные ключи молча
 * пропускаются (дедуп по Set) — диалог мешает выбрать дубль, но чистая
 * функция не должна доверять входу вслепую.
 * @param {{chars: string[], skills: string[]}} picks
 */
export function aptitudeOverrideMechanicsGroup(picks) {
  const entries = [];
  for (const charKey of new Set((picks?.chars || []).filter(Boolean))) {
    if (!CHARACTERISTICS[charKey]) continue;
    entries.push({
      ...blankMechEntry("capability"),
      capabilityMode: "aptOverride", capabilityAptScope: "characteristic",
      capabilityAptMatch: charKey, capabilityAptAlign: "ally"
    });
  }
  for (const skillKey of new Set((picks?.skills || []).filter(Boolean))) {
    const def = SKILLS_DEF[skillKey];
    if (!def) continue;
    entries.push({
      ...blankMechEntry("capability"),
      capabilityMode: "aptOverride", capabilityAptScope: "skill",
      capabilityAptMatch: def.label, capabilityAptAlign: "ally"
    });
  }
  if (!entries.length) return null;
  return { id: foundry.utils.randomID(), operator: "AND", entries };
}

/** Дописывает группу выбора в Механику уже созданного предмета субрасы (не трогает существующие записи). */
export async function applySubraceAptitudeChoice(item, picks) {
  const group = aptitudeOverrideMechanicsGroup(picks);
  if (!group) return;
  const existing = item.flags?.["warhammer-dbc"]?.mechanics || [];
  await item.update({ "flags.warhammer-dbc.mechanics": [...existing, group] });
}

/** HTML диалога: N дропдаунов Характеристик + M дропдаунов Навыков. */
function choiceDialogHtml(charCount, skillCount) {
  const charOpts = Object.entries(CHARACTERISTICS)
    .map(([k, c]) => `<option value="${k}">${esc(c.label)} (${c.abbr})</option>`).join("");
  const skillOpts = Object.entries(SKILLS_DEF)
    .map(([k, s]) => `<option value="${k}">${esc(s.label)}</option>`).join("");

  const charRows = Array.from({ length: charCount }, (_, i) => `
    <select class="sub-apt-char" data-i="${i}"><option value="">— выбрать —</option>${charOpts}</select>`).join("");
  const skillRows = Array.from({ length: skillCount }, (_, i) => `
    <select class="sub-apt-skill" data-i="${i}"><option value="">— выбрать —</option>${skillOpts}</select>`).join("");

  return `<form class="hw-choice-form">
    <div class="hw-choice-desc">Выберите Характеристики и Навыки, которые станут Дружественными независимо от Покровительства.</div>
    <div class="hw-choice">
      <div class="hw-choice-label">Характеристики (${charCount})</div>
      <div class="hw-many-grid">${charRows}</div>
    </div>
    <div class="hw-choice">
      <div class="hw-choice-label">Навыки (${skillCount})</div>
      <div class="hw-many-grid">${skillRows}</div>
    </div>
  </form>`;
}

/**
 * Диалог выбора — открывается сразу после выдачи субрасы (module/apps/races.mjs
 * ::applySubrace). Возвращает null, если игрок закрыл окно без выбора (тогда
 * выбор просто не применяется — субраса остаётся без override, доступно
 * повторить позже вручную правкой Механики предмета).
 * @returns {Promise<{chars:string[], skills:string[]}|null>}
 */
export function promptSubraceAptitudeChoice(subraceKey, label) {
  const cfg = SUBRACE_APTITUDE_CHOICES[subraceKey];
  if (!cfg) return Promise.resolve(null);

  return new Promise(resolve => {
    let done = false;
    new Dialog({
      title: `${label}: выбор Дружественных`,
      content: choiceDialogHtml(cfg.charCount, cfg.skillCount),
      buttons: {
        ok: {
          icon: '<i class="fas fa-check"></i>', label: "Принять",
          callback: h => {
            if (done) return; done = true;
            const chars = [], skills = [];
            h.find(".sub-apt-char").each((_, el) => { if (el.value) chars.push(el.value); });
            h.find(".sub-apt-skill").each((_, el) => { if (el.value) skills.push(el.value); });
            resolve({ chars, skills });
          }
        },
        cancel: { label: "Пропустить", callback: () => { if (!done) { done = true; resolve(null); } } }
      },
      default: "ok",
      close: () => { if (!done) { done = true; resolve(null); } }
    }, { classes: ["dialog", "warhammer-dbc", "wh-holo", "hw-choice-dialog"], width: 420 }).render(true);
  });
}
