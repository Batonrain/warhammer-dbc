// test/apps/mechanics-alt-duplicate-branches.test.mjs
//
// wdbc-91b: две ветки выдачи АЛЬТЕРНАТИВЫ при дубле (module/apps/mechanics.mjs
// ::applyMechEntry) не были покрыты ни одним тестом — только сама сборка
// списка кандидатов (rules/duplicate-grants.mjs) и очередь диалогов
// (mechanics-altskill-dialog-queue.test.mjs, которая всегда жмёт «Компенсация
// опытом», ни разу не «Выдать»):
//
//   1. Талант, talentDuplicatePolicy:"altTalent" — игрок выбирает другой
//      Талант той же Группы/Ступени, тот выдаётся actor.createEmbeddedDocuments
//      (а не возврат опыта).
//   2. Групповой Навык, skillDuplicatePolicy:"altSkill" — игрок вписывает
//      новую Специализацию, она arr.push()-ится в systemgroupSkills, а не
//      заменяет ранг имеющейся.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { applyMechEntry, blankMechEntry } from "../../module/apps/mechanics.mjs";
import { altTalentCandidates } from "../../module/rules/duplicate-grants.mjs";

const FLAG = "warhammer-dbc";

async function flush() {
  await new Promise(r => setTimeout(r, 0));
  await new Promise(r => setTimeout(r, 0));
  await new Promise(r => setTimeout(r, 0));
}

/** Диалог-стаб: конструктор запоминает конфиг, тест сам жмёт кнопку. */
class RecordingDialog {
  constructor(config) { this.config = config; RecordingDialog.instances.push(this); }
  render() { return this; }
}
RecordingDialog.instances = [];

const RealDialog = globalThis.Dialog;
const realSettingsGet = globalThis.game.settings.get;
const realFromUuid = globalThis.fromUuid;

beforeEach(() => {
  RecordingDialog.instances = [];
  globalThis.Dialog = RecordingDialog;
});

afterEach(() => {
  globalThis.Dialog = RealDialog;
  globalThis.game.settings.get = realSettingsGet;
  globalThis.fromUuid = realFromUuid;
  globalThis.game.packs = undefined;
});

/** Подставной html для showAltTalentDialog: value() — выбранный радиокнопкой индекс. */
const fakeHtmlIndex = value => ({ find: () => ({ val: () => value }) });
/** Подставной html для showAltSkillDialog (group): value() — вписанная Специализация. */
const fakeHtmlSpec = value => ({ find: () => ({ val: () => value }) });

describe("applyMechEntry: альтернативный Талант при дубле (talentDuplicatePolicy:altTalent)", () => {
  const DUP_NAME = "Combat Formation / Боевое Построение";

  function actorWithTalent() {
    const created = [];
    const actor = {
      created,
      items: [{ type: "talent", name: DUP_NAME, system: { specialization: "" } }],
      system: { experience: { total: 0, current: 0, log: [] }, aptitudes: [] },
      createEmbeddedDocuments: async (_type, docs) => { created.push(...docs); return docs; },
      // Только откат «Компенсация опытом» (refundXP, apps/duplicate-refund.mjs)
      // пишет через update — тест на неё не завязан, только на то, что она
      // не падает.
      update: async () => {}
    };
    return actor;
  }

  it("выбранная альтернатива выдаётся предметом (createEmbeddedDocuments), а не возвратом опыта", async () => {
    globalThis.game.settings.get = (scope, key) =>
      (scope === FLAG && key === "talentDuplicatePolicy") ? "altTalent" : undefined;
    // Второй источник того же Таланта — резолвится по sourceUuid, как в
    // реальном applyMechEntry (fromUuid, module/apps/mechanics.mjs::resolveMechSource).
    globalThis.fromUuid = async uuid => uuid === "Item.dup"
      ? { toObject: () => ({ name: DUP_NAME, type: "talent", system: { specialization: "" } }) }
      : null;

    const actor = actorWithTalent();
    const sourceItem = { id: "src1", name: "Второй источник" };
    const entry = { ...blankMechEntry("talent"), sourceUuid: "Item.dup", sourceName: DUP_NAME };

    // Список кандидатов независим от порядка constants/talents-library.mjs —
    // берём его напрямую, а не угадываем конкретное имя.
    const candidates = altTalentCandidates(DUP_NAME, [DUP_NAME]);
    expect(candidates.length).toBeGreaterThan(0); // группа/ступень найдены — иначе тест ничего не проверяет

    const run = applyMechEntry(actor, entry, sourceItem);
    await flush();

    expect(RecordingDialog.instances).toHaveLength(1);
    expect(RecordingDialog.instances[0].config.title).toContain(DUP_NAME);
    // Жмём «Выдать» с индексом 0 — первый отфильтрованный кандидат.
    RecordingDialog.instances[0].config.buttons.pick.callback(fakeHtmlIndex("0"));
    await run;

    expect(actor.created).toHaveLength(1);
    expect(actor.created[0].name).toBe(candidates[0].name);
    expect(actor.created[0].name).not.toBe(DUP_NAME);
    expect(actor.created[0].system.granted).toBe(true);
    expect(actor.created[0].system.purchased).toBe(false);
    expect(actor.created[0].flags[FLAG].grantedByItem).toBe("src1");
  });

  it("«Компенсировать опытом» в диалоге — второй предмет НЕ создаётся", async () => {
    globalThis.game.settings.get = (scope, key) =>
      (scope === FLAG && key === "talentDuplicatePolicy") ? "altTalent" : undefined;
    globalThis.fromUuid = async uuid => uuid === "Item.dup"
      ? { toObject: () => ({ name: DUP_NAME, type: "talent", system: { specialization: "" } }) }
      : null;

    const actor = actorWithTalent();
    const entry = { ...blankMechEntry("talent"), sourceUuid: "Item.dup", sourceName: DUP_NAME };

    const run = applyMechEntry(actor, entry, { id: "src1" });
    await flush();
    RecordingDialog.instances[0].config.buttons.refund.callback();
    await run;

    expect(actor.created).toEqual([]);
  });
});

describe("applyMechEntry: альтернативная Специализация Группового Навыка (skillDuplicatePolicy:altSkill)", () => {
  const groupSkillEntry = () => ({
    id: "e1", kind: "skill", skillScope: "group", skillKey: "commonLore",
    specKey: "tech", specialty: "Tech", rank: "knows"
  });

  function actorWithGroupSkill() {
    const actor = {
      system: { groupSkills: { commonLore: [
        { specialty: "Tech", specKey: "tech", rank: "knows", grantedRank: "knows", cost: 0 }
      ] } },
      items: [],
      update: async data => {
        for (const [path, value] of Object.entries(data))
          if (path === "system.groupSkills.commonLore") actor.system.groupSkills.commonLore = value;
      }
    };
    return actor;
  }

  it("новая вписанная Специализация добавляется отдельной записью (arr.push), имеющаяся не трогается", async () => {
    globalThis.game.settings.get = (scope, key) =>
      (scope === FLAG && key === "skillDuplicatePolicy") ? "altSkill" : undefined;

    const actor = actorWithGroupSkill();
    const run = applyMechEntry(actor, groupSkillEntry(), { id: "src1" });
    await flush();

    expect(RecordingDialog.instances).toHaveLength(1);
    RecordingDialog.instances[0].config.buttons.pick.callback(fakeHtmlSpec("Криптография"));
    await run;

    expect(actor.system.groupSkills.commonLore).toEqual([
      { specialty: "Tech", specKey: "tech", rank: "knows", grantedRank: "knows", cost: 0 },
      { specialty: "Криптография", rank: "knows", grantedRank: "knows", cost: 0 }
    ]);
  });

  it("вписанная Специализация, которая уже занята, — не дублирует запись, идёт обычным путём (ранг/возврат)", async () => {
    globalThis.game.settings.get = (scope, key) =>
      (scope === FLAG && key === "skillDuplicatePolicy") ? "altSkill" : undefined;

    const actor = actorWithGroupSkill();
    const run = applyMechEntry(actor, groupSkillEntry(), { id: "src1" });
    await flush();
    // Та же Специализация, что уже есть (без учёта регистра) — specTaken:true.
    RecordingDialog.instances[0].config.buttons.pick.callback(fakeHtmlSpec("tech"));
    await run;

    // Запись осталась одна — вторая не появилась поверх имеющейся.
    expect(actor.system.groupSkills.commonLore).toHaveLength(1);
  });
});
