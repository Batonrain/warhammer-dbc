// module/sheets/tabs/social.mjs
//
// Вкладка СОЦИУМ: всё, чем персонаж действует на других, в одном месте.
// Навыки со склонностью «Социальные», Таланты, Особенности (Черты и Мутации),
// Модификаторы (что правит социальные Навыки), Назначения (где он числится),
// Фракции, Миньоны и Отношения к другим акторам.
//
// Собирается из уже готовых данных: своих полей у вкладки одно —
// `system.relations`, остальное она только показывает.

import { SKILLS_DEF } from "../../constants/skills.mjs";
import { ITEM_TYPES } from "../../constants/items.mjs";
import { RELATION_SKILLS, RELATION_STEPS, relationLabel, relationStep,
         emptyRelationMods } from "../../constants/relations.mjs";
import { SOCIAL_SKILL_KEYS, socialEffectsOf, socialReasons } from "../../rules/social.mjs";
import { rootEl } from "../v2-helpers.mjs";

/** Акторы, к которым вообще бывают Отношения. */
export const RELATION_ACTOR_TYPES = ["character", "horde", "daemon", "demonPrince"];

// ── Модификаторы ─────────────────────────────────────────────────────────────

/** Плоское описание предмета для rules/social.mjs: правки эффектов и надбавки. */
function flattenItem(item) {
  const changes = [];
  for (const eff of item.effects ?? []) {
    if (eff.disabled) continue;
    for (const ch of eff.changes ?? []) changes.push({ key: ch.key, value: ch.value });
  }
  return { changes, charBonuses: item.system?.effects?.charBonuses ?? [] };
}

/** Предметы и эффекты актора, что правят социальное. */
function socialModifiers(actor) {
  const out = [];

  for (const item of actor.items ?? []) {
    const labels = socialEffectsOf(flattenItem(item));
    if (!labels.length) continue;
    out.push({
      id: item.id, uuid: item.uuid, name: item.name, img: item.img,
      kind: ITEM_TYPES[item.type] || item.type,
      effects: labels.join(" · ")
    });
  }

  // Эффекты, наложенные на самого актора (не от предмета): состояния, ауры.
  for (const eff of actor.effects ?? []) {
    if (eff.disabled || eff.parent !== actor) continue;
    const labels = socialEffectsOf({ changes: (eff.changes ?? []).map(c => ({ key: c.key, value: c.value })) });
    if (!labels.length) continue;
    out.push({
      id: eff.id, uuid: eff.uuid, name: eff.name, img: eff.img,
      kind: "Эффект", effects: labels.join(" · ")
    });
  }

  return out;
}

/** Текст правила предмета: у разных типов оно лежит в разных полях. */
function ruleText(item) {
  const s = item.system ?? {};
  return [s.benefit, s.effect, s.description, s.notes, s.summary].filter(Boolean).join(" ");
}

/**
 * Предметы заданных типов, что относятся к социальному. Причина попадания
 * показывается в строке: машинная правка («Обаяние +10») или упоминание в
 * тексте — чтобы игрок видел, почему Талант здесь.
 */
function socialItems(actor, types) {
  const out = [];
  for (const item of actor.items ?? []) {
    if (!types.includes(item.type)) continue;
    const reasons = socialReasons(flattenItem(item), ruleText(item));
    if (!reasons.length) continue;
    out.push({
      id: item.id, name: item.name, img: item.img,
      kind: ITEM_TYPES[item.type] || item.type,
      reasons: reasons.join(" · "),
      summary: ruleText(item)
    });
  }
  return out;
}

// ── Назначения ───────────────────────────────────────────────────────────────

/** Занят ли этим актором пост/место/строка состава. */
const holds = (entry, uuid) => entry && (entry.uuid === uuid || entry.actorUuid === uuid);

/**
 * Где актор числится: Отряды и Формирования (состав и посты), должности на
 * корабле и места в технике. Ищется по всем акторам мира — привязка хранится у
 * той стороны, к которой прицепили, а не у персонажа.
 */
function assignments(actor, actors = []) {
  const uuid = actor.uuid;
  const out  = [];
  const add  = (host, role) => out.push({
    uuid: host.uuid, name: host.name, img: host.img,
    kind: { squad: "Отряд", formation: "Формирование", ship: "Корабль", vehicle: "Техника" }[host.type] || host.type,
    role
  });

  for (const host of actors) {
    const s = host?.system ?? {};
    switch (host.type) {
      case "squad": {
        const post = Object.entries(s.posts ?? {}).find(([, p]) => holds(p, uuid));
        if (post) add(host, `Пост: ${post[0]}`);
        else if ((s.members ?? []).some(m => holds(m, uuid))) add(host, "В составе");
        break;
      }
      case "formation": {
        if (holds(s.posts?.commander, uuid)) add(host, "Командир");
        else if ((s.attached ?? []).some(m => holds(m, uuid))) add(host, "Придан");
        break;
      }
      case "ship": {
        const post = (s.crew?.posts ?? s.posts ?? []).find(p => holds(p, uuid));
        if (post) add(host, `Должность: ${post.role || post.name || "экипаж"}`);
        break;
      }
      case "vehicle": {
        const station = (s.stations ?? []).find(st => holds(st, uuid));
        if (station) add(host, `Место: ${station.role || station.label || "экипаж"}`);
        break;
      }
    }
  }
  return out;
}

// ── Отношения ────────────────────────────────────────────────────────────────

/**
 * Подпись типа актора. Словарь берётся из локализации; если он ещё не
 * загрузился (или тип старый), показываем сам тип, а не сырой ключ.
 */
function actorTypeLabel(type = "") {
  if (!type) return "";
  const key = `TYPES.Actor.${type}`;
  const out = game?.i18n?.localize?.(key) ?? key;
  return out === key ? type : out;
}

/** Записи Отношений с подписями из таблицы. */
function relationRows(actor) {
  const list = Array.isArray(actor.system?.relations) ? actor.system.relations : [];
  return list.map((rel, idx) => ({
    idx,
    uuid: rel.uuid || "",
    name: rel.name || "—",
    img:  rel.img || "icons/svg/mystery-man.svg",
    kind: actorTypeLabel(rel.type || rel.kind),
    note: rel.note || "",
    mods: RELATION_SKILLS.map(skill => {
      const value = Number(rel.mods?.[skill.key]) || 0;
      return {
        key: skill.key, label: skill.label, value: relationStep(value),
        title: relationLabel(skill.key, value),
        options: RELATION_STEPS.map(step => ({
          value: step,
          label: `${step > 0 ? "+" : ""}${step} — ${relationLabel(skill.key, step)}`,
          selected: step === relationStep(value)
        }))
      };
    })
  }));
}

/** Контекст вкладки. `actors` — мир целиком, нужен Назначениям. */
export function socialContext(actor, actors = []) {
  const system = actor.system ?? {};
  return {
    socialSkills: SOCIAL_SKILL_KEYS.map(key => ({
      key, label: SKILLS_DEF[key].label,
      char:  SKILLS_DEF[key].char,
      rank:  system.skills?.[key]?.rank ?? "untrained",
      total: system.skills?.[key]?.total ?? -20
    })),
    // Таланты и Особенности — только те, что вообще про социальное. У них
    // правило чаще всего словами, поэтому отбор идёт и по тексту: иначе сюда
    // сползал бы весь лист, включая «Меткий выстрел».
    socialTalents:  socialItems(actor, ["talent"]),
    socialFeatures: socialItems(actor, ["trait", "mutation"]),
    socialModifiers: socialModifiers(actor),
    socialAssignments: assignments(actor, actors),
    socialRelations: relationRows(actor),
    relationSkillCols: RELATION_SKILLS
  };
}

// ── Правка Отношений ─────────────────────────────────────────────────────────

const relationsOf = actor =>
  foundry.utils.deepClone(Array.isArray(actor.system?.relations) ? actor.system.relations : []);

/** Добавить актора в Отношения. Повтор не заводится — запись одна на актора. */
export async function addRelation(actor, target) {
  if (!target) return;
  if (!RELATION_ACTOR_TYPES.includes(target.type)) {
    return ui.notifications?.warn(
      "В Отношения переносятся Персонаж, Орда, Демон или Принц Демонов.");
  }
  if (target.uuid === actor.uuid) {
    return ui.notifications?.warn("Отношение к самому себе не заводится.");
  }
  const list = relationsOf(actor);
  if (list.some(r => r.uuid === target.uuid)) {
    return ui.notifications?.info(`«${target.name}» уже в списке Отношений.`);
  }
  // Тип храним как есть, а переводим при показе: подпись зависит от словаря, и
  // сохранённая застряла бы в данных — вместе с непереведённым ключом, если
  // словарь в этот момент ещё не загрузился.
  list.push({
    uuid: target.uuid, name: target.name, img: target.img, type: target.type,
    mods: emptyRelationMods(), note: ""
  });
  await actor.update({ "system.relations": list });
}

export async function removeRelation(actor, idx) {
  const list = relationsOf(actor);
  if (!list[idx]) return;
  list.splice(idx, 1);
  await actor.update({ "system.relations": list });
}

/** Правка одного модификатора записи (или заметки). */
export async function setRelationField(actor, idx, field, value) {
  const list = relationsOf(actor);
  const rel  = list[idx];
  if (!rel) return;
  if (field === "note") rel.note = String(value ?? "");
  else rel.mods = { ...emptyRelationMods(), ...rel.mods, [field]: relationStep(value) };
  await actor.update({ "system.relations": list });
}

// ── Обработчики вкладки ──────────────────────────────────────────────────────

/**
 * Слушатели СОЦИУМА. Своей разметки у вкладки хватает на один блок правок и
 * зону дропа; Фракции и Миньоны обслуживают свои модули — они те же самые,
 * что и в шапке и на «Записях».
 *
 * Принимает и корневой DOM-узел, и jQuery-обёртку — как и остальные вкладки.
 */
export function activateSocialListeners(root, actor, { editable = true } = {}) {
  const el = rootEl(root);
  if (!el?.querySelector) return;

  // Переходы: предмет актора и другой актор по uuid.
  el.querySelectorAll(".social-open-item").forEach(node =>
    node.addEventListener("click", () => {
      const byId = actor.items?.get(node.dataset.itemId);
      if (byId) return byId.sheet?.render(true);
      if (node.dataset.uuid) fromUuid(node.dataset.uuid).then(d => d?.sheet?.render(true)).catch(() => {});
    }));
  el.querySelectorAll(".social-open-actor").forEach(node =>
    node.addEventListener("click", () => {
      if (!node.dataset.uuid) return;
      fromUuid(node.dataset.uuid).then(d => d?.sheet?.render(true)).catch(() => {});
    }));

  if (!editable) return;

  // Отношения: модификатор, заметка, удаление.
  el.querySelectorAll(".social-relation-mod").forEach(node =>
    node.addEventListener("change", ev => setRelationField(
      actor, Number(node.dataset.index), node.dataset.skill, ev.currentTarget.value)));
  el.querySelectorAll(".social-relation-note").forEach(node =>
    node.addEventListener("change", ev => setRelationField(
      actor, Number(node.dataset.index), "note", ev.currentTarget.value)));
  el.querySelectorAll(".social-relation-remove").forEach(node =>
    node.addEventListener("click", () => removeRelation(actor, Number(node.dataset.index))));

  // Зона дропа: сюда переносят акторов из боковой панели или со сцены.
  const zone = el.querySelector(".social-relations-zone");
  if (!zone) return;
  zone.addEventListener("dragover", ev => { ev.preventDefault(); zone.classList.add("social-drop-hover"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("social-drop-hover"));
  zone.addEventListener("drop", async ev => {
    ev.preventDefault();
    ev.stopPropagation();
    zone.classList.remove("social-drop-hover");
    let data = null;
    try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch { /* не наш дроп */ }
    if (!data) return;
    // С боковой панели приходит Actor, со сцены — Token со своим актором.
    const doc = await fromUuid(data.uuid).catch(() => null);
    const target = doc?.documentName === "Token" ? doc.actor : doc;
    await addRelation(actor, target);
  });
}
