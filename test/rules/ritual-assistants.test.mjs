// test/rules/ritual-assistants.test.mjs
//
// Sahara fallbacks-instructor (дизайн согласован 19.10.2026): ассистенты ритуала —
// список именованных акторов с ролью «основной / запасной». Чистая логика, без
// Foundry: проверка годности по assistReq, Инструктор (−1 ранг Навыков), Запасные
// Планы (потолок ½ I.b, замена выбывшего). Саму проверку требований сюда
// передаёт вызывающий (apps/mechanics.mjs::checkRequirements) — здесь она
// подставлена настоящая, чтобы тест ловил расхождение с боевой.

import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import { checkRequirements } from "../../module/apps/mechanics.mjs";
import {
  ROLE_PRIMARY, ROLE_RESERVE,
  maxReserveAssistants, lowerSkillRank, loweredReqGroups, assistantQualifies,
  ritualAssistantRejection, addAssistant, removeAssistant, setAssistantRole,
  setAssistantSacrificed, evaluateAssistants, tallyAssistants, reserveVictims
} from "../../module/rules/ritual-assistants.mjs";

/** Подставной актор: только то, что читает actorMeetsReq для reqSkill. */
const person = (uuid, { skills = {}, groupSkills = {}, intBonus = 0 } = {}) => ({
  uuid, id: uuid, name: uuid,
  system: { skills, groupSkills, characteristics: { int: { total: intBonus * 10 + 5, bonus: intBonus } } }
});
const skillReq = (skillKey, rank) => ({
  id: `e-${skillKey}`, kind: "reqSkill", skillScope: "plain", skillKey, specKey: "", specialty: "", rank
});
const groupReq = (skillKey, specKey, rank) => ({
  id: `e-${skillKey}`, kind: "reqSkill", skillScope: "group", skillKey, specKey, specialty: "", rank
});
const grp = (operator, ...entries) => ({ id: `g-${operator}`, operator, entries });
const check = checkRequirements;

describe("Запасные Планы: потолок запасных (maxReserveAssistants)", () => {
  // [книга] «до ½ I.b (окр.▲)»
  it("½ бонуса Интеллекта с округлением вверх", () => {
    expect(maxReserveAssistants(person("a", { intBonus: 4 }))).toBe(2);
    expect(maxReserveAssistants(person("a", { intBonus: 5 }))).toBe(3);
    expect(maxReserveAssistants(person("a", { intBonus: 1 }))).toBe(1);
  });
  it("нет бонуса / нет актора — 0, не NaN", () => {
    expect(maxReserveAssistants(person("a", { intBonus: 0 }))).toBe(0);
    expect(maxReserveAssistants({ system: {} })).toBe(0);
    expect(maxReserveAssistants(null)).toBe(0);
  });
});

describe("Инструктор: снижение ранга (lowerSkillRank)", () => {
  it("на один ранг вниз, пол — Нетренированное", () => {
    expect(lowerSkillRank("expert")).toBe("veteran");
    expect(lowerSkillRank("veteran")).toBe("trained");
    expect(lowerSkillRank("trained")).toBe("knows");
    expect(lowerSkillRank("knows")).toBe("untrained");
    expect(lowerSkillRank("untrained")).toBe("untrained");
    expect(lowerSkillRank(undefined)).toBe("untrained");
  });
});

describe("Инструктор: требования к ассистентам (loweredReqGroups)", () => {
  it("ранг Навыка падает на ступень, остальное не трогается", () => {
    const groups = [grp("AND", skillReq("medicae", "trained"), { id: "r", kind: "reqRace", raceKey: "human" })];
    const out = loweredReqGroups(groups);
    expect(out[0].entries[0].rank).toBe("knows");
    expect(out[0].entries[1]).toEqual(groups[0].entries[1]);
  });

  it("не меняет исходные группы (флаг предмета нельзя мутировать)", () => {
    const groups = [grp("AND", skillReq("medicae", "trained"))];
    const before = JSON.stringify(groups);
    loweredReqGroups(groups);
    expect(JSON.stringify(groups)).toBe(before);
  });

  // [книга] «убирая требование в навыках на +0» — «Знает» уходит совсем.
  it("требование «Знает» снимается вовсе (в И-группе запись удаляется)", () => {
    const out = loweredReqGroups([grp("AND", skillReq("medicae", "knows"), skillReq("tech", "trained"))]);
    expect(out[0].entries.map(e => e.skillKey)).toEqual(["tech"]);
    expect(out[0].entries[0].rank).toBe("knows");
  });

  it("И-группа из одних снятых записей исчезает", () => {
    expect(loweredReqGroups([grp("AND", skillReq("medicae", "knows"))])).toEqual([]);
  });

  // Ловушка: просто выкинуть запись из ИЛИ-группы значит СУЖАТЬ выбор. Снятая
  // альтернатива делает всю группу выполненной.
  it("ИЛИ-группа со снятой альтернативой выполнена целиком", () => {
    const out = loweredReqGroups([grp("OR", skillReq("medicae", "knows"), skillReq("tech", "veteran"))]);
    expect(out).toEqual([]);
  });

  it("групповой Навык «Знает» тоже снимается — у актора может не быть записи группы вовсе", () => {
    const groups = [grp("AND", groupReq("scholasticLore", "occult", "knows"))];
    const nobody = person("nobody");
    expect(check(nobody, groups).ok).toBe(false);
    expect(check(nobody, loweredReqGroups(groups)).ok).toBe(true);
  });

  it("пустой / неопределённый список — пустой список", () => {
    expect(loweredReqGroups(undefined)).toEqual([]);
    expect(loweredReqGroups([])).toEqual([]);
  });
});

describe("годность ассистента (assistantQualifies)", () => {
  const groups = [grp("AND", skillReq("medicae", "trained"))];
  const knowsMedicae = person("k", { skills: { medicae: { rank: "knows" } } });
  const trainedMedicae = person("t", { skills: { medicae: { rank: "trained" } } });

  it("без Инструктора — по книжному assistReq", () => {
    expect(assistantQualifies(trainedMedicae, groups, { check }).ok).toBe(true);
    const r = assistantQualifies(knowsMedicae, groups, { check });
    expect(r.ok).toBe(false);
    expect(r.failed[0]).toContain("Тренированное");
  });

  it("с подготовкой Инструктора — требование на ступень ниже", () => {
    expect(assistantQualifies(knowsMedicae, groups, { check, instructorPrepared: true }).ok).toBe(true);
  });

  it("Инструктор не делает пригодным совсем несведущего (ниже ступени)", () => {
    const novice = person("n", { skills: { medicae: { rank: "untrained" } } });
    expect(assistantQualifies(novice, groups, { check, instructorPrepared: true }).ok).toBe(false);
  });

  it("требований к ассистентам нет — годится любой", () => {
    expect(assistantQualifies(person("z"), [], { check }).ok).toBe(true);
    expect(assistantQualifies(person("z"), undefined, { check }).ok).toBe(true);
  });
});

describe("состав списка", () => {
  const boss = person("boss");
  const cand = (uuid, name = uuid) => ({ uuid, id: uuid, name, system: {} });

  it("отказ: нет актора / сам ритуалист / дубль", () => {
    expect(ritualAssistantRejection(null, { ritualist: boss, list: [] })).toMatch(/перетащили/);
    expect(ritualAssistantRejection(cand("boss"), { ritualist: boss, list: [] })).toMatch(/самому себе/);
    const list = addAssistant([], cand("a", "Ада"));
    expect(ritualAssistantRejection(cand("a", "Ада"), { ritualist: boss, list })).toMatch(/уже в списке/);
    expect(ritualAssistantRejection(cand("b"), { ritualist: boss, list })).toBeNull();
  });

  // Несвязанный токен: id совпадает с мировым образцом, uuid разные — это другая фигура.
  it("другая фигура того же образца (тот же id, другой uuid) — не сам ритуалист", () => {
    const token = { uuid: "Scene.s.Token.t.Actor.x", id: "x", name: "Культист" };
    const other = { uuid: "Actor.x", id: "x", name: "Культист" };
    expect(ritualAssistantRejection(other, { ritualist: token, list: [] })).toBeNull();
  });

  it("новый ассистент — основной, без жертвы", () => {
    const list = addAssistant([], cand("a", "Ада"));
    expect(list).toEqual([expect.objectContaining({ uuid: "a", name: "Ада", role: ROLE_PRIMARY, sacrificed: false })]);
  });

  it("удаление убирает строку", () => {
    const list = removeAssistant(addAssistant(addAssistant([], cand("a")), cand("b")), "a");
    expect(list.map(r => r.uuid)).toEqual(["b"]);
  });

  it("жертва ставится только основному, у запасного — игнорируется", () => {
    let list = addAssistant(addAssistant([], cand("a")), cand("b"));
    list = setAssistantRole(list, "b", ROLE_RESERVE, { fallbacks: true, reserveMax: 2 }).list;
    list = setAssistantSacrificed(list, "a", true);
    list = setAssistantSacrificed(list, "b", true);
    expect(list.find(r => r.uuid === "a").sacrificed).toBe(true);
    expect(list.find(r => r.uuid === "b").sacrificed).toBe(false);
  });
});

describe("смена роли (setAssistantRole)", () => {
  const cand = uuid => ({ uuid, id: uuid, name: uuid, system: {} });
  const three = () => ["a", "b", "c"].reduce((l, u) => addAssistant(l, cand(u)), []);

  it("запасным нельзя без Запасных Планов", () => {
    const r = setAssistantRole(three(), "a", ROLE_RESERVE, { fallbacks: false, reserveMax: 5 });
    expect(r.ok).toBe(false);
    expect(r.why).toMatch(/Запасные Планы/);
    expect(r.list.find(x => x.uuid === "a").role).toBe(ROLE_PRIMARY);
  });

  it("запасных не больше ½ I.b", () => {
    let list = three();
    list = setAssistantRole(list, "a", ROLE_RESERVE, { fallbacks: true, reserveMax: 1 }).list;
    const r = setAssistantRole(list, "b", ROLE_RESERVE, { fallbacks: true, reserveMax: 1 });
    expect(r.ok).toBe(false);
    expect(r.why).toMatch(/не больше 1/);
  });

  it("в запасные уходит без жертвы: бонуса у запасного нет", () => {
    let list = setAssistantSacrificed(three(), "a", true);
    list = setAssistantRole(list, "a", ROLE_RESERVE, { fallbacks: true, reserveMax: 2 }).list;
    expect(list.find(x => x.uuid === "a")).toMatchObject({ role: ROLE_RESERVE, sacrificed: false });
  });

  it("запасной заменяет выбывшего: становится основным", () => {
    let list = setAssistantRole(three(), "c", ROLE_RESERVE, { fallbacks: true, reserveMax: 2 }).list;
    list = removeAssistant(list, "a"); // выбыл
    const r = setAssistantRole(list, "c", ROLE_PRIMARY, { fallbacks: true, reserveMax: 2, qualifies: true });
    expect(r.ok).toBe(true);
    expect(r.list.find(x => x.uuid === "c").role).toBe(ROLE_PRIMARY);
  });

  it("негодный запасной основным не становится", () => {
    const list = setAssistantRole(three(), "c", ROLE_RESERVE, { fallbacks: true, reserveMax: 2 }).list;
    const r = setAssistantRole(list, "c", ROLE_PRIMARY, { fallbacks: true, reserveMax: 2, qualifies: false });
    expect(r.ok).toBe(false);
    expect(r.list.find(x => x.uuid === "c").role).toBe(ROLE_RESERVE);
  });

  it("неизвестный uuid — отказ, список прежний", () => {
    const list = three();
    const r = setAssistantRole(list, "zzz", ROLE_RESERVE, { fallbacks: true, reserveMax: 2 });
    expect(r.ok).toBe(false);
    expect(r.list).toBe(list);
  });
});

describe("оценка списка (evaluateAssistants / tallyAssistants / reserveVictims)", () => {
  const groups = [grp("AND", skillReq("medicae", "trained"))];
  const actorOf = new Map([
    ["good", person("good", { skills: { medicae: { rank: "trained" } } })],
    ["weak", person("weak", { skills: { medicae: { rank: "knows" } } })],
    ["res", person("res", { skills: { medicae: { rank: "veteran" } } })]
  ]);
  const row = (uuid, over = {}) => ({ uuid, name: uuid, role: ROLE_PRIMARY, sacrificed: false, actor: actorOf.get(uuid), ...over });

  it("негодный основной помечен и причина названа", () => {
    const rows = evaluateAssistants([row("good"), row("weak")], groups, { check });
    expect(rows.find(r => r.uuid === "good").ok).toBe(true);
    const weak = rows.find(r => r.uuid === "weak");
    expect(weak.ok).toBe(false);
    expect(weak.failed.length).toBeGreaterThan(0);
  });

  it("Инструктор переоценивает весь список", () => {
    const rows = evaluateAssistants([row("weak")], groups, { check, instructorPrepared: true });
    expect(rows[0].ok).toBe(true);
  });

  it("жертва негодного НЕ идёт в счёт (блокируется от броска)", () => {
    const rows = evaluateAssistants(
      [row("good", { sacrificed: true }), row("weak", { sacrificed: true })], groups, { check });
    expect(tallyAssistants(rows)).toMatchObject({ primary: 1, blocked: 1, sacrificed: 1 });
  });

  it("запасной бонуса не даёт даже с отметкой жертвы", () => {
    const rows = evaluateAssistants(
      [row("good", { sacrificed: true }), row("res", { role: ROLE_RESERVE, sacrificed: true })], groups, { check });
    expect(tallyAssistants(rows)).toMatchObject({ primary: 1, reserve: 1, sacrificed: 1 });
  });

  it("жертвой запасного по Запасным Планам годится только пригодный запасной", () => {
    const rows = evaluateAssistants(
      [row("good"), row("res", { role: ROLE_RESERVE }), row("weak", { role: ROLE_RESERVE })], groups, { check });
    expect(reserveVictims(rows).map(r => r.uuid)).toEqual(["res"]);
  });

  it("строка без разрешённого актора считается негодной, а не падает", () => {
    const rows = evaluateAssistants([{ uuid: "ghost", name: "ghost", role: ROLE_PRIMARY, sacrificed: true }], groups, { check });
    expect(rows[0].ok).toBe(false);
    expect(tallyAssistants(rows).sacrificed).toBe(0);
  });

  it("пустой список — нули", () => {
    expect(tallyAssistants(evaluateAssistants(undefined, groups, { check })))
      .toEqual({ primary: 0, reserve: 0, blocked: 0, sacrificed: 0 });
  });
});
