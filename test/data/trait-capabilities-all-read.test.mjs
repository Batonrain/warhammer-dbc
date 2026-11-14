// dbc-114 (14.11.2026): ни одна запись Черты в реестре способностей не остаётся «пустой».
// Каждая — либо работающая механика (читатель с файлами), либо честная пометка: правило стола,
// ждёт подсистему, ждёт задачу Sahara. Тест не даёт вернуть «reader: ''» молча.
import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";

const traits = Object.entries(CAPABILITIES).filter(([k]) => k.startsWith("trait."));

describe("реестр способностей: Черты", () => {
  it("у каждой Черты непустой читатель", () => {
    const empty = traits.filter(([, v]) => !String(v.reader ?? "").trim()).map(([k]) => k);
    expect(empty).toEqual([]);
  });
  it("честные пометки названы одним из трёх способов и называют, что ждёт", () => {
    const marks = traits.filter(([, v]) => /^(ПРАВИЛО СТОЛА|ЖДЁТ ПОДСИСТЕМУ)/.test(v.reader));
    expect(marks.length).toBeGreaterThan(100);
    for (const [k, v] of marks) {
      if (/^ЖДЁТ ПОДСИСТЕМУ/.test(v.reader)) expect(v.reader, k).toMatch(/task-[0-9a-f]{4}/);
      else expect(v.reader, k).toMatch(/кнопка-памятка/);
    }
  });
});
