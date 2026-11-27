import { describe, expect, it } from "vitest";
import { parseEstimate } from "./estimate";

const value = (text: string, lang: "de" | "en" = "de") => {
  const read = parseEstimate(text, lang);
  return read.ok ? read.value : read.why;
};

describe("the number of an estimate", () => {
  it("reads whole numbers and one decimal separator in either spelling", () => {
    expect(value("40")).toBe(40);
    expect(value(" 2,5 ")).toBe(2.5);
    expect(value("2.5")).toBe(2.5);
    expect(value("2.5", "en")).toBe(2.5);
    expect(value("2,5", "en")).toBe(2.5);
    expect(value("-3")).toBe(-3);
    expect(value("−3")).toBe(-3);
    expect(value(",5")).toBe(0.5);
    expect(value("-0")).toBe(0);
  });

  it("reads grouped thousands where the language makes them unmistakable", () => {
    expect(value("1.200")).toBe(1200);
    expect(value("1.200.000,5")).toBe(1200000.5);
    expect(value("1 200")).toBe(1200);
    expect(value("1,200", "en")).toBe(1200);
    expect(value("1,200.5", "en")).toBe(1200.5);
    // the other language's grouping is a decimal here, and the stored number shows it back
    expect(value("1,200")).toBe(1.2);
    expect(value("1.200", "en")).toBe(1.2);
  });

  it("says why there is no number", () => {
    expect(value("")).toBe("empty");
    expect(value("   ")).toBe("empty");
    expect(value("vierzig")).toBe("notANumber");
    expect(value("40 Tage")).toBe("notANumber");
    expect(value("1,2,3")).toBe("notANumber");
    expect(value("1e5")).toBe("notANumber");
    expect(value("2000000000000")).toBe("tooLarge");
  });
});
