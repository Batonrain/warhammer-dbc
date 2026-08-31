// test/rules/req-atom-cross-engine-snapshot.test.mjs
//
// wdbc-0pki: три движка Требований (mechanics.mjs, elite-requirements.mjs,
// talent-requirements.mjs) проверяют «удовлетворяет ли актор требованию»
// независимо друг от друга. Этот файл — снимок их ТЕКУЩЕГО (до общего слоя)
// поведения на одном каноническом акторе.
//
// Снимок НЕ утверждает, что три движка сегодня согласны друг с другом — часть
// кейсов ниже (раздел «расхождения») специально фиксирует случаи, где один и
// тот же физический факт («у актора есть Frenzy») читается по-разному. Это и
// есть суть тикета: «нужен WS 40» может дать разный вердикт в трёх местах.
// Цель файла — регресс-сеть для будущего рефакторинга («общий слой проверки
// атома, три формата хранения остаются адаптерами»): после правки каждый
// ассерт здесь либо остаётся зелёным (поведение атома не поменялось), либо
// меняется осознанно одной строкой (поведение унифицировано намеренно) — но
// не расползается тихо.
//
// Один актор Foundry-формата (system.characteristics/.../items) кормит
// mechanics.mjs и talent-requirements.mjs напрямую — оба читают одну и ту же
// форму. elite-requirements.mjs получает его через штатный адаптер eliteWho().

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { actorMeetsReq } from "../../module/apps/mechanics.mjs";
import { checkEliteRequirements, eliteWho, blankEliteReq, REQ_KINDS }
  from "../../module/rules/elite-requirements.mjs";
import { checkRequirement } from "../../module/constants/talent-requirements.mjs";

/** Требование для mechanics.mjs: недостающие поля добираются пустыми, как в blankReqEntry(). */
const mechReq = (kind, over = {}) => ({
  id: kind, kind,
  skillScope: "plain", skillKey: "", specKey: "", specialty: "", rank: "knows",
  sourceUuid: "", sourceName: "", sourceImg: "", sourceHasRating: false, rating: "",
  raceKey: "", archetypeName: "", patronKey: "",
  statKey: "", statThreshold: "",
  ...over
});

/** Требование для elite-requirements.mjs: один атом в обязательном блоке. */
const eliteReq = entry => ({ ...blankEliteReq(), primary: [entry] });

/** Канонический актор — тот же system-формат, что читают mechanics и talent-requirements. */
function makeActor({ chars = {}, corruption = 0, psyRating = 0, skills = {}, groupSkills = {}, items = [] } = {}) {
  const characteristics = {};
  for (const [k, v] of Object.entries(chars)) characteristics[k] = { total: v };
  return {
    system: { characteristics, skills, groupSkills, corruption: { value: corruption }, psyker: { rating: psyRating } },
    items
  };
}

const talentItem = name => ({ type: "talent", name, system: {} });
const traitItem  = name => ({ type: "trait",  name, system: {} });

describe("wdbc-0pki: снимок трёх движков Требований на одном акторе", () => {

  describe("Характеристика (WS) — порог не ниже N", () => {
    const a = makeActor({ chars: { ws: 40 } });

    it("mechanics.mjs (reqStat)", () => {
      expect(actorMeetsReq(a, mechReq("reqStat", { statKey: "ws", statThreshold: 40 }))).toBe(true);
      expect(actorMeetsReq(a, mechReq("reqStat", { statKey: "ws", statThreshold: 41 }))).toBe(false);
    });

    it("elite-requirements.mjs (characteristic)", () => {
      expect(checkEliteRequirements(eliteReq({ kind: "characteristic", charKey: "ws", value: 40 }), eliteWho(a)).available).toBe(true);
      expect(checkEliteRequirements(eliteReq({ kind: "characteristic", charKey: "ws", value: 41 }), eliteWho(a)).available).toBe(false);
    });

    it("talent-requirements.mjs («WS 40»)", () => {
      expect(checkRequirement(a, "WS 40").state).toBe("ok");
      expect(checkRequirement(a, "WS 41").state).toBe("fail");
    });
  });

  describe("Порча — порог не ниже N", () => {
    const a = makeActor({ corruption: 20 });

    it("mechanics.mjs (reqStat/corruption)", () => {
      expect(actorMeetsReq(a, mechReq("reqStat", { statKey: "corruption", statThreshold: 20 }))).toBe(true);
      expect(actorMeetsReq(a, mechReq("reqStat", { statKey: "corruption", statThreshold: 21 }))).toBe(false);
    });

    it("elite-requirements.mjs (corruption)", () => {
      expect(checkEliteRequirements(eliteReq({ kind: "corruption", value: 20 }), eliteWho(a)).available).toBe(true);
      expect(checkEliteRequirements(eliteReq({ kind: "corruption", value: 21 }), eliteWho(a)).available).toBe(false);
    });

    it("talent-requirements.mjs («Порча 20+»)", () => {
      expect(checkRequirement(a, "Порча 20+").state).toBe("ok");
      expect(checkRequirement(a, "Порча 21+").state).toBe("fail");
    });
  });

  describe("Пси-рейтинг (PR) — порог не ниже N", () => {
    const a = makeActor({ psyRating: 3 });

    it("mechanics.mjs (reqStat/psyRating)", () => {
      expect(actorMeetsReq(a, mechReq("reqStat", { statKey: "psyRating", statThreshold: 3 }))).toBe(true);
      expect(actorMeetsReq(a, mechReq("reqStat", { statKey: "psyRating", statThreshold: 4 }))).toBe(false);
    });

    it("talent-requirements.mjs («PR 3»)", () => {
      expect(checkRequirement(a, "PR 3").state).toBe("ok");
      expect(checkRequirement(a, "PR 4").state).toBe("fail");
    });

    // wdbc-0pki: пробел закрыт — elite-requirements.mjs теперь тоже видит
    // вид требования «Пси-рейтинг», тем же статом req-atom.mjs, что и
    // mechanics.mjs reqStat/psyRating.
    it("elite-requirements.mjs (psyRating) — вид требования заведён", () => {
      expect(REQ_KINDS.some(k => k.key === "psyRating")).toBe(true);
      const req = eliteReq({ kind: "psyRating", value: 3 });
      expect(checkEliteRequirements(req, eliteWho(a)).available).toBe(true);
      expect(checkEliteRequirements(eliteReq({ kind: "psyRating", value: 4 }), eliteWho(a)).available).toBe(false);
    });
  });

  describe("Навык — ранг не ниже «Знает»", () => {
    const a = makeActor({ skills: { techUse: { rank: "knows" } } });

    it("mechanics.mjs (reqSkill)", () => {
      expect(actorMeetsReq(a, mechReq("reqSkill", { skillKey: "techUse", rank: "knows" }))).toBe(true);
      expect(actorMeetsReq(a, mechReq("reqSkill", { skillKey: "techUse", rank: "trained" }))).toBe(false);
    });

    it("elite-requirements.mjs (skill)", () => {
      const who = eliteWho(a);
      expect(checkEliteRequirements(eliteReq({ kind: "skill", skillKey: "techUse", rank: "knows" }), who).available).toBe(true);
      expect(checkEliteRequirements(eliteReq({ kind: "skill", skillKey: "techUse", rank: "trained" }), who).available).toBe(false);
    });

    it("talent-requirements.mjs («Tech-Use»)", () => {
      expect(checkRequirement(a, "Tech-Use").state).toBe("ok");
      expect(checkRequirement(a, "Tech-Use+10").state).toBe("fail");
    });
  });

  describe("Групповой навык со специализацией — Forbidden Lore (Warp)", () => {
    const a = makeActor({ groupSkills: { forbiddenLore: [{ specialty: "Warp", rank: "knows" }] } });

    it("mechanics.mjs (reqSkill, scope group)", () => {
      const req = mechReq("reqSkill", { skillScope: "group", skillKey: "forbiddenLore", specialty: "Warp", rank: "knows" });
      expect(actorMeetsReq(a, req)).toBe(true);
    });

    it("elite-requirements.mjs (skill, scope group)", () => {
      const req = eliteReq({ kind: "skill", scope: "group", skillKey: "forbiddenLore", specKey: "Warp", rank: "knows" });
      expect(checkEliteRequirements(req, eliteWho(a)).available).toBe(true);
    });

    it("talent-requirements.mjs («Forbidden Lore (Warp)»)", () => {
      expect(checkRequirement(a, "Forbidden Lore (Warp)").state).toBe("ok");
      expect(checkRequirement(a, "Forbidden Lore (Xenos)").state).toBe("fail");
    });
  });

  describe("Талант по точному имени — три движка согласны", () => {
    const a = makeActor({ items: [talentItem("Frenzy")] });

    it("mechanics.mjs (reqTalent)", () => {
      expect(actorMeetsReq(a, mechReq("reqTalent", { sourceName: "Frenzy" }))).toBe(true);
      expect(actorMeetsReq(a, mechReq("reqTalent", { sourceName: "Quick Draw" }))).toBe(false);
    });

    it("elite-requirements.mjs (talent)", () => {
      const who = eliteWho(a);
      expect(checkEliteRequirements(eliteReq({ kind: "talent", name: "Frenzy" }), who).available).toBe(true);
      expect(checkEliteRequirements(eliteReq({ kind: "talent", name: "Quick Draw" }), who).available).toBe(false);
    });

    it("talent-requirements.mjs («Frenzy»)", () => {
      expect(checkRequirement(a, "Frenzy").state).toBe("ok");
      expect(checkRequirement(a, "Quick Draw").state).toBe("fail");
    });
  });

  // ── Расхождения между движками — то, ради чего заведён тикет ──────────────
  // Ниже три сценария, где один и тот же физический факт на акторе сегодня
  // даёт РАЗНЫЙ вердикт в зависимости от того, какой из трёх движков спросили.
  // Тест не «падает» на расхождении — он его документирует.

  describe("wdbc-0pki: имя теперь сверяется одним каноном везде — itemHasName, совпадение ЦЕЛИКОМ", () => {
    // У актора Талант «Iron Will». Требование хочет «Will» — подстроку.
    // ДО общего слоя elite-requirements.mjs сверял имя ВХОЖДЕНИЕМ («Will»
    // находилось внутри «Iron Will») — единственный из трёх движков, кто так
    // делал. Общий слой (rules/req-atom.mjs → itemHasName) сверяет имя
    // ЦЕЛИКОМ, как уже делали mechanics.mjs и talent-requirements.mjs —
    // расхождение унифицировано осознанно, а не потеряно тихо.
    const a = makeActor({ items: [talentItem("Iron Will")] });

    it("mechanics.mjs: сверка ТОЛЬКО по целому имени — не выполнено", () => {
      expect(actorMeetsReq(a, mechReq("reqTalent", { sourceName: "Will" }))).toBe(false);
    });

    it("talent-requirements.mjs: hasTalent тоже требует целое имя — «fail»", () => {
      expect(checkRequirement(a, "Will").state).toBe("fail");
    });

    it("elite-requirements.mjs: теперь тоже целиком, вхождением больше не находится — не выполнено", () => {
      expect(checkEliteRequirements(eliteReq({ kind: "talent", name: "Will" }), eliteWho(a)).available).toBe(false);
    });
  });

  // wdbc-0pki, РЕШЕНИЕ (не унифицировать): расхождение оставлено как есть
  // осознанно, не по недосмотру. mechanics.mjs/elite-requirements.mjs дают
  // автору выбрать вид требования ЯВНО — отдельный пункт «Талант» и отдельный
  // «Черта» в редакторе, перетаскивание типизированного документа
  // (elite-req-builder.mjs reqDropType). talent-requirements.mjs, наоборот,
  // разбирает СВОБОДНУЮ строку требования из книги («Frenzy») — книга не
  // говорит, Талант это или Черта в терминах system.json, различать там
  // нечем и незачем. Общий слой (itemsNamed/hasItemNamed, rules/req-atom.mjs)
  // это отражает: адаптеры сами решают, каким списком типов его звать — тип
  // остаётся параметром вызова, а не свойством общего слоя.
  describe("РАСХОЖДЕНИЕ (оставлено намеренно): Талант и Черта — разные типы (mechanics/elite) или взаимозаменяемы (talent-requirements)", () => {
    // Физически это ЧЕРТА (item.type === "trait") с именем «Frenzy».
    const a = makeActor({ items: [traitItem("Frenzy")] });

    it("mechanics.mjs: reqTalent смотрит СТРОГО type==='talent' — Черта его не закрывает", () => {
      expect(actorMeetsReq(a, mechReq("reqTalent", { sourceName: "Frenzy" }))).toBe(false);
      // Правильный вид требования для Черты — reqTrait — видит её.
      expect(actorMeetsReq(a, mechReq("reqTrait", { sourceName: "Frenzy" }))).toBe(true);
    });

    it("elite-requirements.mjs: вид «talent» тоже смотрит только who.talents (тип talent) — не закрыто", () => {
      const who = eliteWho(a);
      expect(checkEliteRequirements(eliteReq({ kind: "talent", name: "Frenzy" }), who).available).toBe(false);
      // Отдельный вид «trait» — по who.traits — закрывает.
      expect(checkEliteRequirements(eliteReq({ kind: "trait", name: "Frenzy" }), who).available).toBe(true);
    });

    it("talent-requirements.mjs: ОДИН вид «talent» проверяет type talent ИЛИ trait разом — закрыто без отдельного вида", () => {
      // parseAtom не различает Талант/Черту книжной строкой — «Frenzy» это
      // просто «kind:talent», а hasTalent() внутри читает оба типа предмета.
      expect(checkRequirement(a, "Frenzy").state).toBe("ok");
    });
  });
});
