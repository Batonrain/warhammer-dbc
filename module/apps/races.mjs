// module/apps/races.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Применение расы, Прошлого (Иннари/Арлекин) и легиона/ордена: характеристики
//  в пустые поля, расовые Черты, стартовые таланты и Черты «Геносемя/Культура/
//  Проклятье». Соседи по папке — homeworlds.mjs, archetypes.mjs,
//  divinations.mjs: то же самое для остальных источников бонусов.
//
//  Функции принимают актора, а не лист. Создание Черт и стартовых талантов
//  приходит колбэками: они разбирают строки книг и остаются на листе — их
//  зовёт и Мастер создания персонажа (apps/creation.mjs).
// ════════════════════════════════════════════════════════════════════════════

import { RACES } from "../constants/races.mjs";
import { getLegion, getChapter, resolveCulture } from "../constants/legions.mjs";
import { ASTARTES_RACE } from "../constants/astartes-implants.mjs";
import { grantAstartesImplants } from "./astartes-implants.mjs";

/** Применяет расовые бонусы: характеристики только в пустые поля + расовые Черты. */
export async function applyRaceData(actor, raceKey, { createTraits, applyStartingTalents }) {
  const race = RACES[raceKey];
  if (!race) return;
  const chars = actor.system.characteristics;
  const upd = {};
  for (const [k, v] of Object.entries(race.chars || {})) {
    if ((chars[k]?.base || 0) === 0) upd[`system.characteristics.${k}.base`] = v;
  }
  if (Object.keys(upd).length) await actor.update(upd);
  const n  = await createTraits(race.traits || [], race.label || raceKey);
  const nt = await applyStartingTalents(race.talents || [], race.label || raceKey);
  // Космодесантнику органы Геносемени положены по умолчанию.
  const ng = raceKey === ASTARTES_RACE ? await grantAstartesImplants(actor) : 0;
  ui.notifications.info(`🧬 ${race.label}: характеристик ${Object.keys(upd).length}, `
    + `Черт ${n}, Талантов ${nt}${ng ? `, органов Геносемени ${ng}` : ""}.`);
}

/** Иннари: бонусы Прошлого (бывшей расы) + Черты Иннари. */
export async function applyYnnari(actor, callbacks) {
  const past = actor.system.ynnariPast;
  if (past && RACES[past]) await applyRaceData(actor, past, callbacks);  // бонусы изначальной расы
  const n = await callbacks.createTraits(RACES.ynnari.traits || [], "Иннари");
  ui.notifications.info(`Иннари: применены Черты Иннари (${n})${past ? ` и бонусы Прошлого (${RACES[past]?.label})` : ""}.`);
}

/** Арлекин: бонусы Прошлого (изначальной расы) + Черты Арлекина. */
export async function applyHarlequin(actor, callbacks) {
  const past = actor.system.harlequinPast;
  if (past && RACES[past]) await applyRaceData(actor, past, callbacks);  // бонусы изначальной расы
  const n = await callbacks.createTraits(RACES.harlequin.traits || [], "Арлекин");
  ui.notifications.info(`Арлекин: применены Черты Арлекина (${n})${past ? ` и бонусы Прошлого (${RACES[past]?.label})` : ""}.`);
}

/**
 * Применяет легион/орден: создаёт Черты «Геносемя/Культура/Проклятье» с текстом
 * (и авто-эффектами, где есть числовые бонусы — Unnatural и т.п.). Повторный
 * запуск обновляет: старые легион-Черты (source «Легион») удаляются.
 */
export async function applyLegion(actor, { createTraits }) {
  const gs = actor.system.geneSeed || {};
  const legion  = getLegion(gs.legion || "");
  if (!legion) return ui.notifications.warn("Сначала выберите Легион на вкладке «Записи».");
  const chapter = getChapter(gs.legion || "", gs.chapter || "");
  const effName = chapter ? `${legion.num} ${chapter.name}` : `${legion.num} ${legion.name}`;
  const geneseed = chapter ? chapter.geneseed : legion.geneseed;
  const curse    = chapter ? chapter.curse    : legion.curse;
  const effects  = (chapter && chapter.effects) || legion.effects || null;
  const choices  = (chapter && chapter.curseChoices) || legion.curseChoices || null;
  const noCurse  = !curse || /^(нет проклятья|—)/i.test(curse.trim());

  // Культура может быть перенята у другого легиона/банды (геносемя сохраняется).
  const cul = (gs.cultureLegion && resolveCulture(gs.cultureLegion, gs.cultureChapter))
            || { name: effName, culture: (chapter ? chapter.culture : legion.culture) };

  const baseList = [
    { name: `Геносемя: ${effName}`, benefit: geneseed, effects: effects ? { charBonuses: effects.charBonuses || [], armourAll: effects.armourAll || 0, fearRating: effects.fearRating || 0, sizeMod: effects.sizeMod || 0 } : undefined },
    { name: `Культура: ${cul.name}`, benefit: cul.culture }
  ];

  const apply = async (curseEntry) => {
    // Удаляем прежние легион-Черты (source «Легион»), чтобы переприменить.
    const old = actor.items.filter(i => i.type === "trait" && i.system?.source === "Легион").map(i => i.id);
    if (old.length) await actor.deleteEmbeddedDocuments("Item", old);
    const list = [...baseList];
    if (curseEntry) list.push({ name: `Проклятье: ${curseEntry.name}`, benefit: curseEntry.text });
    const n = await createTraits(list, "Легион");
    ui.notifications.info(`Легион применён: ${effName}. Создано Черт: ${n}${effects ? " (числовые бонусы Геносемени применены)" : ""}.`);
  };

  // Если у проклятья есть варианты — даём выбрать.
  if (choices && choices.length) {
    const buttons = {};
    choices.forEach((ch, i) => {
      buttons[`c${i}`] = { label: ch.name, callback: () => apply(ch) };
    });
    buttons.none = { label: "Без проклятья", callback: () => apply(null) };
    new Dialog({
      title: `Проклятье: ${effName}`,
      content: `<div style="padding:6px;font-size:0.9em;">Выберите проклятье:<ul style="margin:6px 0 0;padding-left:16px;">${choices.map(ch => `<li><b>${ch.name}</b> — ${ch.text}</li>`).join("")}</ul></div>`,
      buttons, default: "c0"
    }, { width: 460 }).render(true);
    return;
  }

  await apply(noCurse ? null : { name: effName, text: curse });
}

/**
 * Кнопки применения на листе. `callbacks` — `createTraits` и
 * `applyStartingTalents` листа (см. заголовок файла).
 */
export function activateRaceListeners(html, actor, callbacks) {
  html.find(".race-select").change(ev => {
    actor.update({ "system.race": ev.currentTarget.value, "system.subrace": "" });
  });

  html.find(".gene-origin-input").change(ev => {
    actor.update({ "system.geneSeed.origin": ev.currentTarget.value });
  });

  // Кнопка геносемени применяет расу Астартес.
  html.find(".gene-apply-btn").click(async ev => {
    ev.preventDefault();
    await applyRaceData(actor, ASTARTES_RACE, callbacks);
  });

  html.find(".legion-apply-btn").click(async ev => {
    ev.preventDefault();
    await applyLegion(actor, callbacks);
  });

  html.find(".ynnari-apply-btn").click(async ev => {
    ev.preventDefault();
    await applyYnnari(actor, callbacks);
  });

  html.find(".harlequin-apply-btn").click(async ev => {
    ev.preventDefault();
    await applyHarlequin(actor, callbacks);
  });
}
