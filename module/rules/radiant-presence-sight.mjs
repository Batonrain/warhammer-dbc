// module/rules/radiant-presence-sight.mjs
//
// Radiant Presence / Блистательное Присутствие — «видит» по геометрии сцены.
// Книга: «Все союзники, способные видеть или слышать персонажа, получают +10
// на тесты Морали, кроме вызванных самим персонажем.»
//
// «Союзник» здесь — по решению владельца (охват расширен 19.10.2026) носитель
// «Союзник или Нейтральный» по диспозиции токенов: не враг цели
// (regions/auras.mjs::tokenRelationship, всё, кроме "enemy").
//
// Чистая функция без обращения к canvas/game — сцену читает обвязка
// module/combat/radiant-presence.mjs. «Видит» — та же приближённая видимость,
// что у Вдохновляющего Присутствия и Иконы Богохульства (rules/vision-target.mjs:
// дальность и сектор обзора, без стен). «Слышит» не считается — его ставит
// стол галочкой руками.
//
// Файл НЕ подключается к rules/sources.mjs (vision-target тянет круг импортов,
// см. AGENTS.md → «Источники правил»): им пользуются только диалоги боя.

import { isTokenInSight } from "./vision-target.mjs";
import { tokenRelationship } from "../regions/auras.mjs";

/**
 * Носители Таланта, которых цель теста Морали видит.
 *
 * @param {object} p
 * @param {object[]} p.ownTokens   токены цели теста (TokenDocument-подобные: id, x, y, width, height, rotation, sight, disposition)
 * @param {{actorId:string, hasTalent:boolean, token:object}[]} p.candidates  все токены сцены с их владельцами
 * @param {{size:number, distance:number}} p.grid  scene.grid
 * @param {string|null} [p.sourceActorId]  источник самого теста («кроме вызванных самим персонажем»)
 * @returns {{actorId:string, hasTalent:boolean, token:object}[]}
 */
export function radiantHoldersInSight({ ownTokens, candidates, grid, sourceActorId = null } = {}) {
  const own = (ownTokens ?? []).filter(Boolean);
  if (!own.length) return [];
  const ownIds = new Set(own.map(t => t.id));
  return (candidates ?? []).filter(c => {
    const tok = c?.token;
    if (!c?.hasTalent || !tok || tok.hidden) return false;
    if (ownIds.has(tok.id)) return false;
    if (sourceActorId && c.actorId === sourceActorId) return false;
    return own.some(o => tokenRelationship(tok.disposition, o.disposition) !== "enemy" && isTokenInSight(o, tok, grid));
  });
}
