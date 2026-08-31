// module/constants/scene-nexus.mjs
// ════════════════════════════════════════════════════════════════════════
//  Нексус Сцен — именованные ГРУППЫ сцен (галерея + перемещение токенов) и
//  ОБЩАЯ Завеса на группу. Одна сцена может входить в несколько групп.
//  • Группы хранятся в мир-настройке "sceneGroups" (только ГМ пишет).
//  • Завеса группы лежит в самой группе (g.veil) — общая для всех её сцен.
//  • Сцены-«переходы» помечаются флагом сцены warhammer-dbc.nexus.open —
//    только на такие сцены игрок может телепортировать токен.
//  Модуль — единый источник резолва Завесы: и окно «Завеса», и варп-оверлей
//  берут состояние отсюда (сначала группа, иначе — легаси-флаг сцены).
// ════════════════════════════════════════════════════════════════════════

import { defaultVeil } from "./veil.mjs";
import { defaultEnv, normalizeEnv } from "./environment.mjs";

export const NEXUS_SCOPE   = "warhammer-dbc";
export const GROUPS_KEY    = "sceneGroups";      // мир-настройка (Array)
export const SCENE_FLAG    = "nexus";            // флаг сцены { open, entry, label }
const VEIL_FLAG            = "veil";             // легаси-флаг Завесы на сцене

// ── Группы: чтение/запись настройки ───────────────────────────────────────
export function sceneGroups() {
  const raw = game.settings.get(NEXUS_SCOPE, GROUPS_KEY);
  return Array.isArray(raw) ? raw : [];
}
async function saveGroups(list) {
  if (!game.user.isGM) return;
  await game.settings.set(NEXUS_SCOPE, GROUPS_KEY, list);
}
// Клон для безопасной правки (настройки — по ссылке кэшируются).
function cloneGroups() { return foundry.utils.deepClone(sceneGroups()); }

export function getGroup(id) { return sceneGroups().find(g => g.id === id) || null; }
export function groupsForScene(sceneId) { return sceneGroups().filter(g => (g.sceneIds || []).includes(sceneId)); }
// Первичная группа сцены (для канвы/оверлея, когда сцена в нескольких группах).
export function primaryGroupForScene(sceneId) { return groupsForScene(sceneId)[0] || null; }

// ── CRUD групп (ГМ) ───────────────────────────────────────────────────────
export async function createGroup(name = "Новая группа") {
  const list = cloneGroups();
  const g = { id: foundry.utils.randomID(), name: String(name || "Группа").trim() || "Группа",
    color: "#4dffa6", sceneIds: [], subgroups: [], veil: defaultVeil(), env: defaultEnv(), order: list.length };
  list.push(g);
  await saveGroups(list);
  return g.id;
}
export async function renameGroup(id, name) {
  const list = cloneGroups(); const g = list.find(x => x.id === id); if (!g) return;
  g.name = String(name || "").trim() || g.name; await saveGroups(list);
}
export async function setGroupColor(id, color) {
  const list = cloneGroups(); const g = list.find(x => x.id === id); if (!g) return;
  g.color = color || "#4dffa6"; await saveGroups(list);
}
export async function deleteGroup(id) {
  await saveGroups(cloneGroups().filter(g => g.id !== id));
}
export async function moveGroup(id, dir) {
  const list = cloneGroups().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const i = list.findIndex(g => g.id === id); if (i < 0) return;
  const j = i + (dir < 0 ? -1 : 1); if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  list.forEach((g, k) => g.order = k);
  await saveGroups(list);
}
export async function addSceneToGroup(groupId, sceneId) {
  const list = cloneGroups(); const g = list.find(x => x.id === groupId); if (!g) return;
  g.sceneIds ||= [];
  if (!g.sceneIds.includes(sceneId)) g.sceneIds.push(sceneId);
  await saveGroups(list);
}
export async function removeSceneFromGroup(groupId, sceneId) {
  const list = cloneGroups(); const g = list.find(x => x.id === groupId); if (!g) return;
  g.sceneIds = (g.sceneIds || []).filter(s => s !== sceneId);
  for (const sg of (g.subgroups || [])) sg.sceneIds = (sg.sceneIds || []).filter(s => s !== sceneId);
  await saveGroups(list);
}

// ── Подгруппы внутри группы (визуальная организация сцен) ─────────────────
export async function createSubgroup(groupId, name = "Подгруппа") {
  const list = cloneGroups(); const g = list.find(x => x.id === groupId); if (!g) return;
  (g.subgroups ||= []).push({ id: foundry.utils.randomID(), name: String(name || "Подгруппа").trim() || "Подгруппа", sceneIds: [] });
  await saveGroups(list);
}
export async function renameSubgroup(groupId, subId, name) {
  const list = cloneGroups(); const sg = list.find(x => x.id === groupId)?.subgroups?.find(s => s.id === subId); if (!sg) return;
  sg.name = String(name || "").trim() || sg.name; await saveGroups(list);
}
export async function deleteSubgroup(groupId, subId) {
  const list = cloneGroups(); const g = list.find(x => x.id === groupId); if (!g) return;
  g.subgroups = (g.subgroups || []).filter(s => s.id !== subId);  // сцены возвращаются в общий список группы
  await saveGroups(list);
}
export async function assignSceneToSub(groupId, subId, sceneId) {
  const list = cloneGroups(); const g = list.find(x => x.id === groupId); if (!g) return;
  if (!(g.sceneIds || []).includes(sceneId)) (g.sceneIds ||= []).push(sceneId);
  for (const sg of (g.subgroups || [])) sg.sceneIds = (sg.sceneIds || []).filter(s => s !== sceneId);
  const target = (g.subgroups || []).find(s => s.id === subId);
  if (target) (target.sceneIds ||= []).push(sceneId);
  await saveGroups(list);
}
export async function unassignScene(groupId, sceneId) {
  const list = cloneGroups(); const g = list.find(x => x.id === groupId); if (!g) return;
  for (const sg of (g.subgroups || [])) sg.sceneIds = (sg.sceneIds || []).filter(s => s !== sceneId);
  await saveGroups(list);
}

// ── Флаг сцены-«перехода» ──────────────────────────────────────────────────
export function sceneNexus(scene) {
  const f = scene?.getFlag?.(NEXUS_SCOPE, SCENE_FLAG) || {};
  return { open: !!f.open, entry: f.entry || null, label: f.label || "" };
}

// ── Завеса: нормализация + резолв контейнера (группа → иначе сцена) ────────
export function normalizeVeil(raw) {
  const def = defaultVeil();
  if (!raw) return def;
  return {
    base:    Number(raw.base) || 0,
    manual:  Number(raw.manual) || 0,
    god:     raw.god || "",
    factors: { ...def.factors, ...(raw.factors || {}) },
    rituals: Array.isArray(raw.rituals) ? raw.rituals : [],
    log:     Array.isArray(raw.log) ? raw.log : []
  };
}

// Сохранить Завесу конкретной группы (ГМ).
export async function writeGroupVeil(groupId, veil) {
  const list = cloneGroups(); const g = list.find(x => x.id === groupId); if (!g) return;
  g.veil = veil; await saveGroups(list);
}

// Контейнер Завесы для сцены: { kind, id, label, read(), write(veil) }.
// Если сцена входит в группу — источник группа; иначе легаси-флаг сцены.
export function resolveVeilContainer(scene) {
  const g = scene ? primaryGroupForScene(scene.id) : null;
  if (g) return {
    kind: "group", id: g.id, label: g.name,
    read:  () => normalizeVeil(g.veil),
    write: (v) => writeGroupVeil(g.id, v)
  };
  return {
    kind: "scene", id: scene?.id || "", label: scene?.name || "",
    read:  () => normalizeVeil(scene?.getFlag?.(NEXUS_SCOPE, VEIL_FLAG)),
    write: (v) => scene?.setFlag?.(NEXUS_SCOPE, VEIL_FLAG, v)
  };
}

// Готовое состояние Завесы для сцены (для варп-оверлея у всех клиентов).
export function readVeilForScene(scene) { return resolveVeilContainer(scene).read(); }

export async function writeVeilForScene(scene, veil) {
  if (!scene) { ui.notifications?.warn("Завеса: нет активной сцены."); return; }
  if (!game.user.isGM) return;
  await resolveVeilContainer(scene).write(veil);
}

// Текущая сцена (канва или активная у ГМа) — общий помощник для окна Завесы
// и любого места, что сдвигает Завесу (провал ритуала, феномен, освящение).
export function currentScene() { return canvas?.scene ?? game.scenes?.current ?? null; }

// Публичный помощник: сдвинуть завесу текущей сцены (для феноменов/ритуалов).
// Живёт здесь (не в apps/veil.mjs), чтобы module/apps/ritual-cast.mjs мог
// звать его без циклического импорта apps/veil.mjs ⇄ apps/ritual-cast.mjs.
// Молча не срабатывает у не-ГМ: провёдший ритуал игрок должен слать
// сдвиг через сокет-релей (см. warhammer-dbc.mjs, action:"veilShift").
export async function veilShift(delta, note = "") {
  const scene = currentScene();
  if (!scene || !game.user.isGM) return;
  const v = readVeilForScene(scene);
  v.manual = (Number(v.manual) || 0) + Number(delta || 0);
  v.log = [{ delta: Number(delta || 0), note: String(note || "Сдвиг завесы"), time: Date.now() }, ...(v.log || [])].slice(0, 30);
  await writeVeilForScene(scene, v);
}

// ── Окружающая среда: тот же принцип (группа → иначе флаг сцены) ───────────
export async function writeGroupEnv(groupId, env) {
  const list = cloneGroups(); const g = list.find(x => x.id === groupId); if (!g) return;
  g.env = env; await saveGroups(list);
}
// У сцены есть собственное окружение (override), перекрывающее группу?
export function envSceneHasOverride(scene) { return !!scene?.getFlag?.(NEXUS_SCOPE, "env"); }

// target: "scene" — принудительно флаг сцены; "group" — окружение группы;
// "auto"/undefined (для чтения) — override сцены, если есть, иначе группа.
export function resolveEnvContainer(scene, target = "auto") {
  const g = scene ? primaryGroupForScene(scene.id) : null;
  const sceneC = {
    kind: "scene", id: scene?.id || "", label: scene?.name || "",
    read:  () => normalizeEnv(scene?.getFlag?.(NEXUS_SCOPE, "env")),
    write: (v) => scene?.setFlag?.(NEXUS_SCOPE, "env", v),
    clear: () => scene?.unsetFlag?.(NEXUS_SCOPE, "env")
  };
  const groupC = g ? {
    kind: "group", id: g.id, label: g.name,
    read:  () => normalizeEnv(g.env),
    write: (v) => writeGroupEnv(g.id, v)
  } : null;
  if (target === "scene") return sceneC;
  if (target === "group") return groupC || sceneC;
  // auto (чтение): override сцены важнее группы
  if (envSceneHasOverride(scene)) return sceneC;
  return groupC || sceneC;
}
export function readEnvForScene(scene) { return resolveEnvContainer(scene).read(); }
