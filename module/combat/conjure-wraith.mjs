// module/combat/conjure-wraith.mjs
// ════════════════════════════════════════════════════════════════════════
//  Conjure Wraith/Вызвать Психокость (Талант Певцов Кости, wdbc-sk8s): «За
//  Полное действие персонаж создаёт психокостяной предмет Редкостью до R–1,
//  а также любое обычное психокостяное рукопашное оружие. Эти предметы, в
//  обход всех правил, не будут иметь свойства Reinforced и обладают более
//  грубыми формами. До F.b раз за сессию.»
//
//  «R» здесь = Редкость/Доступность предмета (подтверждено пользователем
//  01.09.2026 — снимает прежний блокер этой находки в wdbc-sk8s): «до R–1»
//  читается как фиксированный порог Редкости −1 («Average» — самый простой
//  ходовой уровень книжной таблицы Редкости из «IV. Арсенал/Редкость и
//  Качество»), а не переменная, производная от персонажа.
//
//  Два пула выбора через openCompendiumBrowser (module/apps/
//  compendium-browser.mjs) — та же инфраструктура, что kind:"equipment"
//  Конструктора МЕХАНИКА (module/apps/mechanics.mjs):
//    "item"   — простой предмет: паки gear/tools, maxAvailability −1.
//    "weapon" — «любое обычное психокостяное рукопашное оружие»: пак
//               weapons, папка «Психокостяное» (folderId ниже, 33 записи —
//               обычные "Психокостяной/-ая/-ое X" вперемешку с именными
//               уникальными клинками вроде «Ведьмин Клинок»/«Осколок
//               Анариса»). «Обычное» (не именное) — книжный качественный
//               эпитет, а не автоматизируемый фильтр: та же честная
//               граница, что LOS у Resplendent Raiment — игрок сам не
//               берёт из папки штучные именные клинки.
//
//  Клон создаётся БЕЗ Reinforced (weaponProps.key==="reinforced" вырезан) —
//  «в обход всех правил», даже если у оригинала в компендиуме это свойство
//  было. «Грубее по форме» — текстовая пометка в notes, не отдельное
//  игровое свойство (числом в книге не описано).
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "../rules/predicates.mjs";
import { hasAbility } from "../rules/ability-by-key.mjs";
import { isThrottleCountAvailable, incrementThrottleCount } from "../rules/cooldown.mjs";
import { openCompendiumBrowser } from "../apps/compendium-browser.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";

const FLAG = "conjureWraith";
// weapons/Азуриане/Рукопашное/Психокостяное — packs-src/.../_Folder.json
const WRAITHBONE_MELEE_FOLDER = "YwpKwjEs1NBtEKyn";

/** Владеет ли актор Талантом Conjure Wraith / Вызвать Психокость. */
export function hasConjureWraith(actor) {
  return hasAbility(actor, "ability.conjureWraith", "Conjure Wraith", "talent");
}

/** Лимит использований за сессию — F.b (минимум 1), как у Bone Song/Preservation. */
export function conjureWraithMax(actor) {
  return Math.max(1, Number(actor?.system?.characteristics?.fel?.bonus) || 0);
}

export function conjureWraithAvailable(actor) {
  return hasConjureWraith(actor) && isThrottleCountAvailable(actor, FLAG, "session", conjureWraithMax(actor));
}

/**
 * @param {Actor} actor
 * @param {"item"|"weapon"} mode
 */
export async function applyConjureWraith(actor, mode) {
  const pickMode = mode === "weapon"
    ? { pack: "weapons", filters: { folderId: WRAITHBONE_MELEE_FOLDER },
        prompt: "Выберите обычное психокостяное рукопашное оружие" }
    : { pack: ["gear", "tools"], filters: { maxAvailability: -1 },
        prompt: "Выберите простой предмет (Редкость −1 и ниже)" };
  const uuid = await openCompendiumBrowser(false, pickMode);
  if (!uuid) return;

  const src = await fromUuid(uuid).catch(() => null);
  if (!src) return ui.notifications.warn("Предмет не найден — возможно, компендиум изменился.");

  const data = src.toObject();
  delete data._id;
  data.name = `${data.name} (Вызванный Психокостью)`;
  data.system = data.system || {};
  if (Array.isArray(data.system.weaponProps)) {
    data.system.weaponProps = data.system.weaponProps.filter(p => p?.key !== "reinforced");
  }
  if ("notes" in data.system) {
    data.system.notes = [data.system.notes, "Вызван Conjure Wraith: грубее по форме, без Reinforced (в обход правил)."]
      .filter(Boolean).join(" ");
  }

  await incrementThrottleCount(actor, FLAG, "session", conjureWraithMax(actor));
  await actor.createEmbeddedDocuments("Item", [data]);

  await postTestCard(actor, {
    icon: rollIcon("warp", "#7fd3ff"), title: `Вызвать Психокость — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">Создан предмет: <b>${esc(data.name)}</b> — без Reinforced, грубее по форме.</div>`]
  }, { sound: false });
}
