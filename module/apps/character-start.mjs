// module/apps/character-start.mjs
// ════════════════════════════════════════════════════════════════════════════
//  «Начать создание персонажа» — кнопка в панели «Актёры», под «Create Actor».
//
//  Заводит пустой лист Персонажа и сразу открывает на нём Мастера. Всё
//  остальное — раса, архетип, характеристики и Уровень стартовой игры (стр. 23,
//  последний блок Мастера) — выбирается уже там: опыт зависит от расы, а её
//  называют в том же окне.
//
//  Раньше Мастера звала кнопка в шапке готового листа: персонажа приходилось
//  сперва заводить руками, а стартовый опыт вписывать самому.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";

/**
 * Завести персонажа и открыть на нём Мастера.
 * @returns {Promise<Actor|null>}
 */
export async function startCharacterCreation() {
  const actor = await Actor.create({ name: "Новый персонаж", type: "character" });
  if (!actor) return null;

  await actor.sheet?.render(true);
  // Мастеру нужен отрисованный лист: его коллбеки — методы листа.
  actor.sheet?.openCreationWizard?.();
  return actor;
}

/**
 * Кнопка в панели «Актёры», сразу под «Create Actor». Вешается на отрисовку
 * панели: своей разметки у боковой панели нет, поэтому вставляем узел сами.
 */
export function registerCharacterStartButton() {
  Hooks.on("renderActorDirectory", (app, html) => {
    if (!game.user?.can?.("ACTOR_CREATE")) return;
    const el = html?.[0] ?? html;
    if (!el?.querySelector || el.querySelector(".wh-start-character")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "wh-start-character";
    button.title = "Завести Персонажа и открыть Мастера создания";
    button.innerHTML = `<i class="fas fa-user-plus"></i> ${esc("Начать создание персонажа")}`;
    button.addEventListener("click", ev => { ev.preventDefault(); startCharacterCreation(); });

    // Под «Create Actor»: это первая кнопка в шапке панели.
    const header = el.querySelector(".directory-header .header-actions, .directory-header, .header-actions");
    if (header) header.appendChild(button);
    else el.prepend(button);
  });
}
