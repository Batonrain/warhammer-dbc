// module/combat/damage-override.mjs
// ════════════════════════════════════════════════════════════════════════
//  ПРАВКА УРОНА В КАРТОЧКЕ АТАКИ — В ДАННЫХ СООБЩЕНИЯ, А НЕ ТОЛЬКО В DOM
//  (Sahara covering-fire-hip-shooting п.3).
//
//  «Кубик → Успехи» и «Искры» меняют число урона попадания после броска.
//  Раньше они правили data-damage кнопки «Применить урон» прямо в разметке
//  карточки — а разметка своя у каждого клиента: ГМ, применявший урон со
//  своего экрана, видел старое число, а после F5 замена пропадала вместе с
//  заблокированными кнопками.
//
//  ЧИСЛО урона хранится тем же механизмом, что у Огня Души и Смертельной
//  Ловушки — flags.warhammer-dbc.damageBoosts.<номер кнопки «Применить урон»>.damage
//  (combat/soulfire.mjs::persistDamageBoost/applyDamageBoosts, wdbc-t3c3t.9):
//  одно место правды, иначе поздняя правка одного механизма откатывалась бы
//  отрисовкой другого. Чужому (не автору сообщения) клиенту запись идёт через
//  активного ГМа сокетом messageDamageBoost, как у соседей.
//
//  Здесь же, во флаге dmgOverrides, лежат ТЕКСТЫ и погашенные кнопки правок
//  (после F5 «Искры» остаются серыми, а не оживают):
//    { groups: { "<номер группы попадания>": { buttons: { "<класс>:<номер>": "<текст>" } } },
//      cardDisabled: ["<селектор кнопок, погашенных на всей карточке>"] }
//  hooks.mjs::renderChatMessageHTML накладывает их ДО привязки обработчиков.
//  Номер группы — порядок .roll-dmg-hit-group в карточке: он не меняется,
//  пока сообщение живо.
// ════════════════════════════════════════════════════════════════════════

const NS = "warhammer-dbc";
export const DMG_OVERRIDES_FLAG = "dmgOverrides";
const GROUP = ".roll-dmg-hit-group";

/** Номер группы попадания, в которой лежит элемент (−1 — не в группе). */
export function hitGroupIndex(root, el) {
  const group = el?.closest?.(GROUP);
  return group ? [...root.querySelectorAll(GROUP)].indexOf(group) : -1;
}

/** Ключ кнопки внутри группы: класс и порядковый номер среди кнопок того же класса. */
export function buttonKey(group, btn, cls) {
  return `${cls}:${[...group.querySelectorAll(`.${cls}`)].indexOf(btn)}`;
}

function findButton(group, key) {
  const [cls, idx] = String(key).split(":");
  return [...group.querySelectorAll(`.${cls}`)][Number(idx)] ?? null;
}

/** Выставить число урона на кнопке «Применить урон» группы (правка DOM у нажавшего клиента). */
export function setGroupDamage(group, damage) {
  const apply = group?.querySelector?.(".wh-apply-dmg-btn");
  if (!apply) return;
  apply.dataset.damage = String(damage);
  const b = apply.querySelector("b");
  if (b) b.textContent = String(damage);
}

/**
 * Наложить сохранённые тексты и погашенные кнопки на разметку карточки (при каждой отрисовке сообщения).
 * Число урона накладывает combat/soulfire.mjs::applyDamageBoosts.
 */
export function applyDamageOverrides(root, overrides) {
  if (!root?.querySelectorAll || !overrides || typeof overrides !== "object") return;
  for (const sel of overrides.cardDisabled ?? []) {
    root.querySelectorAll(sel).forEach(b => { b.disabled = true; });
  }
  const groups = [...root.querySelectorAll(GROUP)];
  for (const [idx, entry] of Object.entries(overrides.groups ?? {})) {
    const group = groups[Number(idx)];
    if (!group || !entry) continue;
    for (const [key, text] of Object.entries(entry.buttons ?? {})) {
      const btn = findButton(group, key);
      if (!btn) continue;
      btn.disabled = true;
      btn.textContent = text;
    }
  }
}

/**
 * Записать правку урона в сообщение. Возвращает false, если запись не состоялась (правка осталась только в DOM).
 * Автор сообщения (или ГМ) пишет число и тексты одним обновлением; чужой клиент отправляет число через ГМа
 * (persistDamageBoost), тексты кнопок при этом остаются локальными.
 *
 * @param {ChatMessage} message
 * @param {HTMLElement} root     разметка карточки
 * @param {HTMLElement} btn      нажатая кнопка
 * @param {string} cls           класс нажатой кнопки (wh-dmg-swap-btn / wh-sparks-btn)
 * @param {{damage:number, text:string, disableCardWide?:string}} patch
 *        disableCardWide — селектор кнопок, гасимых на всей карточке («Искры» — раз за атаку)
 */
export async function recordDamageOverride(message, root, btn, cls, { damage, text, disableCardWide = "" }) {
  if (!message) return false;
  const idx = hitGroupIndex(root, btn);
  if (idx < 0) return false;
  const group = btn.closest(GROUP);
  const applyBtn = group.querySelector(".wh-apply-dmg-btn");
  const applyIdx = applyBtn ? [...root.querySelectorAll(".wh-apply-dmg-btn")].indexOf(applyBtn) : -1;

  if (message.isOwner === false) {
    if (!applyBtn || applyIdx < 0) return false;
    const { persistDamageBoost } = await import("./soulfire.mjs");
    await persistDamageBoost(applyBtn, { damage });
    return true;
  }

  const cur = structuredClone(message.getFlag?.(NS, DMG_OVERRIDES_FLAG) ?? {});
  cur.groups ??= {};
  cur.cardDisabled ??= [];
  const entry = cur.groups[idx] ?? { buttons: {} };
  entry.buttons = { ...(entry.buttons ?? {}), [buttonKey(group, btn, cls)]: text };
  cur.groups[idx] = entry;
  if (disableCardWide && !cur.cardDisabled.includes(disableCardWide)) cur.cardDisabled.push(disableCardWide);
  const data = { [`flags.${NS}.${DMG_OVERRIDES_FLAG}`]: cur };
  if (applyIdx >= 0) data[`flags.${NS}.damageBoosts.${applyIdx}.damage`] = damage;
  await message.update(data);
  return true;
}
