// @vitest-environment jsdom
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const read = (file: string) =>
  readFileSync(path.resolve(import.meta.dirname, file));
const fontFile = "../fonts/vazirmatn/Vazirmatn-Variable.woff2";
const identities = {
  "index.css":
    "65ab7028df929d48dcbb1ca112d19c8c2e63ace9a1c6b3efd257068bdd8765f7",
  "vazirmatn.css":
    "30f5bf96cefb147568fd5ccf5ab6d16e86849f6f2af8dcb982a90b4fde782664",
};

describe("published stylesheets", () => {
  it("retains the reviewed bytes of the base and font stylesheets", () => {
    for (const [file, digest] of Object.entries(identities))
      expect(createHash("sha256").update(read(file)).digest("hex")).toBe(
        digest,
      );
  });

  it("connects self-hosted CSS to the reviewed font bytes", () => {
    const cssFile = path.join(import.meta.dirname, "vazirmatn.css");
    const face = readFileSync(cssFile, "utf8");
    const references = [...face.matchAll(/url\("([^"\n]+)"\)/g)].map(
      (match) => match[1],
    );
    expect(references).toEqual([fontFile]);
    expect(
      readFileSync(path.resolve(path.dirname(cssFile), references[0])),
    ).toEqual(read(fontFile));
    expect(face).toMatch(/font-family:\s*Vazirmatn/);
    expect(face).toMatch(/font-weight:\s*100 900/);
    expect(face).toMatch(/font-display:\s*swap/);
    const global = read("index.css").toString();
    expect(global).toMatch(/font-family:\s*Vazirmatn, system-ui, sans-serif/);
  });

  it("does not impose a minimum width on the page", () => {
    const style = document.createElement("style");
    style.textContent = read("index.css").toString();
    document.head.append(style);

    try {
      const rootStyle = getComputedStyle(document.documentElement);
      expect(["", "auto", "0px"]).toContain(rootStyle.minWidth);
      expect(rootStyle.overflowX).toBe("hidden");
    } finally {
      style.remove();
    }
  });
});
