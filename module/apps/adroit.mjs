// module/apps/adroit.mjs
// ════════════════════════════════════════════════════════════════════════
//  Искусный (Adroit, Ренегат): выбор Характеристики при получении Черты.
//  Логика бонуса — module/rules/adroit.mjs. Здесь только диалог и хук:
//  Черта попала на актора (Мастер создания, выбор Архетипа в шапке, ручной
//  перенос) — у того, кто её положил, всплывает выбор; ответ ложится флагом
//  на саму Черту. Закрыл окно без выбора — бонуса нет, пока Черту не
//  выдадут заново (или ГМ не поставит флаг руками).
// ════════════════════════════════════════════════════════════════════════

import { CHARACTERISTICS } from "../constants/characteristics.mjs";
import { ADROIT_FLAG, ADROIT_CHAR_FLAG, ADROIT_CHOICES } from "../rules/adroit.mjs";
import { esc } from "../helpers/utils.mjs";

const FLAG = "warhammer-dbc";

/** Несёт ли предмет запись Конструктора «Возможность trait.adroit». */
export function isAdroitTrait(item) {
  if (item?.type !== "trait") return false;
  const groups = item?.flags?.[FLAG]?.mechanics ?? [];
  const walk = entries => (entries ?? []).some(e =>
    (e?.kind === "capability" && e.capabilityKey === ADROIT_FLAG) || (e?.group && walk(e.group.entries)));
  return groups.some(g => walk(g.entries));
}

/** Диалог выбора; null — окно закрыли. */
export async function promptAdroitChar(actorName = "") {
  const options = ADROIT_CHOICES.map(k =>
    `<option value="${k}">${esc(CHARACTERISTICS[k]?.label ?? k)} (${esc(CHARACTERISTICS[k]?.abbr ?? k)})</option>`).join("");
  return foundry.applications.api.DialogV2.prompt({
    window: { title: `Искусный${actorName ? ` — ${actorName}` : ""}` },
    content: `<p>Выберите Характеристику (кроме Inf): все успешные тесты на неё и на Навыки через неё получают +1 Успех.</p>
      <select name="adroitChar">${options}</select>`,
    ok: { label: "Выбрать", callback: (_ev, btn) => btn.form.elements.adroitChar.value }
  }).catch(() => null);
}

/** Хук createItem: спросить выбор, если он ещё не сделан. */
export async function onAdroitTraitCreated(item, userId) {
  if (userId !== game.user?.id || !item?.actor || !isAdroitTrait(item)) return;
  if (ADROIT_CHOICES.includes(item.getFlag(FLAG, ADROIT_CHAR_FLAG))) return;
  const pick = await promptAdroitChar(item.actor.name);
  if (!ADROIT_CHOICES.includes(pick)) return;
  await item.setFlag(FLAG, ADROIT_CHAR_FLAG, pick);
}
