// module/sheets/tabs/rituals.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Раздел «Ритуалы» на вкладке Способности (корбук стр. 393-425).
//
//  Показывает ритуалы, лежащие на акторе: раздел книги, Запись, вилку
//  ассистентов, и раскрывает прозу по клику. Сам бросок ведёт движок Завесы
//  (`module/constants/rituals.mjs`) — здесь только список и его правка.
//
//  Функция контекста принимает актора, а не лист, поэтому проверяется без
//  Foundry.
// ════════════════════════════════════════════════════════════════════════════

import { RITUAL_ITEM_TYPES_MAP, TEST_CHARS } from "../../constants/rituals.mjs";
import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../../constants/skills.mjs";
import { openCompendiumBrowser } from "../../apps/compendium-browser.mjs";
import { getItemRequirements, isReqComplete, describeReqEntry } from "../../apps/mechanics.mjs";

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
    const assistReqLines = reqLinesOf(i, "assistReq");
    return {
      reqLines,
      assistReqLines,
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

  html.find(".ritual-name-link").on("click", ev => {
    actor.items.get(ev.currentTarget.dataset.itemId)?.sheet?.render(true);
  });

  html.find(".ritual-remove-btn").on("click", async ev => {
    ev.preventDefault();
    await actor.items.get(ev.currentTarget.dataset.itemId)?.delete();
  });
}
