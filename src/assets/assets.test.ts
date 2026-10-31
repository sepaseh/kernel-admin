// @vitest-environment jsdom
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

type Font = {
  copyright: string;
  familyName: string;
  glyphForCodePoint: (code: number) => { path: { toSVG: () => string } };
  hasGlyphForCodePoint: (code: number) => boolean;
  variationAxes: { wght: { min: number; default: number; max: number } };
};
const require = createRequire(import.meta.url);
const fontkit = require("fontkit") as {
  create: (data: Buffer) => Font;
};
const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file));
const fontFile = "src/assets/fonts/vazirmatn/Vazirmatn-Variable.woff2";
const identities = {
  "src/assets/fonts/vazirmatn/OFL.txt":
    "17e355067c8284f47743a1ee3b1ef7ff684ff0601eda357f9353b10b3016ab31",
  [fontFile]:
    "4e3fa217d38fdafc1fea4414ceb58ca5e662cf0ab5fa735a8c8c20e8b42cad92",
  "src/assets/styles/index.css":
    "1ab03b89ece5055a348fba8a7de303a1f0736daa50e11c7283a1ab59ced421b4",
  "src/assets/styles/vazirmatn.css":
    "30f5bf96cefb147568fd5ccf5ab6d16e86849f6f2af8dcb982a90b4fde782664",
  "public/logo.svg":
    "f2cadfd0d3f726df66f2fbbb0e0c8ae9bbb83e9a4d3c740e2a676e5be2e4edea",
  "public/favicon.svg":
    "61bc9a161de58248288e6905425d7180f0624c2865007b97d763fdac12043a66",
};

describe("published visual assets", () => {
  it("retains the reviewed bytes of every asset and the actual font license", () => {
    for (const [file, digest] of Object.entries(identities))
      expect(createHash("sha256").update(read(file)).digest("hex")).toBe(
        digest,
      );
    const font = fontkit.create(read(fontFile));
    const license = read("src/assets/fonts/vazirmatn/OFL.txt").toString();
    expect(license).toContain(font.copyright);
    expect(license).toContain("SIL OPEN FONT LICENSE Version 1.1");
  });

  it("decodes the WOFF2 weight axis and real Persian/Latin default outlines", () => {
    const bytes = read(fontFile);
    expect(bytes.subarray(0, 4).toString()).toBe("wOF2");
    const font = fontkit.create(bytes);
    expect(font.familyName).toBe("Vazirmatn");
    expect(font.variationAxes.wght).toMatchObject({
      min: 100,
      default: 400,
      max: 900,
    });
    for (const character of "پارسی۰۱۲۳۴۵۶۷۸۹Admin0123456789") {
      expect(font.hasGlyphForCodePoint(character.codePointAt(0)!)).toBe(true);
      expect(
        font.glyphForCodePoint(character.codePointAt(0)!).path.toSVG().length,
      ).toBeGreaterThan(0);
    }
    expect(() => fontkit.create(Buffer.from("invalid font"))).toThrow();
  });

  it("connects self-hosted CSS to those exact font bytes and preserves focus/reduced-motion rules", () => {
    const cssFile = path.join(root, "src/assets/styles/vazirmatn.css");
    const face = readFileSync(cssFile, "utf8");
    const references = [...face.matchAll(/url\("([^"\n]+)"\)/g)].map(
      (match) => match[1],
    );
    expect(references).toEqual(["../fonts/vazirmatn/Vazirmatn-Variable.woff2"]);
    expect(
      readFileSync(path.resolve(path.dirname(cssFile), references[0])),
    ).toEqual(read(fontFile));
    expect(face).toMatch(/font-family:\s*Vazirmatn/);
    expect(face).toMatch(/font-weight:\s*100 900/);
    expect(face).toMatch(/font-display:\s*swap/);
    const global = read("src/assets/styles/index.css").toString();
    expect(global).toMatch(/font-family:\s*Vazirmatn, system-ui, sans-serif/);
    expect(global).toContain(":focus-visible");
    expect(global).toContain("prefers-reduced-motion: reduce");
  });

  it("scopes reduced motion across the document and portalled controls in app and Storybook roots", () => {
    const style = document.createElement("style");
    style.textContent = read("src/assets/styles/index.css").toString();
    const mount = document.createElement("div");
    mount.id = "root";
    const portal = document.createElement("div");
    portal.className = "ant-drawer";
    const control = document.createElement("button");
    portal.append(control);
    document.head.append(style);
    document.body.append(mount, portal);

    try {
      const media = Array.from(style.sheet!.cssRules).find(
        (rule) => rule.type === CSSRule.MEDIA_RULE,
      ) as CSSMediaRule;
      expect(media.conditionText).toBe("(prefers-reduced-motion: reduce)");
      const motion = media.cssRules[0] as CSSStyleRule;
      for (const [property, value] of Object.entries({
        "animation-duration": "0.01ms",
        "animation-iteration-count": "1",
        "scroll-behavior": "auto",
        "transition-duration": "0.01ms",
      })) {
        expect(motion.style.getPropertyValue(property)).toBe(value);
        expect(motion.style.getPropertyPriority(property)).toBe("");
      }
      expect(motion.selectorText).toContain("*::before");
      expect(motion.selectorText).toContain("*::after");
      expect(motion.selectorText).toContain(
        "html:root:has(#root, #storybook-root)::before",
      );
      expect(motion.selectorText).toContain(
        "html:root:has(#root, #storybook-root)::after",
      );
      for (const rootId of ["root", "storybook-root"]) {
        mount.id = rootId;
        const selected = Array.from(
          document.querySelectorAll(motion.selectorText),
        );
        expect(selected).toEqual(
          expect.arrayContaining([
            document.documentElement,
            mount,
            portal,
            control,
          ]),
        );
      }
    } finally {
      style.remove();
      mount.remove();
      portal.remove();
    }
  });

  it("parses both SVGs as self-contained vector images with no executable or remote references", () => {
    for (const file of ["public/logo.svg", "public/favicon.svg"]) {
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
