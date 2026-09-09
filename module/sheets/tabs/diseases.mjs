// module/sheets/tabs/diseases.mjs
//
// Болезни на вкладке ЭФФЕКТЫ: список полученных, галочка «действует» и
// заведение новой записи. Сами таблицы живут в constants/diseases.mjs, лечение
// и течение болезни — в её листе предмета.
//
// Функция принимает актора, а не лист.

import { hasRuleFlag } from "../../rules/flags.mjs";
import { PERFECT_HOST } from "../../rules/perfect-host.mjs";

export function activateDiseaseListeners(html, actor) {
  html.find(".disease-name-link").click(ev => {
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (item) item.sheet?.render(true);
  });
  html.find(".disease-remove-btn").click(async ev => {
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (!item) return;
    // Идеальный Хозяин (wdbc-1rno, Дар Нургла): «не может быть вылечен от
    // болезней». Из четырёх обещаний книги это единственное, у которого в
    // системе есть что запрещать — снятие болезни настоящей кнопкой; см.
    // разбор остальных трёх в module/rules/perfect-host.mjs.
    if (hasRuleFlag(actor, PERFECT_HOST)) {
      return ui.notifications.warn(`Идеальный Хозяин: ${actor.name} не может быть вылечен от болезней.`);
    }
    await item.delete();
  });
  html.find(".disease-active-toggle").click(async ev => {
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (item) await item.update({ "system.active": !item.system.active });
  });
  html.find(".disease-add-btn").click(async () => {
    const [it] = await actor.createEmbeddedDocuments("Item", [
      { name: "Новая болезнь", type: "disease", system: { diseaseType: "warp" } }
    ]);
    it?.sheet.render(true);
  });
}
