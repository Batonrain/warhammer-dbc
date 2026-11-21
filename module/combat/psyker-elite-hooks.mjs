// module/combat/psyker-elite-hooks.mjs
// ════════════════════════════════════════════════════════════════════════
//  Точки окна манифестации (sheets/tabs/psychic.mjs::executePsychotest) для
//  Черт и Талантов элитных архетипов-псайкеров. В psychic.mjs — по одной
//  короткой строке на точку, вся логика здесь:
//
//   eliteManifestGate   — до любых трат: можно ли вообще (Тёмные Искусства)
//   eliteManifestEpr    — к эPR и Порогу (Пламя Сердца, Мощь Переполняет,
//                          Чародейский Посох)
//   eliteManifestRoll   — после броска психотеста (Варп-Танцор: второй
//                          бросок A, берётся худший)
//   eliteShotShape      — число попаданий/Pen/Dmg психосилы (Оккультный Клинок,
//                          Фокусированный Шторм)
//   eliteExtraPeril     — Прорыв сверх обычного (Мощь Переполняет)
//   eliteManifestAfter  — строки карточки после исхода (Высший Магус,
//                          Последнее Эхо, Маг-Каннибал)
//
//  Отложенное «до следующей манифестации» — combat/psyker-elite-hooks-state.mjs.
//  Переброс психотеста (Ключевые Силы) повторяет opts первой попытки: взятое
//  из отложенного кладётся в opts.eliteBoost и при перебросе не берётся заново.
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollPeril } from "./rubric-sorcerer.mjs";
import { getPeril } from "../constants/psyker-tables.mjs";
import { takePendingManifest } from "./psyker-elite-hooks-state.mjs";
import { wizardStaffTestBonus } from "./archmagus.mjs";
import { hasMagusSupreme } from "../rules/archmagus-talents.mjs";
import { darkArtsGate, warpDanceOutcome } from "../rules/warlock-talents.mjs";
import { warlockAfterManifest } from "./warlock.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { occultShotShape, hasFocusedStorm, hasBladesOfBrotherhood, brotherhoodEpr, SHARED_MIND_FLAG, sharedMindRange, BROTHERHOOD_FLAG } from "../rules/kenetai-talents.mjs";
import { markOccultBladeUse } from "./kenetai-state.mjs";
import { parseRangeMeters } from "../rules/psy-range.mjs";
import { actorsDistance } from "./psyker-elite-common.mjs";

const small = (html, color = "") => `<div class="roll-threshold" style="font-size:0.85em;${color ? `color:${color};` : ""}">${html}</div>`;

/** Отказ манифестации (строка причины) или "". */
export function eliteManifestGate(actor, item, opts, { mPR = 0 } = {}) {
  void mPR;
  // Тёмные Искусства (Чернокнижник): только Пути Силы и Обычный режим; Варп-Танцор —
  // без Пути и реакции двумя бросками (метка opts.warpDance для eliteManifestRoll).
  const g = darkArtsGate(actor, { path: opts.path || "", mode: opts.mode || "normal", action: item?.system?.action });
  if (!g.ok) return g.reason;
  opts.warpDance = g.warpDance;
  // Оккультный Клинок (Кенетаи): манифестация с кромки клинка — без Путей Силы.
  if (opts.occultBlade && opts.path) return "Оккультный Клинок: манифестация без Путей Силы.";
  return "";
}

/**
 * эPR и поправка Порога от отложенного. Возвращает новый эPR; поправку
 * Порога кладёт в opts.modifier (её видно в карточке строкой «Модификатор»).
 */
export async function eliteManifestEpr(actor, item, opts, ePR, lines) {
  const boost = opts.reroll ? (opts.eliteBoost ?? {}) : await takePendingManifest(actor);
  if (!opts.reroll) opts.eliteBoost = boost;
  let e = ePR;
  const hf = Number(boost.heartFire) || 0;
  if (hf > 0) {
    e += hf;
    lines.push(small(`Пламя Сердца: +${hf} к эPR (кубик уже брошен кнопкой Таланта, урон в T и S нанесён).`));
  }
  if (boost.overwhelming) {
    lines.push(small(`Мощь Переполняет: эPR ${e} ×2 = <b>${e * 2}</b>; Варп-Прорыв будет вызван сверх обычных Феноменов.`, "#a33"));
    e *= 2;
  }
  // Чародейский Посох: тип Физическое (кнопка Черты) и Good.Q/Best.Q посоха — к Порогу.
  // При перебросе opts.modifier уже несёт эти прибавки первой попытки.
  if (!opts.reroll) {
    const staffPhys = Number(boost.staff) || 0;
    const { bonus: staffQ, staff } = wizardStaffTestBonus(actor);
    const add = staffPhys + staffQ;
    if (add) {
      opts.modifier = (Number(opts.modifier) || 0) + add;
      lines.push(small(`Чародейский Посох: +${add} к психотесту${staffPhys ? ` (тип Физическое +${staffPhys}, не меньше полудействия)` : ""}${staffQ ? ` (${esc(staff.name)}, качество +${staffQ})` : ""} — в «Модификаторе».`));
    }
  }
  return e;
}

/** После броска психотеста: возможно, другой исход. */
export async function eliteManifestRoll(actor, item, opts, res, lines, rolls) {
  const out = opts.warpDance ? await warpDanceRoll(actor, res, lines, rolls) : { success: res.success, deg: res.deg };
  // Выпад Души (Кенетаи): Успехи попадания Выпадом — к Успехам силы со встречным тестом.
  const thrust = Math.max(0, Math.trunc(Number(opts.occultBlade?.thrust) || 0));
  if (thrust && out.success && item?.system?.resistChar) {
    out.deg += thrust;
    lines.push(small(`Выпад Души: +${thrust} Успехов попадания Выпадом → <b>${out.deg}</b> Успехов против встречного теста.`));
  }
  return out;
}

async function warpDanceRoll(actor, res, lines, rolls) {
  // Варп-Танцор: второй бросок — A вместо Характеристики силы, те же поправки Порога.
  const ag = Number(actor?.system?.characteristics?.ag?.total) || 0;
  const agThreshold = (Number(res.threshold) || 0) - (Number(res.charVal) || 0) + ag;
  const roll = await new Roll("1d100").evaluate();
  rolls.push(roll);
  const agRes = testOutcome(roll.total, agThreshold);
  const out = warpDanceOutcome({ success: res.success, deg: res.deg }, agRes);
  lines.push(small(`Варп-Танцор: сила получает тип <b>Физическое</b>; второй бросок A — ${roll.total} против ${agThreshold}: ${agRes.success ? "успех" : "провал"} (${agRes.deg}). Берётся худший: <b>${out.success ? `успех, ${out.deg}` : `провал, ${out.deg}`}</b>. Дубли на A Феноменов не вызывают.`));
  return out;
}

/**
 * Форма попаданий урона психосилы: { hits, pen, dmg, noTemplate, line }.
 * Оккультный Клинок — одно попадание по цели атаки без шаблона; с Фокусированным
 * Штормом лишние попадания Шторма/Обстрела — в Pen, радиус Взрыва и дальность
 * Дыхания — в Dmg.
 */
export function eliteShotShape(actor, item, opts, { shootType = "", hits = 1, blast = 0, damagePR = 0 } = {}) {
  if (!opts?.occultBlade) return { hits, pen: 0, dmg: 0, noTemplate: false, line: "" };
  const focused = hasFocusedStorm(actor);
  const rangeM = parseRangeMeters(item?.system?.range ?? "", damagePR) || 0;
  const shape = occultShotShape({ shootType, hits, blast, rangeM, focused });
  const extra = shape.pen ? ` Фокусированный Шторм: +${shape.pen} Pen (за ${hits - 1} несостоявшихся попаданий).`
    : shape.dmg ? ` Фокусированный Шторм: +${shape.dmg} Dmg (${shootType === "blast" ? `радиус ${blast} м` : `дальность ${rangeM} м`}).` : "";
  return { ...shape, line: small(`Оккультный Клинок: одно попадание по цели атаки, Избегать нельзя; шаблона нет.${extra}`, "#335") };
}

/** Прорыв сверх обычного (HTML) или "". */
export async function eliteExtraPeril(actor, opts, allRolls) {
  if (!opts?.eliteBoost?.overwhelming) return "";
  const perilRoll = await rollPeril(actor, allRolls);
  const peril = getPeril(perilRoll.total);
  return `
        <div class="psy-peril">
          <div class="psy-peril-header">💀 ВАРП-ПРОРЫВ! Мощь Переполняет (бросок ${perilRoll.total})${perilRoll.note}</div>
          <div class="psy-peril-name">${peril.label}</div>
          <div class="psy-peril-text">${peril.text}</div>
        </div>`;
}

/** Строки карточки после исхода (и побочные метки). */
export async function eliteManifestAfter(actor, item, opts, { success = false, ePR = 0, phenomena = false, perilTriggered = false } = {}) {
  const out = [];
  // Чернокнижник: Последнее Эхо после Жертвы, Маг-Каннибал прерывается Феноменом.
  out.push(...await warlockAfterManifest(actor, { path: opts.path || "", phenomena, perilTriggered, reroll: !!opts.reroll }));
  if (phenomena && hasMagusSupreme(actor)) {
    out.push(small("Высший Магус: этот Феномен (не Прорыв) <b>не действует на самого Архимага</b>, на остальных — как обычно. Исключить союзников (1 Очко Бесчестия) или перенести Прорыв (3 Очка) — кнопкой Черты.", "#5a4a30"));
  }
  // Соглашение Доблести (Кузнец Крови): проявление психосилы нарушает обет.
  if (!opts.reroll) {
    const { checkValourViolation } = await import("./valourous-accord.mjs");
    const ln = await checkValourViolation(actor, "psychic", item);
    if (ln) out.push(small(ln, "#8a1c1c"));
  }
  // Пуля Искатель (Питати): Mind Over Matter вплетён ради эффекта пули — эффект ждёт рунного выстрела.
  if (success && opts.seekerBullet != null && !opts.reroll) {
    const { armSeekerBullet } = await import("./pitati.mjs");
    const ln = await armSeekerBullet(actor, opts.seekerBullet);
    if (ln) out.push(small(ln, "#335"));
  }
    // Оккультный Клинок: отметка «раз в Раунд» (свободное действие уже не списало ОД).
  if (opts.occultBlade && !opts.reroll) await markOccultBladeUse(actor, opts.occultBlade.weaponUuid);
  // Клинки Братства: Психический Клинок — и на оружие связанных Общим Сознанием в радиусе, эPR вдвое меньше.
  if (success && item?.system?.powerType === "psychicBlade" && hasBladesOfBrotherhood(actor)) {
    const members = (actor.getFlag?.("warhammer-dbc", SHARED_MIND_FLAG)?.members ?? [])
      .map(u => { try { return fromUuidSync(u); } catch { return null; } }).filter(Boolean);
    const range = sharedMindRange(actor);
    const near = members.filter(m => { const d = actorsDistance(actor, m); return d == null || d <= range; });
    if (!opts.reroll && typeof item.setFlag === "function") {
      if (near.length) await item.setFlag("warhammer-dbc", BROTHERHOOD_FLAG, near.map(m => m.uuid));
      else if (item.getFlag?.("warhammer-dbc", BROTHERHOOD_FLAG)) await item.unsetFlag("warhammer-dbc", BROTHERHOOD_FLAG);
    }
    if (near.length) out.push(small(`Клинки Братства: «${esc(item.name)}» и на рукопашном оружии ${near.map(m => esc(m.name)).join(", ")} с эPR <b>${brotherhoodEpr(ePR)}</b> (½, окр.▲) — усиление клинка ложится на их оружие само, вдвое слабее. Пока сила поддерживается, она стоит тPR ещё раз (как отдельная сила) — уже в шапке.`, "#335"));
  }
  const ow = Number(opts?.eliteBoost?.overwhelming) || 0;
  if (ow && success && item?.system?.sustainable) {
    out.push(small(`Мощь Переполняет: если «${esc(item.name)}» поддерживается — она развеется сама через ${ow} Ходов (W.b).`, "#a33"));
  }
  return out;
}
