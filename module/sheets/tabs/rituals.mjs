// module/sheets/tabs/rituals.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Раздел «Ритуалы» на вкладке Способности (корбук стр. 393-425).
//
//  Показывает ритуалы, лежащие на акторе: раздел книги, Запись, вилку
//  ассистентов, и раскрывает прозу по клику. Бросок — кнопка «Провести
//  ритуал» открывает module/sheets/ritual-cast-dialog.mjs (29.08.2026: раньше
//  ритуал мог провести только ГМ через окно «Завеса и Мистика», теперь любой
//  владелец листа — сам движок остался в module/apps/ritual-cast.mjs).
//
//  Функция контекста принимает актора, а не лист, поэтому проверяется без
//  Foundry.
// ════════════════════════════════════════════════════════════════════════════

import { RITUAL_ITEM_TYPES_MAP, TEST_CHARS } from "../../constants/rituals.mjs";
import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../../constants/skills.mjs";
import { openCompendiumBrowser } from "../../apps/compendium-browser.mjs";
import { getItemRequirements, isReqComplete, describeReqEntry,
         checkRequirements } from "../../apps/mechanics.mjs";
import { showRitualCastDialog } from "../ritual-cast-dialog.mjs";

/**
 * Требования набора — по строке на группу. Оператор группы обязан дожить до
 * текста: схлопывание всех групп в один плоский список переворачивает смысл
 * ИЛИ на противоположный, и альтернативы читаются как обязательные разом.
 * Формулировки те же, что в отчёте checkRequirements.
 */
const reqLinesOf = (item, flagKey) =>
  getItemRequirements(item, flagKey).flatMap(g => {
    const parts = (g.entries || []).filter(isReqComplete).map(describeReqEntry);
    if (!parts.length) return [];
    return [g.operator === "OR" ? `одно из: ${parts.join(" / ")}` : parts.join("; ")];
  });

/** Строки раздела: по ритуалу на строку. */
export function ritualsContext(actor) {
  return actor.items.filter(i => i.type === "ritual").map(i => {
    const s = i.system || {};
    const min = Number(s.assistMin) || 0;
    const max = Number(s.assistMax) || 0;
    // Требования механические (группы И/ИЛИ во флагах), поэтому в строке
    // листа они показываются разобранным текстом, а не полем system.
    const reqLines = reqLinesOf(i, "req");
    // Вилка «0—0» — ритуал в одиночку: помощников у него не бывает, значит и
    // требований к ним нет. Лист предмета такой блок в этом случае не рисует,
    // поэтому строка на листе актора его тоже не показывает — иначе всплывали
    // бы условия, набранные до того, как вилку свели к нулям.
    const assistReqLines = (min || max) ? reqLinesOf(i, "assistReq") : [];
    // Проходит ли САМ носитель требования ритуалиста. Требования к ассистентам
    // сюда не входят: их проверяют по каждому помощнику отдельно, а помощников
    // на листе ритуалиста нет. Отметка считается тем же checkRequirements,
    // которым гейтит проведение в консоли Завесы, — иначе строка и запрет
    // разъехались бы.
    const req = checkRequirements(actor, getItemRequirements(i, "req"));
    return {
      reqLines,
      assistReqLines,
      meetsReq:  req.ok,
      reqFailed: req.failed,
      id: i.id,
      name: i.name,
      typeLabel: RITUAL_ITEM_TYPES_MAP[s.ritualType]?.label || s.ritualType || "—",
      record: Number(s.record) || 0,
      // Вилка «0—0» значит «в одиночку», а не «данных нет» — рисуем прочерк.
      assistLabel: (min || max) ? `${min}—${max}` : "—",
      // ОПИСАНИЕ есть у любого типа предмета и правится на общем листе —
      // без него заполненный туда текст был бы недостижим с листа актора.
      description: s.description || "",
      procedure:   s.procedure   || "",
      result:      s.result      || "",
      cost:        s.cost        || "",
      failureCost: s.failureCost || "",
      // У ритуалов из пресетов проза пустая: в книге она есть, а в пресетах
      // нет. Без этого признака строка раскрывалась бы в пустой блок вместо
      // честного «описание не заполнено». Требования тоже считаются
      // содержимым — иначе строка с одними требованиями показывала бы их и
      // «описание не заполнено» разом.
      hasAnyText: !!(s.description || s.procedure || s.result || s.cost || s.failureCost
        || reqLines.length || assistReqLines.length)
    };
  });
}

/**
 * Поля пути проведения для листа предмета-ритуала: каким Навыком и от какой
 * характеристики он кидается. Набор навыков зависит от вида — обычные и
 * групповые не смешиваются, иначе в `testSkillKey` попал бы ключ, которого у
 * актора не бывает, и подстановка в консоли Завесы молча промахнулась бы.
 */
export function ritualTestContext(item) {
  const s = item?.system || {};
  const isGroupSkill = s.testSkillScope === "group";
  const defs = isGroupSkill ? GROUP_SKILLS_DEF : SKILLS_DEF;
  return {
    isGroupSkill,
    skills: Object.entries(defs)
      .map(([key, def]) => ({ key, label: def.label, selected: key === s.testSkillKey })),
    chars: TEST_CHARS.map(c => ({ ...c, selected: c.key === (s.testChar || "int") }))
  };
}

export function activateRitualListeners(html, actor) {
  // «＋» открывает Обозреватель сразу на паке ритуалов. Перетаскивание
  // предмета-ритуала на лист обрабатывает штатный _onDropItem — своего
  // обработчика дропа разделу не нужно.
  //
  // Больше здесь ничего и нет: открытие листа ритуала и удаление ведёт общее
  // контекстное меню строки предмета (activateItemContextMenu), которое висит
  // на всякой .item-row — так же, как у Талантов и Черт (wdbc-5qk).
  html.find(".ritual-add-btn").on("click", async ev => {
    ev.preventDefault();
    const uuid = await openCompendiumBrowser(false, { pack: "rituals" });
    if (!uuid) return;
    const src = await fromUuid(uuid).catch(() => null);
    if (!src) return;
    const data = src.toObject();
    delete data._id;
    await actor.createEmbeddedDocuments("Item", [data]);
  });

  // «Провести ритуал» — диалог с ситуативными модификаторами, доступен
  // владельцу листа (не только ГМу), как и остальные кнопки действий на нём.
  html.find(".ritual-cast-btn").on("click", ev => {
    ev.preventDefault(); ev.stopPropagation();
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (item) showRitualCastDialog(actor, item);
  });
}
