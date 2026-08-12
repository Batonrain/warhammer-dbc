// module/sheets/tabs/paths.mjs
//
// Пути Аэльдари на вкладке СПОСОБНОСТИ: список пройденных Путей с градацией у
// каждого. Таблицы живут в constants/aeldari-paths.mjs, а что показать —
// собирает character-context.mjs; здесь кнопки «＋», «✕» и сохранение выбора.
//
// Функция принимает актора, а не лист. Сворачивание панели осталось на листе:
// это состояние окна, а не актора.

import { AZURIANE_PATHS, PATH_GRADE_ORDER } from "../../constants/aeldari-paths.mjs";

/** Текущий список как массив (значение могло стать объектом после правок). */
function pathsOf(actor) {
  const v = actor.system.paths;
  if (Array.isArray(v)) return foundry.utils.deepClone(v);
  if (v && typeof v === "object") return Object.values(v);
  return [];
}

export function activatePathListeners(html, actor) {
  html.find(".path-add-btn").click(async ev => {
    ev.preventDefault();
    const arr = pathsOf(actor);
    arr.push({ key: "", grade: "" });
    await actor.update({ "system.paths": arr });
  });
  html.find(".path-remove").click(async ev => {
    ev.preventDefault();
    const idx = parseInt(ev.currentTarget.dataset.index);
    const arr = pathsOf(actor);
    arr.splice(idx, 1);
    await actor.update({ "system.paths": arr });
  });

  const savePaths = async () => {
    const arr = [];
    html.find(".path-sel").each((_, el) => {
      const i = parseInt(el.dataset.index);
      if (!arr[i]) arr[i] = { key: "", grade: "" };
      arr[i].key = el.value;
    });
    html.find(".path-grade").each((_, el) => {
      const i = parseInt(el.dataset.index);
      if (!arr[i]) arr[i] = { key: "", grade: "" };
      arr[i].grade = el.value;
    });
    // При смене пути сбрасываем градацию на первую доступную
    html.find(".path-sel").each((_, el) => {
      const i = parseInt(el.dataset.index);
      const path = AZURIANE_PATHS[el.value];
      if (path && arr[i] && !path.grades?.[arr[i].grade]) {
        arr[i].grade = PATH_GRADE_ORDER.find(g => path.grades?.[g]) || "";
      }
    });
    await actor.update({ "system.paths": arr });
  };
  html.find(".path-sel, .path-grade").on("change", savePaths);
}
