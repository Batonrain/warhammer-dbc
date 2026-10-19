// module/apps/gear-grant.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ВЫДАЧА СНАРЯЖЕНИЯ ПО ТЕКСТУ КНИГИ вне Мастера создания.
//
//  Общие куски выдачи, которыми пользуются и Мастер (apps/character-wizard.mjs,
//  Этап «Снаряжение»), и покупка Элитного Архетипа (apps/elite-buy.mjs):
//  индекс имён компендиумов снаряжения, поиск именной заявки и сборка
//  объектов предмета с Качеством/Легионом/количеством.
//
//  grantEliteGear — книга называет снаряжение Элитного Архетипа частью
//  стартового («Помимо стартового снаряжения от Расы, Архетипа и возможных
//  Элитных Архетипов…», стр. 24). Выдаётся то, что найдено в компендиумах по
//  имени; выборы из списка и ненайденное — шёпотом ГМу: Обозреватель посреди
//  покупки архетипа открывать незачем, а то, что нельзя выдать само, нельзя и
//  потерять молча.
// ════════════════════════════════════════════════════════════════════════════

import {
  splitGearTopLevel, gearChoiceOptions, parseGearEntry, describeGearSpec,
  namedLookupKeys, pickNamedCandidate, needsLegionProp, normName, compactKey
} from "../rules/creation-gear.mjs";
import { testCardHtml } from "../helpers/test-card.mjs";
import { esc } from "../helpers/utils.mjs";

/** Расходуемые типы — одним предметом с quantity, прочие — отдельными копиями. */
export const EQUIP_STACKABLE_TYPES = new Set(["weapon", "gear", "ammo", "drug", "tool"]);

/**
 * Паки, по именам которых ищется снаряжение. "traits" — в строке снаряжения
 * попадаются и Черты («Mechanicum Implants» Технодесантника); моды — для
 * надстроек «(+Mono)», «(+Pistol Grip)».
 */
export const GEAR_INDEX_PACKS = ["weapons", "armor", "gear", "ammunition", "shields", "tools", "armour-systems",
  "traits", "implants", "weapon-mods", "armor-mods"];

/**
 * Индекс имён компендиумов снаряжения: ключ (normName, по каждой половине
 * двуязычного имени, и слитный вариант) → кандидаты {pack, packId, id, name, folder}.
 * @returns {Promise<{index: Map<string, object[]>, folderNames: Map<string, string>}>}
 */
export async function buildGearIndex() {
  const index = new Map();
  const folderNames = new Map();
  for (const p of GEAR_INDEX_PACKS) {
    const pk = game.packs?.get?.(`warhammer-dbc.${p}`);
    if (!pk) continue;
    for (const f of pk.folders?.contents ?? []) folderNames.set(f.id, f.name);
    for (const e of await pk.getIndex()) {
      const folder = typeof e.folder === "string" ? e.folder : (e.folder?.id ?? null);
      for (const part of String(e.name).split("/")) {
        const k0 = normName(part);
        if (!k0) continue;
        for (const k of new Set([k0, compactKey(k0)])) {
          if (!index.has(k)) index.set(k, []);
          index.get(k).push({ pack: pk, packId: p, id: e._id, name: e.name, folder });
        }
      }
    }
  }
  return { index, folderNames };
}

/** Именная заявка → кандидат индекса (с учётом «L.» и гранат) или null. */
export function findGearNamed(spec, index) {
  if (!index) return null;
  for (const k of namedLookupKeys(spec)) {
    const c = index.get(k);
    if (c?.length) return pickNamedCandidate(c, spec);
  }
  return null;
}

/**
 * Объекты для создания на акторе из документа компендиума: Качество, Легион,
 * «Рунический» и количество. Расходуемые типы — одним предметом с quantity.
 */
export function gearObjects(doc, { quality = null, legion = false, runic = false, qty = 1 } = {}) {
  const make = () => {
    const obj = doc.toObject();
    const sys = obj.system ?? (obj.system = {});
    // Качество — поле system.quality (constants/quality.mjs); ставим только там,
    // где оно есть у типа, как и Конструктор (apps/mechanics.mjs).
    if (quality && quality !== "common" && "quality" in sys) sys.quality = quality;
    if (legion && obj.type === "weapon") {
      const props = Array.isArray(sys.weaponProps) ? sys.weaponProps : [];
      if (!props.some(p => p?.key === "legion")) props.push({ key: "legion" });
      sys.weaponProps = props;
    }
    if (runic && obj.type === "weapon") sys.daemonWeapon = { ...(sys.daemonWeapon || {}), runic: true };
    return obj;
  };
  const n = Math.max(1, Number(qty) || 1);
  if (n > 1 && EQUIP_STACKABLE_TYPES.has(doc.type)) {
    const obj = make();
    obj.system.quantity = (Number(obj.system.quantity) || 1) * n;
    return [obj];
  }
  return Array.from({ length: n }, make);
}

/**
 * Разложить текст снаряжения Элитного Архетипа на то, что выдаётся само, и то,
 * что остаётся ГМу. Без Foundry: индекс и «что уже на листе» приходят снаружи,
 * поэтому разбор проверяется тестом.
 *
 * @param {string}   text      system.gear архетипа
 * @param {object}   o
 * @param {(spec) => (object|null)} o.find  поиск именной заявки в индексе
 * @param {Set<string>} o.owned  normName имён, что уже лежат на листе
 * @returns {{grant: {spec: object, ref: object}[], skipped: string[], manual: string[]}}
 *   grant — именные заявки, найденные в компендиумах; skipped — уже на листе;
 *   manual — всё, что выдать само нельзя (выбор «или», категория, правило,
 *   ненайденное имя): строка для ГМа.
 */
export function planEliteGear(text, { find, owned = new Set() } = {}) {
  const grant = [], skipped = [], manual = [];
  const entries = String(text ?? "").trim() ? splitGearTopLevel(String(text)) : [];
  for (const entry of entries) {
    // Выбор между предметами — игрок решает сам, Обозреватель здесь не открываем.
    if (gearChoiceOptions(entry).length > 1) { manual.push(`выбрать: ${entry}`); continue; }
    for (const spec of parseGearEntry(entry)) {
      if (spec.kind === "named") {
        const key = normName(spec.name);
        if (key && owned.has(key)) { skipped.push(spec.raw || spec.name); continue; }
        const ref = find?.(spec) ?? null;
        if (ref) grant.push({ spec, ref });
        else manual.push(`не найдено в компендиумах: ${spec.raw || spec.name}`);
      } else if (spec.kind === "rule") {
        // «+N очков снаряжения» и прочие правила Мастера к покупке Элитного
        // архетипа отношения не имеют — пула Очков у персонажа уже нет.
        manual.push(`правило: ${spec.raw || describeGearSpec(spec)}`);
      } else {
        manual.push(describeGearSpec(spec) ? `${spec.raw}: ${describeGearSpec(spec)}` : String(spec.raw || entry));
      }
    }
  }
  return { grant, skipped, manual };
}

/** У архетипа есть записи Конструктора «Снаряжение» — их выдаёт Механика, текст не дублируем. */
export function hasEquipmentMechanics(doc) {
  const mech = doc?.flags?.["warhammer-dbc"]?.mechanics ?? doc?.getFlag?.("warhammer-dbc", "mechanics");
  return Array.isArray(mech) && mech.some(g => (g?.entries ?? []).some(e => e?.kind === "equipment"));
}

/**
 * Выдать снаряжение купленного Элитного Архетипа.
 * @param {Actor} actor
 * @param {Item}  doc    документ архетипа из компендиума (там лежит system.gear)
 * @returns {Promise<{granted: string[], manual: string[]}>}
 */
export async function grantEliteGear(actor, doc) {
  const text = String(doc?.system?.gear ?? "").trim();
  if (!actor || !text) return { granted: [], manual: [] };
  // Механика архетипа уже выдаёт своё снаряжение — второй раз по тексту не даём.
  if (hasEquipmentMechanics(doc)) return { granted: [], manual: [] };

  const { index } = await buildGearIndex();
  const owned = new Set();
  for (const it of actor.items ?? []) for (const part of String(it.name).split("/")) {
    const k = normName(part.trim()); if (k) owned.add(k);
  }
  const plan = planEliteGear(text, { find: spec => findGearNamed(spec, index), owned });

  const granted = [];
  const grantedKeys = new Set();
  for (const { spec, ref } of plan.grant) {
    const key = normName(spec.name);
    if (grantedKeys.has(key)) continue;
    const gdoc = await ref.pack.getDocument(ref.id);
    if (!gdoc) { plan.manual.push(`не найдено в компендиумах: ${spec.raw || spec.name}`); continue; }
    grantedKeys.add(key);
    const objs = gearObjects(gdoc, { quality: spec.quality, legion: needsLegionProp(spec, gdoc.name), qty: spec.count });
    await actor.createEmbeddedDocuments("Item", objs);
    granted.push(spec.quality && spec.quality !== "common" ? `${gdoc.name} (${spec.quality})` : gdoc.name);
  }

  if (granted.length || plan.manual.length) {
    const li = (mark, s) => `<li>${mark} ${esc(s)}</li>`;
    ChatMessage.create({
      content: testCardHtml({
        title: `🎒 Снаряжение Элитного Архетипа «${esc(doc.name)}» — ${esc(actor.name)}`,
        lines: [
          `<ul style="margin:4px 0;padding-left:16px;font-size:.9em;">${
            [...granted.map(s => li("✓", s)), ...plan.manual.map(s => li("▫", s))].join("")}</ul>`,
          `<div style="font-size:.8em;opacity:.7;margin-top:4px;">✓ — добавлено на лист. ▫ — выдать вручную: выбор «или», категория из списка или нет в компендиумах.</div>`
        ]
      }),
      whisper: ChatMessage.getWhisperRecipients?.("GM") || [],
      speaker: { alias: actor.name }
    });
  }
  return { granted, manual: plan.manual };
}
