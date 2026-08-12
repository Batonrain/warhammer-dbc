// module/sheets/tabs/diseases.mjs
//
// Болезни на вкладке ЭФФЕКТЫ: список полученных, галочка «действует» и
// заведение новой записи. Сами таблицы живут в constants/diseases.mjs, лечение
// и течение болезни — в её листе предмета.
//
// Функция принимает актора, а не лист.

export function activateDiseaseListeners(html, actor) {
  html.find(".disease-name-link").click(ev => {
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (item) item.sheet?.render(true);
  });
  html.find(".disease-remove-btn").click(async ev => {
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (item) await item.delete();
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
