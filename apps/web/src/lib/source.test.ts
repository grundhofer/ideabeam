import { expect, test } from "vitest";
import { sourceUrl } from "./source";

const REPO = "https://example.org/erika/fokusbeam";
const SHA = "155f6cc0a1b2c3d4e5f60718293a4b5c6d7e8f90";

test("the source link leads to the commit that runs; without one, to the repository", () => {
  expect(sourceUrl(REPO, SHA)).toBe(`${REPO}/tree/${SHA}`);
  expect(sourceUrl(REPO, SHA.slice(0, 7))).toBe(`${REPO}/tree/${SHA.slice(0, 7)}`);
  expect(sourceUrl(REPO, undefined)).toBe(REPO);
  expect(sourceUrl(REPO, "")).toBe(REPO);
});

test("what is no commit never becomes part of the address", () => {
  for (const odd of ["main", "../../other", "155f6cc?x=1", 42, null])
    expect(sourceUrl(REPO, odd), String(odd)).toBe(REPO);
});

test("there is no link while the repository has no address", () => {
  expect(sourceUrl("[Adresse des öffentlichen Repositorys]", SHA)).toBeNull();
  expect(sourceUrl("", SHA)).toBeNull();
});
