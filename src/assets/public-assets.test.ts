// @vitest-environment jsdom
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const read = (file: string) =>
  readFileSync(path.resolve(import.meta.dirname, "../../public", file));
const identities = {
  "favicon.svg":
    "61bc9a161de58248288e6905425d7180f0624c2865007b97d763fdac12043a66",
  "logo.svg":
    "f2cadfd0d3f726df66f2fbbb0e0c8ae9bbb83e9a4d3c740e2a676e5be2e4edea",
};

describe("published logo and favicon", () => {
  it("retains the reviewed bytes of both SVGs", () => {
    for (const [file, digest] of Object.entries(identities))
      expect(createHash("sha256").update(read(file)).digest("hex")).toBe(
        digest,
      );
  });

  it("parses both SVGs as self-contained vector images with no executable or remote references", () => {
    for (const file of Object.keys(identities)) {
      const document = new DOMParser().parseFromString(
        read(file).toString(),
        "image/svg+xml",
      );
      expect(document.querySelector("parsererror")).toBeNull();
      expect(document.documentElement.namespaceURI).toBe(
        "http://www.w3.org/2000/svg",
      );
      expect(document.documentElement.tagName).toBe("svg");
      expect(
        document.querySelector("path, circle, polygon, rect"),
      ).not.toBeNull();
      expect(
        document.querySelector("script, foreignObject, image, use, iframe"),
      ).toBeNull();
      for (const element of document.querySelectorAll("*"))
        for (const attribute of element.attributes) {
          expect(attribute.name).not.toMatch(/^on/i);
          if (/href$/i.test(attribute.name))
            expect(attribute.value).toMatch(/^#/);
        }
    }
  });
});
