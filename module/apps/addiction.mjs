// module/apps/addiction.mjs
// ════════════════════════════════════════════════════════════════════════
//  Мутация «Addiction / Зависимость» (стр. 441, roll d100 1…2, wdbc-1rno):
//  панель на листе Мутации — сколько суток прошло с последнего утоления,
//  кнопка «Утолить». Что именно утоляет (13 субмутаций — еда, яд, кровь
//  врага…) остаётся отыгрышем, здесь только состояние и число (см. шапку
//  rules/addiction.mjs).
// ════════════════════════════════════════════════════════════════════════

import { isAddictionItem, addictionDaysSince, satisfyAddiction, addictionSubmutationRoll,
         addictionSatisfiedDays, knowsXenosSpecies } from "../rules/addiction.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { changeActorInfamy } from "./infamy-points.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { esc } from "../helpers/utils.mjs";

export { isAddictionItem };

/** Панель для листа предмета — пусто, если это не «Зависимость». */
export function addictionPanelHtml(item) {
  if (!isAddictionItem(item)) return "";
  const days = addictionDaysSince(item, game.time?.worldTime ?? 0);
  const unsatisfied = days >= 1;
  const status = unsatisfied
    ? `${rollIcon("warn", "#ff6b4d")}Не утолена уже ${Math.floor(days)} сут. — штраф −10 на тесты Навыков`
    : `${rollIcon("blood", "#8fd0ff")}Утолена${days > 0 ? ` (${days.toFixed(1)} сут. назад)` : ""}`;
  return `<div class="addiction-panel">
    <div class="addiction-status">${status}</div>
    <button type="button" class="addiction-satisfy-btn" data-item-id="${item.id}">
      ${rollIcon("blood", "#ffd24d")}Утолить
    </button>
  </div>`;
}

/**
 * Нажатие кнопки «Утолить» на листе Мутации. У трёх субмутаций утоление
 * имеет числовые последствия, и кнопка делает их сама (wdbc-1rno.12/.14):
 *  4 «Прах ксеноса» — спрашивает вид (решает ГМ) и, если персонаж с ним не
 *    знаком, выдаёт Forbidden Lore (Xenos (вид)) на +0;
 *  10 «Живая плоть» — спрашивает, подано ли при жертве: тогда на 10 дней;
 *  12 «Камень Душ» — +1d5 потраченных Очков Бесчестия (не выше максимума) и
 *    зависимость утолена на год.
 */
export async function useSatisfyAddiction(item) {
  const actor = item?.actor ?? item?.parent ?? null;
  const roll = addictionSubmutationRoll(item);
  const lines = [];

  if (roll === "4" && actor) {
    const species = await foundry.applications.api.DialogV2.prompt({
      window: { title: "Прах ксеноса" },
      content: `<label>Какой вид ксеносов? <small>(решает ГМ)</small>
        <input type="text" name="species" autofocus/></label>`,
      ok: { label: "Утолить", callback: (_ev, btn) => btn.form.elements.species.value.trim() }
    }).catch(() => null);
    if (species == null) return;
    if (species && !knowsXenosSpecies(actor, species)) {
      const arr = foundry.utils.deepClone(actor.system.groupSkills?.forbiddenLore || []);
      arr.push({ specialty: `Xenos (${species})`, rank: "knows", grantedRank: "knows", cost: 0 });
      await actor.update({ "system.groupSkills.forbiddenLore": arr });
      lines.push(`Незнакомый вид — получен Навык <b>Forbidden Lore (Xenos (${esc(species)}))</b> +0.`);
    }
  }

  let servedBeforeVictim = false;
  if (roll === "10") {
    servedBeforeVictim = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Живая плоть" },
      content: "<p>Плоть приготовлена, подана к столу и съедена в присутствии жертвы? Тогда зависимость утолена на 10 дней.</p>",
      rejectClose: false
    }).catch(() => false) === true;
  }

  if (roll === "12" && actor) {
    const r = await new Roll("1d5").evaluate();
    const { before, after } = await changeActorInfamy(actor, r.total);
    lines.push(`Камень Душ: 1d5 = ${r.total}, Очки Бесчестия ${before} → <b>${after}</b>.`);
  }

  const days = addictionSatisfiedDays(item, { servedBeforeVictim });
  await satisfyAddiction(item, { days });
  if (days > 1) lines.push(`Зависимость утолена на <b>${days === 365 ? "1 год" : `${days} дней`}</b>.`);

  if (actor && lines.length) {
    await postTestCard(actor, {
      icon: rollIcon("blood", "#ffd24d"),
      title: `Зависимость утолена — ${esc(item.name)}`,
      lines: lines.map(l => `<div class="roll-threshold">${l}</div>`)
    }, { sound: false });
  }
}
