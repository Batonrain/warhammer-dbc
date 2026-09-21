import { describe, it, expect } from "vitest";
import { pickAttachSlot, slotOf, routeTouchesSystem, routeKnowledgeMod } from "../../module/rules/warp-route.mjs";

describe("warp-route: привязка маршрута к системе", () => {
  it("оба конца пусты — занимает системAUuid", () => {
    expect(pickAttachSlot({ systemAUuid: "", systemBUuid: "" }, "Actor.x")).toBe("systemAUuid");
  });

  it("А занят другой системой — занимает Б", () => {
    expect(pickAttachSlot({ systemAUuid: "Actor.other", systemBUuid: "" }, "Actor.x")).toBe("systemBUuid");
  });

  it("оба конца заняты другими системами — null (отклонить)", () => {
    expect(pickAttachSlot({ systemAUuid: "Actor.a", systemBUuid: "Actor.b" }, "Actor.x")).toBeNull();
  });

  it("эта же система уже привязана (А) — already, не трогать", () => {
    expect(pickAttachSlot({ systemAUuid: "Actor.x", systemBUuid: "" }, "Actor.x")).toBe("already");
  });

  it("эта же система уже привязана (Б) — already", () => {
    expect(pickAttachSlot({ systemAUuid: "Actor.other", systemBUuid: "Actor.x" }, "Actor.x")).toBe("already");
  });

  it("slotOf находит занятый конец, иначе null", () => {
    expect(slotOf({ systemAUuid: "Actor.x", systemBUuid: "" }, "Actor.x")).toBe("systemAUuid");
    expect(slotOf({ systemAUuid: "Actor.other", systemBUuid: "" }, "Actor.x")).toBeNull();
  });

  it("routeTouchesSystem — true только если один из концов совпал", () => {
    expect(routeTouchesSystem({ systemAUuid: "Actor.x" }, "Actor.x")).toBe(true);
    expect(routeTouchesSystem({ systemAUuid: "Actor.other" }, "Actor.x")).toBe(false);
  });
});

describe("warp-route: уровни Знания маршрута Проводником", () => {
  it("книжные модификаторы Шагов 4-5", () => {
    expect(routeKnowledgeMod("unknown")).toBe(-10);
    expect(routeKnowledgeMod("presumed")).toBe(0);
    expect(routeKnowledgeMod("known")).toBe(10);
    expect(routeKnowledgeMod("learned")).toBe(20);
    expect(routeKnowledgeMod("chosen")).toBe(30);
  });

  it("незнакомый/пустой уровень — как Неизвестный", () => {
    expect(routeKnowledgeMod("")).toBe(-10);
    expect(routeKnowledgeMod(undefined)).toBe(-10);
  });
});
