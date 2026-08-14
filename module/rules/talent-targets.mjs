// module/rules/talent-targets.mjs
//
// Цели Таланта — против кого он работает: Hatred, Peer, Enemy, Good Reputation.
// Здесь только форма записи и её сборка; проверка «подходит ли цель броска»
// живёт в предикатах (module/rules/predicates.mjs) и опирается на дерево
// фракций (module/rules/factions.mjs).
//
// Целей у одного Таланта может быть несколько, и они разной природы: книга
// пишет «Hatred (Dark Mechanicum, Adeptus Mechanicus, Vehicles)» одной
// записью, где два первых — фракции, а третье вообще не фракция, а тип
// актора. Поэтому цель это не ссылка, а помеченный вид.
//
// Foundry здесь не нужен: на вход идут либо литералы, либо уже прочитанные
// поля документа, и всё проверяется тестом без заглушки.

import { isSameOrDescendant, anySameOrDescendant, actorFactionKeys, getFactionIndex }
  from "./factions.mjs";

/** Виды цели и их подписи для интерфейса. */
export const TARGET_KINDS = {
  faction:   "Фракция",
  actorType: "Тип существа",
  all:       "Все!"
};

/** Пустая цель нужного вида — остальные поля добираются ниже. */
const blank = kind => ({ kind, ref: "", value: "", name: "", img: "" });

/**
 * Цель-фракция из предмета фракции (документ Foundry либо литерал теста).
 * Ключ — то, чем фракция названа в дереве; подпись и значок запоминаются на
 * момент выбора, чтобы лист не загружал предмет ради имени.
 *
 * @returns {?object} null, если у фракции нет ключа: ссылаться не на что.
 */
export function factionTarget(faction) {
  const ref = String(faction?.system?.key ?? faction?.key ?? "").trim();
  if (!ref) return null;
  return {
    ...blank("faction"),
    ref,
    name: String(faction?.name ?? ref),
    img:  String(faction?.img ?? "")
  };
}

/** Цель-тип актора: техника фракцией не является и деревом не описывается. */
export function actorTypeTarget(type, label = "") {
  const value = String(type ?? "").trim();
  if (!value) return null;
  return { ...blank("actorType"), value, name: String(label || value) };
}

/** «Все!» — вариант Hatred без разбора, кого именно. */
export function allTarget() {
  return { ...blank("all"), name: TARGET_KINDS.all };
}

/** Одна и та же цель? Сравнение по сути, а не по подписи: имя правится в UI. */
export function sameTarget(a, b) {
  if (a?.kind !== b?.kind) return false;
  if (a.kind === "faction")   return a.ref === b.ref;
  if (a.kind === "actorType") return a.value === b.value;
  return true;                       // «Все!» бывает только одно
}

/**
 * Добавляет цель, не плодя повторов. Повтор — не ошибка данных, а обычный
 * промах мышью, поэтому молча возвращаем список как есть.
 *
 * @returns {object[]} НОВЫЙ список: исходный не меняется.
 */
export function addTarget(targets = [], target) {
  if (!target) return [...targets];
  if (targets.some(t => sameTarget(t, target))) return [...targets];
  return [...targets, target];
}

/** Убирает цель по номеру. Номер вне списка ничего не меняет. */
export function removeTargetAt(targets = [], index) {
  const i = Number(index);
  if (!Number.isInteger(i) || i < 0 || i >= targets.length) return [...targets];
  return targets.filter((_, n) => n !== i);
}

/** Подпись цели для листа и чата. */
export function targetLabel(target) {
  if (!target) return "";
  if (target.kind === "all") return TARGET_KINDS.all;
  return target.name || target.ref || target.value || "?";
}

/** Ключи фракций среди целей — то, с чем работает дерево на отборе. */
export function factionRefs(targets = []) {
  return targets.filter(t => t?.kind === "faction").map(t => t.ref).filter(Boolean);
}

/**
 * Подходит ли цель Таланта к текущему броску.
 *
 * У фракции два пути, и они не пересекаются:
 *
 *   в бою цель — это выделенный токен, и его фракции лежат предметами на
 *   акторе (ctx.targetActor);
 *   в социальном тесте токена нет вовсе — «Инквизицию» не выделишь мышью, —
 *   поэтому игрок выбирает фракцию собеседника в диалоге, и она приезжает в
 *   ctx.socialFaction одним ключом.
 *
 * Отбор односторонний, как и всё дерево: Ненависть к Хаосу срабатывает на роту
 * в его составе, Ненависть к роте на весь Хаос — нет.
 *
 * @param {object} target  запись из system.targets Таланта
 * @param {object} ctx     контекст броска (rules/resolve-test.mjs)
 * @param {Map}    byKey   дерево фракций; по умолчанию — реестр
 */
export function targetMatches(target, ctx = {}, byKey = getFactionIndex()) {
  if (!target) return false;
  if (target.kind === "all") return true;
  if (target.kind === "actorType") return ctx?.targetActor?.type === target.value;
  if (target.kind !== "faction") return false;

  if (ctx?.socialFaction) return isSameOrDescendant(ctx.socialFaction, target.ref, byKey);
  return anySameOrDescendant(actorFactionKeys(ctx?.targetActor), target.ref, byKey);
}

/** Сработала ли хоть одна цель Таланта: цели в списке соединены через «или». */
export function anyTargetMatches(targets = [], ctx = {}, byKey = getFactionIndex()) {
  return targets.some(t => targetMatches(t, ctx, byKey));
}
