// test/apps/requirements.test.mjs
//
// Движок Требований: условия-предпосылки, которые ПРОВЕРЯЮТСЯ на акторе (в
// отличие от Механики, записи которой ВЫПОЛНЯЮТСЯ). Заведён ради ритуалов
// (стр. 393-425: кто может проводить и кого брать в ассистенты), но ни к чему
// ритуальному не привязан.
//
// Логика чистая — ни Foundry, ни документов. Заглушка нужна только на импорт
// модуля.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { actorMeetsReq, checkRequirements, isReqComplete, describeReqEntry }
  from "../../module/apps/mechanics.mjs";

/** Требование заданного вида: недостающие поля добираются пустыми. */
const req = (kind, over = {}) => ({
  id: kind, kind,
  skillScope: "plain", skillKey: "", specKey: "", specialty: "", rank: "knows",
  sourceUuid: "", sourceName: "", sourceImg: "", sourceHasRating: false, rating: "",
  raceKey: "", archetypeName: "", patronKey: "",
  ...over
});

const group = (operator, ...entries) => ({ id: operator, operator, entries });

/** Актор с нужными полями; items — массив предметов. */
const actorOf = (system = {}, items = []) => ({
  system: { skills: {}, groupSkills: {}, ...system },
  items
});

describe("движок Требований", () => {

  describe("одно условие", () => {

    it("навык: ранг не ниже требуемого", () => {
      const a = actorOf({ skills: { awareness: { rank: "trained" } } });
      const need = r => req("reqSkill", { skillKey: "awareness", rank: r });

      expect(actorMeetsReq(a, need("knows"))).toBe(true);
      expect(actorMeetsReq(a, need("trained"))).toBe(true);
      expect(actorMeetsReq(a, need("veteran"))).toBe(false);
    });

    it("навыка нет вовсе — не выполнено", () => {
      expect(actorMeetsReq(actorOf(), req("reqSkill", { skillKey: "awareness" }))).toBe(false);
    });

    it("групповой навык: пустая специализация годится любая", () => {
      const a = actorOf({ groupSkills: { forbiddenLore: [{ specialty: "Daemons", rank: "trained" }] } });
      const need = spec => req("reqSkill",
        { skillScope: "group", skillKey: "forbiddenLore", specialty: spec, rank: "knows" });

      expect(actorMeetsReq(a, need(""))).toBe(true);
      expect(actorMeetsReq(a, need("Daemons"))).toBe(true);
      expect(actorMeetsReq(a, need("Warp"))).toBe(false);
    });

    it("групповой навык: ранг спрашивается у той же специализации", () => {
      // Ловушка: нужный ранг есть, но у ДРУГОЙ специализации.
      const a = actorOf({ groupSkills: { forbiddenLore: [
        { specialty: "Daemons", rank: "knows" },
        { specialty: "Warp",    rank: "expert" }
      ] } });

      expect(actorMeetsReq(a, req("reqSkill", {
        skillScope: "group", skillKey: "forbiddenLore", specialty: "Daemons", rank: "veteran"
      }))).toBe(false);
    });

    it("талант сверяется по имени, а не по документу", () => {
      // Перетащенный из компендиума образец и предмет на акторе — разные
      // документы, общее у них только name.
      const a = actorOf({}, [{ type: "talent", name: "Тёмная Душа", system: {} }]);

      expect(actorMeetsReq(a, req("reqTalent", { sourceName: "Тёмная Душа" }))).toBe(true);
      expect(actorMeetsReq(a, req("reqTalent", { sourceName: "Иное" }))).toBe(false);
      // Тип имеет значение: Черта с тем же именем Талантом не считается.
      expect(actorMeetsReq(a, req("reqTrait", { sourceName: "Тёмная Душа" }))).toBe(false);
    });

    it("черта с рейтингом: пустой рейтинг не важен, заданный — не ниже", () => {
      const a = actorOf({}, [{ type: "trait", name: "Нечистый", system: { rating: 3 } }]);

      expect(actorMeetsReq(a, req("reqTrait", { sourceName: "Нечистый", rating: "" }))).toBe(true);
      expect(actorMeetsReq(a, req("reqTrait", { sourceName: "Нечистый", rating: 3 }))).toBe(true);
      expect(actorMeetsReq(a, req("reqTrait", { sourceName: "Нечистый", rating: 5 }))).toBe(false);
    });

    it("раса, элитный архетип и покровительство", () => {
      const a = actorOf({
        race: "drukhari",
        eliteArchetype: "Ведьма",
        eliteArchetypesExtra: ["Суккуб"],
        patronGod: "slaanesh"
      });

      expect(actorMeetsReq(a, req("reqRace", { raceKey: "drukhari" }))).toBe(true);
      expect(actorMeetsReq(a, req("reqRace", { raceKey: "human" }))).toBe(false);
      // Архетип берётся и из основного поля, и из «дополнительных».
      expect(actorMeetsReq(a, req("reqArchetype", { archetypeName: "Ведьма" }))).toBe(true);
      expect(actorMeetsReq(a, req("reqArchetype", { archetypeName: "Суккуб" }))).toBe(true);
      expect(actorMeetsReq(a, req("reqArchetype", { archetypeName: "Укротитель" }))).toBe(false);
      expect(actorMeetsReq(a, req("reqPatron", { patronKey: "slaanesh" }))).toBe(true);
      expect(actorMeetsReq(a, req("reqPatron", { patronKey: "khorne" }))).toBe(false);
    });

    it("актора нет — не выполнено ничего", () => {
      expect(actorMeetsReq(null, req("reqRace", { raceKey: "human" }))).toBe(false);
    });
  });

  describe("заполненность", () => {
    it("незаполненное условие проверять нечего", () => {
      expect(isReqComplete(req("reqSkill"))).toBe(false);
      expect(isReqComplete(req("reqSkill", { skillKey: "awareness" }))).toBe(true);
      expect(isReqComplete(req("reqRace"))).toBe(false);
      expect(isReqComplete(req("reqRace", { raceKey: "human" }))).toBe(true);
    });

    it("описание незаполненного честно говорит, чего не хватает", () => {
      expect(describeReqEntry(req("reqRace"))).toContain("не выбрана");
      expect(describeReqEntry(req("reqTalent"))).toContain("перетащите");
    });
  });

  describe("группы", () => {
    const skill = (key, rank) => req("reqSkill", { skillKey: key, rank });
    const rich = actorOf({
      race: "human",
      skills: { awareness: { rank: "trained" }, charm: { rank: "untrained" } }
    });

    it("пустой список требований — годится любой", () => {
      expect(checkRequirements(rich, []).ok).toBe(true);
      expect(checkRequirements(rich, undefined).ok).toBe(true);
    });

    it("И-группа: нужны все записи", () => {
      expect(checkRequirements(rich, [group("AND", skill("awareness", "knows"))]).ok).toBe(true);
      expect(checkRequirements(rich, [
        group("AND", skill("awareness", "knows"), skill("charm", "trained"))
      ]).ok).toBe(false);
    });

    it("ИЛИ-группа: хватает одной", () => {
      const res = checkRequirements(rich, [
        group("OR", skill("charm", "trained"), skill("awareness", "knows"))
      ]);
      expect(res.ok).toBe(true);

      const bad = checkRequirements(rich, [
        group("OR", skill("charm", "trained"), skill("awareness", "expert"))
      ]);
      expect(bad.ok).toBe(false);
      expect(bad.failed[0]).toContain("одно из");
    });

    it("между группами всегда И", () => {
      const res = checkRequirements(rich, [
        group("AND", skill("awareness", "knows")),
        group("OR", skill("charm", "expert"))
      ]);
      expect(res.ok).toBe(false);
      expect(res.failed).toHaveLength(1);
    });

    it("незаполненные записи не роняют проверку", () => {
      // Группа из одних пустышек пропускается целиком, а не считается провалом.
      expect(checkRequirements(rich, [group("AND", req("reqSkill"))]).ok).toBe(true);
      // В смешанной группе спрашиваются только заполненные.
      expect(checkRequirements(rich, [
        group("AND", req("reqSkill"), skill("awareness", "knows"))
      ]).ok).toBe(true);
    });

    it("в отчёте о провале И-группы — только несданные условия", () => {
      const res = checkRequirements(rich, [
        group("AND", skill("awareness", "knows"), skill("charm", "veteran"))
      ]);
      expect(res.ok).toBe(false);
      expect(res.failed[0]).toContain("Обаяние");
      expect(res.failed[0]).not.toContain("Бдительность");
    });
  });
});
