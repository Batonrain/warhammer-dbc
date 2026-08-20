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
//
//  Персонажа заводит себе игрок, а не Мастер, поэтому кнопка стоит у всех. Но
//  право «создавать Актёров» в Foundry по умолчанию есть только у Помощника и
//  Мастера, и своими силами игрок актора не создаст. Тогда кнопка просит об
//  этом Мастера по системному сокету: тот заводит персонажа, отдаёт его
//  просителю во владение и отвечает — лист и Мастер создания открываются уже у
//  игрока. Если право у игрока есть, всё делается на месте, без посредника.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";

/** Имя нового листа: персонажа ещё не назвали, назовут в Мастере. */
export const NEW_CHARACTER_NAME = "Новый персонаж";

/**
 * Завести персонажа и открыть на нём Мастера. Если своего права на создание
 * нет — попросить Мастера игры (лист откроется ответом по сокету).
 * @returns {Promise<Actor|null>} актор, если он создан здесь и сейчас
 */
export async function startCharacterCreation() {
  if (!game.user?.can?.("ACTOR_CREATE")) return requestCharacterFromGM();

  const actor = await Actor.create({ name: NEW_CHARACTER_NAME, type: "character" });
  if (!actor) return null;

  await openStartedCharacter(actor);
  return actor;
}

/**
 * Просьба к Мастеру завести персонажа. Ответ придёт сообщением
 * `characterStarted` (обработчик сокета в warhammer-dbc.mjs).
 */
function requestCharacterFromGM() {
  if (!game.users?.activeGM) {
    ui.notifications?.warn(
      "Создать персонажа некому: Мастера нет в игре. Начните, когда он подключится, "
      + "или попросите выдать вашей роли право «Create New Actors».");
    return null;
  }
  game.socket?.emit("system.warhammer-dbc", { action: "startCharacter", userId: game.user.id });
  ui.notifications?.info("Мастер заводит лист — он откроется сам через мгновение.");
  return null;
}

/**
 * Открыть лист созданного персонажа и Мастера создания на нём. Зовётся и на
 * своём создании, и из ответа Мастера по сокету.
 */
export async function openStartedCharacter(actor) {
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
    // Права на создание не спрашиваем: без него кнопка просит Мастера.
    if (!game.user) return;
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
