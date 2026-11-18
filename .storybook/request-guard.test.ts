import { afterEach, expect, test } from "vitest";

import {
  assertNoUnexpectedRequests,
  rejectUnexpectedRequest,
  resetRequestGuard,
} from "./request-guard";

afterEach(resetRequestGuard);

test("a caught unexpected API failure still fails the browser story boundary", () => {
  resetRequestGuard();
  expect(assertNoUnexpectedRequests).not.toThrow();
  expect(() => rejectUnexpectedRequest("GET", "/unconfigured")).toThrow(
    "Unexpected synthetic API request: GET /unconfigured",
  );
  expect(assertNoUnexpectedRequests).toThrow("GET /unconfigured");
  expect(() => rejectUnexpectedRequest("POST", "/other")).toThrow();
  expect(assertNoUnexpectedRequests).toThrow(
    "GET /unconfigured\nUnexpected synthetic API request: POST /other",
  );
  resetRequestGuard();
  expect(assertNoUnexpectedRequests).not.toThrow();
});
