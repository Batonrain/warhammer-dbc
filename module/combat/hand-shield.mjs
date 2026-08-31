/**
 * РУЧНЫЕ ЩИТЫ (корбук стр. 215).
 *
 * Щит — это рукопашное оружие со свойством Defensive, которое ДОПОЛНИТЕЛЬНО
 * даёт AP на прикрываемые им зоны. В данных это поля `system.shieldAP` и
 * `system.shieldZones` (см. билдер M() в aeldari-weapons.mjs).
 *
 * Запись зон из книги: «Т+Р1+Р2+Н1+Н2+(Г)»
 *   Г  — голова          Т — торс
 *   Р1 — рука со щитом   Р2 — вторая рука
 *   Н1/Н2 — ноги
 * В скобках — зона прикрывается лишь ЧАСТИЧНО: чтобы её защитить, нужно
 * пригнуться/поднять щит, поэтому такие зоны включаются только по явному
 * выбору игрока (флаг `shieldRaised` на предмете), а не постоянно.
 * Косая черта «(Г)/(Н1+Н2)» — «или то, или другое» (Каплевидный щит).
 *
 * Сторона щита (какая рука «Р1») берётся из флага руки, куда он взят; если
 * неизвестна — считаем левую (щит обычно в неосновной руке).
 */

import { getHeldHand } from "../rules/hands.mjs";

// Ключи локаций брони системы.
const LOC = {
  head: "head", body: "body",
  leftArm: "leftArm", rightArm: "rightArm",
  leftLeg: "leftLeg", rightLeg: "rightLeg"
};

/** Все зоны — для «Всё тело» (Эльдарский Силовой Щит). */
const ALL_LOCS = Object.values(LOC);

/**
 * Разбирает строку зон в списки локаций.
 * @param {string} zones строка вида «Т+Р1+Р2+Н1+Н2+(Г)»
 * @param {"left"|"right"} shieldHand рука, в которой щит (для Р1/Р2)
 * @returns {{full:string[], partial:string[], variants:string[][]}}
 *   full — прикрыто всегда, partial — только при поднятом щите,
 *   variants — взаимоисключающие наборы («(Г)/(Н1+Н2)»).
 */
export function parseShieldZones(zones, shieldHand = "left") {
  const out = { full: [], partial: [], variants: [] };
  const src = String(zones || "").trim();
  if (!src) return out;

  const armSelf  = shieldHand === "right" ? LOC.rightArm : LOC.leftArm;
  const armOther = shieldHand === "right" ? LOC.leftArm  : LOC.rightArm;
  if (/^вс[её]/i.test(src)) { out.full = [...ALL_LOCS]; return out; }
  // «Как у стандартного» — зоны копируются у щита-донора, здесь пусто.
  if (/как у/i.test(src)) return out;

  const tokenToLoc = (t) => {
    const s = t.trim().toUpperCase();
    if (s === "Г") return LOC.head;
    if (s === "Т") return LOC.body;
    if (s === "Р1") return armSelf;
    if (s === "Р2") return armOther;
    if (s === "Н1") return LOC.leftLeg;
    if (s === "Н2") return LOC.rightLeg;
    return null;
  };

  // Вырезаем скобочные группы, попутно ловя «(A)/(B)» как варианты.
  const groups = [];
  const rest = src.replace(/\(([^)]*)\)(\s*\/\s*\((([^)]*))\))?/g, (_m, g1, _alt, g2) => {
    if (g2 != null) groups.push({ variant: [g1, g2] });
    else groups.push({ partial: g1 });
    return " ";
  });

  for (const t of rest.split(/[+\s/]+/)) {
    const l = tokenToLoc(t); if (l) out.full.push(l);
  }
  for (const g of groups) {
    if (g.partial != null) {
      for (const t of g.partial.split(/[+\s]+/)) { const l = tokenToLoc(t); if (l) out.partial.push(l); }
    } else {
      out.variants.push(g.variant.map(v =>
        v.split(/[+\s]+/).map(tokenToLoc).filter(Boolean)));
    }
  }
  // Дедупликация и очистка.
  out.full    = [...new Set(out.full)];
  out.partial = [...new Set(out.partial)].filter(l => !out.full.includes(l));
  return out;
}

/** Является ли предмет ручным щитом с механикой. */
export const isHandShield = (item) =>
  item?.type === "weapon" && item.system?.shieldAP != null;

/**
 * AP щитов по локациям для актора: берём ЭКИПИРОВАННЫЕ щиты.
 * Не складывается с бронёй, а берётся максимум по каждой локации (щит
 * прикрывает броню, а не суммируется с ней) — как и остальные источники AP.
 * @returns {Object} { head:0, body:0, ... }
 */
export function shieldArmorByLocation(actor) {
  const acc = { head: 0, body: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 };
  for (const item of actor.items) {
    if (!isHandShield(item) || !item.system.equipped) continue;
    const ap = Number(item.system.shieldAP) || 0;
    if (ap <= 0) continue;
    const hand   = getHeldHand(item) || "left";
    const raised = !!item.getFlag?.("warhammer-dbc", "shieldRaised");
    const z = parseShieldZones(item.system.shieldZones, hand);
    const locs = [...z.full];
    if (raised) {
      locs.push(...z.partial);
      // Из взаимоисключающих вариантов берём выбранный (по умолчанию первый).
      const pick = Number(item.getFlag?.("warhammer-dbc", "shieldVariant") ?? 0);
      for (const v of z.variants) locs.push(...(v[pick] || v[0] || []));
    }
    for (const l of locs) acc[l] = Math.max(acc[l] || 0, ap);
  }
  return acc;
}

/** Человекочитаемая сводка «что прикрывает» — для листа и подсказок. */
export function shieldCoverageLabel(item) {
  if (!isHandShield(item)) return "";
  const hand = getHeldHand(item) || "left";
  const z = parseShieldZones(item.system.shieldZones, hand);
  const RU = { head: "Голова", body: "Торс", leftArm: "Л.рука", rightArm: "П.рука",
               leftLeg: "Л.нога", rightLeg: "П.нога" };
  const f = z.full.map(l => RU[l]).join(", ");
  const p = z.partial.map(l => RU[l]).join(", ");
  const v = z.variants.map(pair => pair.map(set => set.map(l => RU[l]).join("+")).join(" / ")).join("; ");
  return [f, p ? `частично: ${p}` : "", v ? `на выбор: ${v}` : ""].filter(Boolean).join(" · ");
}
