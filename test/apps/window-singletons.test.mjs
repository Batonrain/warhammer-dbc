// test/apps/window-singletons.test.mjs
//
// wdbc-ye6 (пункт 3): openCharacterWizard/openRigManager/openSurgeon создавали
// НОВЫЙ экземпляр окна на каждый вызов вместо переиспользования уже открытого
// (в отличие от остальных окон на актора в проекте — образец: XpLogApp,
// module/apps/xp-log.mjs, и синглтоны без актора — CogitatorManager,
// SceneNexus, VeilMystic). Второй клик по той же кнопке плодил дублирующее
// окно с тем же DOM id (`wh-char-wizard-${actor.id}` и т.п.), что в реальном
// Foundry — конфликт двух окон за один DOM-узел, а не тихий no-op.
//
// Рендера здесь нет — Foundry не запускается, — проверяется только контракт
// "тот же актор -> тот же объект окна", тем же приёмом, что остальные тесты
// открывающих функций: вызвать экспортированную open*-функцию напрямую и
// сравнить возвращённые ссылки. close() не проверяется — ApplicationStub в
// foundry-stub.mjs его не реализует (как и у остальных Application-классов
// проекта, чей super.close() тоже не покрыт тестами).

import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import { openCharacterWizard, CharacterWizard } from "../../module/apps/character-wizard.mjs";
import { openRigManager, RigManager } from "../../module/apps/rig-manager.mjs";
import { openSurgeon, SurgeonWindow } from "../../module/apps/surgeon.mjs";

const actorA = { id: "actorA", name: "Алиса", system: {} };
const actorB = { id: "actorB", name: "Борис", system: {} };

describe.each([
  ["openCharacterWizard", openCharacterWizard, CharacterWizard],
  ["openRigManager", openRigManager, RigManager],
  ["openSurgeon", openSurgeon, SurgeonWindow]
])("%s: одно окно на актора", (name, openFn, Cls) => {
  it("второй вызов с тем же актором поднимает то же окно, а не создаёт новое", () => {
    const first = openFn(actorA);
    const second = openFn(actorA);
    expect(first).toBeInstanceOf(Cls);
    expect(second).toBe(first);
  });

  it("другой актор получает своё собственное окно", () => {
    const forA = openFn(actorA);
    const forB = openFn(actorB);
    expect(forB).not.toBe(forA);
    expect(forB.actorId).toBe("actorB");
  });
});
