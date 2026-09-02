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
import { esc } from "../helpers/utils.mjs";
import { raceDef, subraceEntries } from "./race-library.mjs";
import { clearGrantedBy } from "./origin-shared.mjs";
import { itemHasName } from "../rules/predicates.mjs";
import { applyItemMechanics } from "./mechanics.mjs";
import { needsAptitudeChoice, promptSubraceAptitudeChoice, applySubraceAptitudeChoice } from "./subrace-choice.mjs";

const FLAG  = "warhammer-dbc";
const GRANT = "originGrant";

/**
 * Опция create-контекста (третий аргумент createEmbeddedDocuments), а НЕ
 * флаг документа: Foundry прокидывает такие опции в третий параметр хука
 * createItem как есть. Носитель расы/субрасы несёт `originGrant`, поэтому
 * страховочная ветка хука (warhammer-dbc.mjs, находка C1/handleStrayRaceItem)
 * его не трогает — предмет доходит до общей ветки `applyItemMechanics(item)`.
 * Без этой опции хук применил бы Механику ВТОРОЙ раз поверх нашего прямого
 * вызова ниже (см. applyItemMechanics в applyRace/applySubrace) — и это НЕ
 * лечится идемпотентностью applyItemMechanics: appliedEntryIds читает флаг
 * mechanicsApplied в начале функции, а пишет его только в конце. Прямой
 * вызов здесь и вызов из хука независимы и оба успевают стартовать с пустым
 * флагом, если наш вызов уходит в реальные createEmbeddedDocuments (по Черте)
 * дольше, чем хук доходит до своего applyItemMechanics — в сетевом Foundry
 * так и есть. Экспортируется, чтобы warhammer-dbc.mjs проверял тот же ключ.
 */
export const SKIP_MECHANICS_HOOK = "raceMechanicsInline";

/**
 * Предмет-носитель по флагу originGrant, а не по типу: Прошлое Иннари и
 * Арлекина кладёт документ той же расы (тип "race"), что и сама раса, —
 * различить их можно только по тегу. Поиск первого предмета типа "race" без
 * тега путал носитель расы с носителем Прошлого (см. Находку 1, wdbc-n1k,
 * раунд правок 1): смена расы могла снести не тот предмет.
 */
function grantedItem(actor, type, tag) {
  return actor?.items?.find(i => i.type === type && i.getFlag(FLAG, GRANT) === tag) || null;
}

/** Предмет-носитель расы на акторе (или null). */
export function actorRaceItem(actor) { return grantedItem(actor, "race", "race"); }
/** Предмет-носитель Прошлого (Иннари/Арлекин) — тот же тип "race", тег racePast. */
export function actorRacePastItem(actor) { return grantedItem(actor, "race", "racePast"); }
export function actorSubraceItem(actor) { return grantedItem(actor, "subrace", "subrace"); }

/**
 * Стартовые характеристики расы — ТОЛЬКО в пустые поля. Заполненное значение
 * это уже выбор игрока или бросок Мастера, и раса его не переписывает.
 */
export function raceCharsUpdate(actor, chars) {
  const cur = actor?.system?.characteristics || {};
  const upd = {};
  for (const [k, v] of Object.entries(chars || {}))
    if ((cur[k]?.base || 0) === 0) upd[`system.characteristics.${k}.base`] = v;
  return upd;
}

/**
 * Снимает расу, всё ею выданное, субрасу и Прошлое: оба относились к прежней
 * расе и без неё теряют смысл (Прошлое существует только у Иннари/Арлекина,
 * которые сами и есть раса — см. Находку 2, wdbc-n1k, раунд правок 1).
 *
 * Обнуляет и ключ-зеркало (system.race/system.subrace): раньше крестик
 * «Снять расу» удалял носителя, но ключ оставался, и всё, что читает ключ
 * напрямую (предикаты правил, CSS-тема wh-race-*, подбор элитных архетипов,
 * reqRace, вкладка Навигатора) продолжало считать персонажа этой расой —
 * опустошить слот с листа было нельзя вообще (Находка C2 общего ревью,
 * wdbc-n1k). Когда clearRace зовётся ПЕРЕД применением новой расы
 * (applyRace), ключ всё равно перезаписывается следом её собственным
 * update — двойная запись безвредна.
 */
export async function clearRace(actor) {
  await clearSubrace(actor);
  await clearRacePast(actor);
  await clearGrantedBy(actor, "race", actorRaceItem(actor));
  await actor.update({ "system.race": "" });
}
export async function clearSubrace(actor) {
  await clearGrantedBy(actor, "subrace", actorSubraceItem(actor));
  await actor.update({ "system.subrace": "" });
}
export async function clearRacePast(actor) {
  await clearGrantedBy(actor, "racePast", actorRacePastItem(actor));
}

/**
 * Раса персонажа: снимает прежнюю, кладёт носитель (штатный createItem →
 * applyItemMechanics выдаёт Черты, таланты и навыки), пишет ключ-зеркало и
 * стартовые характеристики.
 *
 * Пустой ключ означает «снять расу», а не «ошибка».
 *
 * Прошлое Иннари и Арлекина — та же выдача под своим тегом `racePast`: оно
 * снимается отдельно от самой расы, иначе смена Прошлого уносила бы расу.
 *
 * @param {Actor} actor
 * @param {string} key
 * @param {{tag?: string, mirror?: boolean}} [opts]  tag — под каким тегом
 *   помечать выданное; mirror:false — не трогать system.race (так кладётся
 *   Прошлое: ключ расы остаётся «ynnari»)
 */
export async function applyRace(actor, key, { tag = "race", mirror = true } = {}) {
  if (!actor) return;
  // Своя раса тянет за собой субрасу и Прошлое; Прошлое снимает только себя.
  if (tag === "race") await clearRace(actor);
  else await clearRacePast(actor);
  if (!key) {
    if (mirror) await actor.update({ "system.race": "", "system.subrace": "" });
    return;
  }

  const def = raceDef(key);
  // Пака в мире может не быть (свежий мир, отключённая библиотека): тогда
  // носителя не будет, но ключ и стартовые характеристики персонаж получит —
  // лист продолжит работать по ключу, как до переезда. Раньше это происходило
  // молча (Находка I2, wdbc-n1k): без пака откат на константы даёт ключ и
  // характеристики, но НОЛЬ расовых Черт, и игрок об этом не узнавал.
  const src = def?.uuid ? await fromUuid(def.uuid).catch(() => null) : null;
  if (src) {
    const data = src.toObject();
    delete data._id;
    data.flags = { ...(data.flags || {}), [FLAG]: { ...(data.flags?.[FLAG] || {}), [GRANT]: tag } };
    // Хук createItem применит Механику носителя асинхронно и Foundry его
    // промис не ждёт — код, идущий следом (в Мастере создания это applySubrace
    // с фильтром removesTraits), может пробежать по актору раньше, чем хук
    // успел выдать расовые Черты (Находка I3, wdbc-n1k). Применяем Механику
    // сами и синхронно ждём — а SKIP_MECHANICS_HOOK в опциях создания
    // говорит хуку не применять её ещё раз следом (см. константу выше: одной
    // идемпотентности applyItemMechanics тут НЕ хватает — оба вызова успевают
    // стартовать с одинаковым пустым флагом mechanicsApplied, и Черты
    // выдались бы дважды).
    const [created] = await actor.createEmbeddedDocuments("Item", [data], { [SKIP_MECHANICS_HOOK]: true });
    if (created) await applyItemMechanics(created);
  } else {
    ui.notifications?.warn(
      `⚠️ Библиотека рас не загружена — Черты расы «${def?.label || key}» не выданы. `
      + `Дождитесь полной загрузки мира и примените расу ещё раз.`);
  }

  await actor.update({
    ...(mirror ? { "system.race": key, "system.subrace": "" } : {}),
    ...raceCharsUpdate(actor, def?.chars || {})
  });

  ui.notifications?.info(`🧬 ${mirror ? "Раса" : "Прошлое"}: ${def?.label || key}.`);
}

/**
 * Субраса: только своей расе. Чужая — отказ с пояснением, лист не меняется:
 * молчаливое применение чужой субрасы испортило бы персонажа незаметно.
 *
 * Проверки идут ДО clearSubrace: clearSubrace теперь обнуляет и ключ
 * (Находка C2, wdbc-n1k), а отказ обязан оставить лист как есть — иначе
 * безобидная попытка кинуть чужую субрасу молча снимала бы уже стоящую.
 */
export async function applySubrace(actor, key) {
  if (!actor) return;
  if (!key) return clearSubrace(actor);

  const def  = subraceEntries()[key];
  const race = actor.system.race || "";
  if (!race) return ui.notifications?.warn("Сначала выберите расу.");
  // Субрасу без записи в библиотеке сверять не с чем: у неё нет parent, и
  // проверка ниже её пропускала — ключ уезжал в system.subrace, а Черты не
  // выдавались. Отказ громкий: это путь «перетащили субрасу из чужого мира».
  if (!def) return ui.notifications?.warn(
    `Субраса «${key}» не найдена в библиотеке — применение отменено.`);
  if (def.parent && def.parent !== race) {
    const raceLabel = raceDef(race)?.label || race;
    const parentLabel = raceDef(def.parent)?.label || def.parent;
    return ui.notifications?.warn(
      `${def.label} — субраса расы «${parentLabel}», а у персонажа «${raceLabel}».`);
  }

  await clearSubrace(actor);

  const src = def?.uuid ? await fromUuid(def.uuid).catch(() => null) : null;
  if (src) {
    const data = src.toObject();
    delete data._id;
    data.flags = { ...(data.flags || {}), [FLAG]: { ...(data.flags?.[FLAG] || {}), [GRANT]: "subrace" } };
    // Хук createItem применит Механику носителя асинхронно и Foundry его
    // промис не ждёт (Hooks.callAll не await'ит колбэки) — фильтр removesTraits
    // ниже читает actor.items СРАЗУ и может пробежать раньше хука, не увидев
    // ещё не выданные субрасовые Черты (Находка I3, wdbc-n1k). Применяем
    // Механику сами и синхронно ждём — а SKIP_MECHANICS_HOOK в опциях
    // создания говорит хуку не применять её ещё раз следом (см. константу
    // выше: идемпотентности applyItemMechanics тут НЕ хватает — оба вызова
    // успевают стартовать с одинаковым пустым флагом mechanicsApplied).
    const [created] = await actor.createEmbeddedDocuments("Item", [data], { [SKIP_MECHANICS_HOOK]: true });
    if (created) await applyItemMechanics(created);

    // Африэль/Эльданар (wdbc-iu53) — выбор Дружественных Характеристик/
    // Навыков при получении субрасы, тот же принцип «диалог сразу после
    // выдачи», что и Родной мир/Предсказание. Пропустить (крестик/Esc) не
    // ломает субрасу — override просто не применяется, доступно повторить
    // позже правкой Механики предмета вручную.
    if (created && needsAptitudeChoice(key)) {
      const picks = await promptSubraceAptitudeChoice(key, def.label || key);
      if (picks) await applySubraceAptitudeChoice(created, picks);
    }
  }

  // Субрасы друкхари отменяют часть расовых Черт. Имена в `removesTraits` и на
  // Черте почти никогда не совпадают посимвольно: данные книги называют Черту
  // одной половиной («Natural Weapons»), а предмет в паке — двуязычно
  // («Natural Weapons / Естественное Оружие»). Сверка идёт через itemHasName
  // (rules/predicates.mjs) — тем же способом, что и предикат `hasTrait`: по
  // РАВЕНСТВУ половины двуязычного имени, а не по вхождению подстроки, иначе
  // «Natural Weapons» снёс бы заодно другую Черту — «Deadly Natural Weapons».
  const drop = def?.removesTraits || [];
  if (drop.length) {
    const ids = actor.items
      .filter(i => i.type === "trait" && drop.some(name => itemHasName(i, name)))
      .map(i => i.id);
    if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
  }

  await actor.update({ "system.subrace": key });
}

/** Иннари: бонусы Прошлого (бывшей расы) + Черты Иннари. */
export async function applyYnnari(actor, callbacks) {
  const past = actor.system.ynnariPast;
  // Прошлое — бонусы бывшей расы, но раса персонажа остаётся своей, поэтому
  // mirror:false, а свой тег даёт снять Прошлое, не трогая саму расу.
  if (past) await applyRace(actor, past, { tag: "racePast", mirror: false });
  const n = await callbacks.createTraits(RACES.ynnari.traits || [], "Иннари");
  ui.notifications.info(`Иннари: применены Черты Иннари (${n})${past ? ` и бонусы Прошлого (${RACES[past]?.label})` : ""}.`);
}

/** Арлекин: бонусы Прошлого (изначальной расы) + Черты Арлекина. */
export async function applyHarlequin(actor, callbacks) {
  const past = actor.system.harlequinPast;
  if (past) await applyRace(actor, past, { tag: "racePast", mirror: false });
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
      content: `<div style="padding:6px;font-size:0.9em;">Выберите проклятье:<ul style="margin:6px 0 0;padding-left:16px;">${choices.map(ch => `<li><b>${esc(ch.name)}</b> — ${ch.text}</li>`).join("")}</ul></div>`,
      buttons, default: "c0"
    }, { width: 460 }).render(true);
    return;
  }

  await apply(noCurse ? null : { name: effName, text: curse });
}
