// module/combat/bulldoze.mjs
// ════════════════════════════════════════════════════════════════════════
//  НАПРОЛОМ (стр. 31, wdbc-x1nz.2.65) — эффект победы в состязании
//  (MELEE_CONTESTS.bulldoze), подмешивается в module/sheets/tabs/combat.mjs
//  тем же приёмом, что Финт/Давление (combat/feint-press.mjs).
//
//  ЧЕСТНО НЕ АВТОМАТИЗИРОВАНО: книга описывает ОДИН бросок мовера против
//  ВСЕХ врагов на пути ПО ОЧЕРЕДИ (свой встречный порог у каждого,
//  штраф −10×разница Размера у меньших, остановка перед первым победившим).
//  _showContestDialog (techniques.mjs) — общий диалог на ОДНОГО оппонента,
//  без очереди/нескольких целей; развернуть его в полноценный многоцелевой
//  резолвер — отдельная, более крупная задача (тот же честный предел, что
//  уже был в note самого MELEE_CONTESTS.bulldoze). Здесь автоматизировано:
//  штраф −10×разница Размера против ВЫЦЕЛЕННОГО противника (подсказка в
//  Доп. модификаторе диалога), жёсткий запрет ролла против цели на 1+
//  Размер крупнее, и последствия победы ПРОТИВ ЭТОЙ цели — Свободная Атака
//  не срабатывает (тот же флаг, что «Выход из Боя»), 5+ Успехов — Ничком +
//  напоминание про Пинок (интегральное оружие, не отдельный бросок урона
//  сам по себе — обычная рукопашная атака им).
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, outcomeHtml } from "../helpers/test-card.mjs";
import { statusApplyFields } from "./status-resist.mjs";
import { sizeOf } from "../rules/predicates.mjs";
import { hasPugilistTalent } from "../rules/pugilist-talents.mjs";
import { hasTalent, isBike, roadkillDamage } from "../rules/mount.mjs";

/** Разница в Размере (мовер − цель); >0 — цель МЕНЬШЕ. */
export function bulldozeSizeDiff(actor, target) {
  return sizeOf(actor) - sizeOf(target);
}

/** «Нельзя против противников на 1+ Размер больше персонажа» — жёсткий запрет. */
export function bulldozeForbidden(actor, target) {
  return bulldozeSizeDiff(actor, target) <= -1;
}

/**
 * Штраф −10 за уровень разницы МЕНЬШЕМУ противнику (только если цель
 * МЕНЬШЕ). С wdbc-x1nz.2.73 идёт в бросок сопротивления противника, а не
 * инициатору: до этого он «подсказывался» в Доп. модификатор самого
 * Напролома, то есть наказывал того, кто крупнее.
 */
export function bulldozeSizePenalty(actor, target) {
  const diff = bulldozeSizeDiff(actor, target);
  return diff > 0 ? -10 * diff : 0;
}

/**
 * Урон Переехать: бросок здесь же (Tearing — 3d10, два лучших) и кнопка «Применить
 * урон», как у остальных карточек урона. «Байк, над которым персонаж потрудился хотя
 * бы ¼ смены» — условие стола, система смен над байком не ведёт.
 */
async function roadkillDamageSection(actor, target, mount) {
  const d = roadkillDamage(actor);
  const roll = await new Roll(d.formula).evaluate();
  return `<div class="roll-damage-section">
      <div class="roll-damage-label">${rollIcon("blood", "#ff6b6b")}Переехать: 2d10+A.b (${d.bonus}) R, Pen ${d.penetration}, Tearing — <b>${roll.total}</b></div>
      <button class="wh-apply-dmg-btn" type="button"
        data-damage="${roll.total}" data-penetration="${d.penetration}" data-damage-type="${d.damageType}" data-damage-subtype=""
        data-hit-location="Торс" data-weapon-name="Переехать (${esc(mount.name)})" data-attacker="${esc(actor.name)}"
        data-felling="0" data-primitive="0" data-ignore-shield="0" data-warp-soak="0" data-melee="1">
        Применить ${roll.total} урона${target ? ` — ${esc(target.name)}` : ""}
      </button>
      <div class="roll-threshold" style="font-size:0.85em;opacity:0.8;">Условие Таланта — байк, над которым персонаж потрудился хотя бы ¼ смены: следит стол.</div>
    </div>`;
}

export async function resolveBulldozeSuccess(actor, { deg, target } = {}) {
  if (!target) {
    return ui.notifications?.warn(`${actor.name}: цель Напролома не выцелена на сцене — эффект не наложен.`);
  }
  // Не получает Свободных Атак (стр. 31) — то же разовое «на одно движение»
  // освобождение, что «Выход из Боя» (movement-actions.mjs::declareDisengage);
  // само движение (Натиск/Бег) книжной дистанцией не автоматизировано.
  await actor.setFlag("warhammer-dbc", "disengageActive", true);
  const sections = [
    `<div class="roll-threshold">Персонаж проходит мимо ${esc(target.name)}, не получая от неё Свободной Атаки.</div>`
  ];
  // Громовой Натиск (стр. 62, 3-eddb): проигравшие во встречном тесте «всегда
  // сбиваются с ног и получают урон, как если бы проиграли на 5+ Провалов» —
  // у носителя ветка 5+ Успехов срабатывает при ЛЮБОЙ победе. Урон Пинка —
  // напоминание, как и в обычной ветке (стр. 40).
  const thunder = hasPugilistTalent(actor, "thunderCharge");
  // Переехать (Всадник, Sahara 3-cross-actor-5482): Напролом БАЙКОМ — цель всегда
  // сбивается с ног и вместо обычного урона получает 2d10+A.b R, Pen P.b, Tearing.
  const mountUuid = actor.system?.mount?.uuid;
  const mount = (mountUuid && hasTalent(actor, "Roadkill", "Переехать"))
    ? await fromUuid(mountUuid).catch(() => null) : null;
  const roadkill = !!mount && isBike(mount);
  if (deg >= 5 || thunder || roadkill) {
    // Стена (Талант Стойкости): сбиваемый носитель вправе пройти S+0 и устоять.
    const { fields, resisted, note } = await statusApplyFields(target, "prone", null,
      { attacker: actor, melee: true, source: "Напролом" });
    if (Object.keys(fields).length) await target.update(fields);
    const lead = roadkill ? "Переехать (байк)"
      : deg >= 5 ? "5+ Успехов" : "Громовой Натиск (победа считается как 5+ Успехов)";
    if (roadkill) {
      sections.push(`<div class="roll-threshold">${lead}: ${resisted ? esc(note) : `${esc(target.name)} сбит(а) с ног`} — вместо урона Пинка байк давит цель.</div>`);
      sections.push(await roadkillDamageSection(actor, target, mount));
    } else {
      sections.push(resisted
        ? `<div class="roll-threshold">${lead}: ${esc(note)} Попадание Пинком или оружием на ноге — по-прежнему на усмотрение стола (стр. 40).</div>`
        : `<div class="roll-threshold">${lead}: ${esc(target.name)} сбит(а) с ног и получает попадание Пинком или оружием на ноге персонажа — разыграйте обычной рукопашной атакой этим оружием (стр. 40).</div>`);
    }
  }
  await postTestCard(actor, {
    icon: rollIcon("sword", "#e08a3a"),
    title: `Напролом: ${esc(target.name)}`,
    outcome: outcomeHtml(true, "Проход успешен"),
    sections
  }, { sound: false });
}
