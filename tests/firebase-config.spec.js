import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

test("uses the Firebase-registered Google OAuth handler domain", () => {
  const source = readFileSync(new URL("../firebase-client.js", import.meta.url), "utf8");

  expect(source).toContain('authDomain: "florida-quantum-computing.firebaseapp.com"');
  expect(source).not.toContain('authDomain: "florida-quantum-computing.web.app"');
});
