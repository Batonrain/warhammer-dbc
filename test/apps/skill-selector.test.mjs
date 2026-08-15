// test/apps/skill-selector.test.mjs
//
// Выбор навыка в двух конструкторах предмета: Механика (записи ВЫПОЛНЯЮТСЯ)
// и Требования (записи ПРОВЕРЯЮТСЯ). Оба предлагают один и тот же список —
// обычные и групповые навыки двумя optgroup, значение кодируется «scope:key».
//
// Собирались они порознь (wdbc-c4o), и разъехаться могли молча: новый навык,
// добавленный в SKILLS_DEF, попал бы в один конструктор и не попал в другой.
// Проверка сравнивает наборы, а не реализацию, поэтому переживает и сведение
// в общую функцию, и любую следующую перестановку.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { buildMechanicsTabHtml, buildRequirementsHtml } from "../../module/apps/mechanics.mjs";
import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../../module/constants/skills.mjs";

/** Предмет с одной группой в нужном флаге. */
const itemWith = (flagKey, entry) => ({
  getFlag: (_scope, key) => key === flagKey
    ? [{ id: "g1", operator: "AND", entries: [entry] }]
    : undefined
});

/** Значения <option> внутри <select class="…skillref">. */
function skillOptions(html, cls) {
  const select = html.match(new RegExp(`<select class="${cls}"[^>]*>([\\s\\S]*?)</select>`));
  expect(select, `нет <select class="${cls}"> в разметке`).not.toBeNull();
  return [...select[1].matchAll(/<option value="([^"]*)"/g)].map(m => m[1]).filter(Boolean);
}

const mechHtml = buildMechanicsTabHtml(
  itemWith("mechanics", { id: "e1", kind: "skill", skillScope: "plain", skillKey: "", rank: "untrained" }), true);

const reqHtml = buildRequirementsHtml(
  itemWith("req", { id: "e1", kind: "reqSkill", skillScope: "plain", skillKey: "", rank: "knows" }), "req", true);

describe("выбор навыка в конструкторах", () => {

  it("оба предлагают одни и те же навыки", () => {
    const mech = skillOptions(mechHtml, "grant-entry-skillref");
    const req  = skillOptions(reqHtml,  "req-skillref");

    expect(req).toEqual(mech);
  });

  it("предлагаются все навыки обоих видов", () => {
    const want = [
      ...Object.keys(SKILLS_DEF).map(k => `plain:${k}`),
      ...Object.keys(GROUP_SKILLS_DEF).map(k => `group:${k}`)
    ];

    expect(skillOptions(mechHtml, "grant-entry-skillref")).toEqual(want);
  });

  it("data-атрибуты у конструкторов свои", () => {
    // Требования правят набор групп по data-req, Механика — нет. Сведение в
    // общую функцию не должно стереть эту разницу: без data-req обработчик
    // не поймёт, какой набор требований менять.
    expect(reqHtml).toContain('data-req="req"');
    expect(mechHtml).not.toContain("data-req=");
  });
});
