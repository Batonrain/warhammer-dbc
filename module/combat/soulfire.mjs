// module/combat/soulfire.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Огонь Души / Soulfire (Пиромантия, Пламя души; wdbc-l481 → конец сессии
//  23.09.2026). Книга: «Когда он наносит E(Fl) урон (после Избегания, но до
//  броска на Щиты), псайкер может манифестировать эту силу, при Успехе нанося
//  себе PR+1d5 урона в W и увеличивая урон одного попадания его пламени по
//  одной цели на его выбор на PRd5. Усиленное таким образом пламя игнорирует
//  иммунитет к E или E(Fl) Dmg.»
//
//  «После Избегания, до Щитов» — ровно момент между карточкой атаки и кнопкой
//  «Применить урон»: щит катится внутри applyDamageToActor. Поэтому рядом с
//  каждой кнопкой урона подвида E(Fl), у которой атакующий — владелец Огня
//  Души, появляется кнопка силы. Она открывает обычное окно манифестации
//  (фазы, Усиление, Феномены — всё как при касте с листа), а при Успехе
//  правит data-damage соседней кнопки прямо в DOM — тот же приём, что у
//  Смертельной Ловушки (.wh-legacy-deadly-trap-btn, hooks.mjs).
//
//  Иммунитет к «E» (широкому типу) в системе не заведён вовсе — есть только
//  damageImmunity.subtype.*, его и снимает флаг ignoreSubtypeImmunity.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "../rules/predicates.mjs";
import { showManifestDialog } from "../sheets/tabs/psychic.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";

const BTN_CLASS = "wh-soulfire-btn";

/** Психосила «Огонь Души» на акторе (или null). */
export function soulfirePower(actor) {
  return (actor?.items ?? []).find(i => i.type === "psychicPower"
    && (itemHasName(i, "Soulfire") || itemHasName(i, "Огонь Души"))) ?? null;
}

/**
 * Кнопка силы рядом с каждой кнопкой урона E(Fl), если атакующий — свой
 * актор с Огнём Души. Кнопка появляется только у владельца атакующего:
 * манифестирует сам псайкер, не цель и не соседний игрок.
 * @param {HTMLElement} html  отрисованная карточка чата
 */
export function injectSoulfireButtons(html) {
  for (const applyBtn of html.querySelectorAll('.wh-apply-dmg-btn[data-damage-subtype="flame"]')) {
    if (applyBtn.nextElementSibling?.classList.contains(BTN_CLASS)) continue;
    const uuid = applyBtn.dataset.attackerUuid;
    if (!uuid) continue;
    let actor = null;
    try { actor = fromUuidSync(uuid); } catch { actor = null; }
    if (!actor?.isOwner || !soulfirePower(actor)) continue;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = BTN_CLASS;
    btn.dataset.attackerUuid = uuid;
    btn.textContent = "🔥 Огонь Души: +PRd5 к этому попаданию";
    btn.title = "Манифестировать Огонь Души: при Успехе псайкер получает PR+1d5 урона в W, "
      + "попадание — +PRd5 урона и игнорирует иммунитет к E(Fl).";
    applyBtn.after(btn);
    btn.addEventListener("click", ev => { ev.preventDefault(); onSoulfireClick(btn); });
  }
}

/** Клик по кнопке силы: окно манифестации, при Успехе — правка урона. */
export async function onSoulfireClick(btn) {
  const applyBtn = btn.previousElementSibling;
  if (!applyBtn?.classList.contains("wh-apply-dmg-btn")) return;
  const actor = await fromUuid(btn.dataset.attackerUuid).catch(() => null);
  const power = soulfirePower(actor);
  if (!power) return ui.notifications.warn("У атакующего нет психосилы «Огонь Души».");
  showManifestDialog(actor, power, {
    onResult: ({ success, ePR }) => success ? boostHit(actor, applyBtn, btn, ePR) : null
  });
}

/**
 * Видимое число урона. Карточки кладут его по-разному: атака оружием —
 * `<b>` внутри кнопки, психосила — голым текстом «11 → Торс» на кнопке и
 * `<b>` в соседней подписи той же строки (sheets/tabs/psychic.mjs). Правим
 * всё, где стоит прежнее число, иначе игрок видит старый урон (живая
 * проверка 23.09.2026).
 */
function showNewDamage(applyBtn, prev, next) {
  const old = String(prev);
  const inner = applyBtn.querySelector("b");
  if (inner) inner.textContent = String(next);
  else if (applyBtn.textContent.includes(old)) {
    applyBtn.textContent = applyBtn.textContent.replace(new RegExp(`\\b${old}\\b`), String(next));
  }
  for (const b of applyBtn.parentElement?.querySelectorAll?.("b") ?? []) {
    if (b !== inner && b.textContent.trim() === old) b.textContent = String(next);
  }
}

/**
 * Успешная манифестация: +PRd5 к попаданию, иммунитет к подвиду не действует,
 * псайкеру — PR+1d5 урона в W. Экспортирована для теста.
 */
export async function boostHit(actor, applyBtn, btn, ePR) {
  const pr = Math.max(1, Number(ePR) || 1);
  const boost = await new Roll(`${pr}d5`).evaluate();
  const self  = await new Roll(`${pr}+1d5`).evaluate();

  const prev = parseInt(applyBtn.dataset.damage) || 0;
  const next = prev + boost.total;
  applyBtn.dataset.damage = String(next);
  applyBtn.dataset.ignoreSubtypeImmunity = "1";
  showNewDamage(applyBtn, prev, next);
  btn.disabled = true;
  btn.textContent = `🔥 Огонь Души: +${boost.total} Dmg, иммунитет к E(Fl) не действует`;

  const before = Number(actor.system.charDamage?.wp) || 0;
  await actor.update({ "system.charDamage.wp": before - self.total });

  await postTestCard(actor, {
    icon: rollIcon("fire", "#4f8cff"), title: `Огонь Души — ${esc(actor.name)}`,
    lines: [
      `<div class="roll-threshold">Попадание пламени: <b>+${boost.total}</b> Dmg (${pr}d5), игнорирует иммунитет к E(Fl).</div>`,
      `<div class="roll-threshold">Цена: <b>${self.total}</b> урона в W (${pr}+1d5).</div>`
    ]
  }, { rolls: [boost, self] });
}
