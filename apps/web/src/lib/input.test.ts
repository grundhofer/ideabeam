import { expect, test } from "vitest";
import { checkText, DISPLAY_NAME_MAX, QUESTION_MAX, tidy } from "./input";

test("a text is what is left without the spaces around it", () => {
  expect(tidy("  Was hält uns auf? ")).toBe("Was hält uns auf?");
});

test("a text may not be empty, and not longer than its bound", () => {
  expect(checkText("Anna", DISPLAY_NAME_MAX)).toBeUndefined();
  expect(checkText("", DISPLAY_NAME_MAX)).toBe("missing");
  expect(checkText("   ", DISPLAY_NAME_MAX)).toBe("missing");
  expect(checkText("x".repeat(DISPLAY_NAME_MAX), DISPLAY_NAME_MAX)).toBeUndefined();
  expect(checkText("x".repeat(DISPLAY_NAME_MAX + 1), DISPLAY_NAME_MAX)).toBe("tooLong");
  // the spaces around it do not count
  expect(checkText(`  ${"x".repeat(QUESTION_MAX)}  `, QUESTION_MAX)).toBeUndefined();
});

test("the bounds are the protocol's", async () => {
  const { displayNameSchema, questionSchema } = await import("@ideabeam/shared");
  expect(displayNameSchema.safeParse("x".repeat(DISPLAY_NAME_MAX)).success).toBe(true);
  expect(displayNameSchema.safeParse("x".repeat(DISPLAY_NAME_MAX + 1)).success).toBe(false);
  expect(questionSchema.safeParse("x".repeat(QUESTION_MAX)).success).toBe(true);
  expect(questionSchema.safeParse("x".repeat(QUESTION_MAX + 1)).success).toBe(false);
});
