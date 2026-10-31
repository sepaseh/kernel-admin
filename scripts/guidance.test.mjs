import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { stringify } from "yaml";

import {
  checkGuidance,
  isSafeGuidancePath,
  markdownLinks,
  validateManifest,
  validateNavigation,
  validateStandaloneLockfile,
  validateStandaloneManifest,
} from "./check-guidance.mjs";

const fixture = () => {
  const manifest = {
    schemaVersion: 1,
    checks: [
      {
        id: "types",
        command: "npm run typecheck",
        kind: "required",
        ciJobs: ["check"],
        scopes: ["all"],
      },
      {
        id: "lab",
        command: "npm run lighthouse",
        kind: "advisory",
        ciJobs: [],
        scopes: ["focused"],
      },
    ],
    profiles: { full: ["types"], guidance: ["types", "lab"] },
  };
  const settings = {
    rules: [],
    skills: [],
    optionalHooks: [],
    navigation: ".agents/navigation.json",
    validation: ".agents/validation.json",
    evaluation: ".agents/evaluation/cases.json",
    recommendedChecks: ["npm run typecheck"],
    recommendedChecksSource: {
      path: ".agents/validation.json",
      profile: "full",
    },
  };
  const commands = [
    { run: "npm ci" },
    { run: "npm run browser:install" },
    { run: "npm run validate -- full" },
  ];
  const ci = {
    on: { pull_request: null },
    jobs: { check: { steps: structuredClone(commands) } },
  };
  const sonar = {
    on: { pull_request: null },
    jobs: {
      analysis: {
        steps: [
          ...structuredClone(commands),
          { uses: "SonarSource/sonarqube-scan-action@" + "a".repeat(40) },
        ],
      },
    },
  };
  return { manifest, settings, ci, sonar };
};
const workflows = ({ ci, sonar }) => ({
  CI: stringify(ci),
  Sonar: stringify(sonar),
});

test("application guidance requires one execution owner while preserving prerequisite ownership", async () => {
  const source = (name) =>
    readFile(new URL("../" + name, import.meta.url), "utf8");
  const manifest = JSON.parse(await source(".agents/validation.json"));
  const settings = JSON.parse(await source(".agents/settings.json"));
  const hosted = {
    CI: await source(".github/workflows/ci.yml"),
    Sonar: await source(".github/workflows/ci.yml"),
  };
  assert.deepEqual(validateManifest(manifest, settings, hosted), []);
  const owned = manifest.checks.filter(
    (check) =>
      check.kind === "required" ||
      (manifest.applicationReady &&
        ["visual", "browser-compatibility", "lighthouse"].includes(check.id)),
  );
  for (const { id } of owned)
    for (const jobs of [[], ["check", "other"], ["build", "check"]]) {
      const changed = structuredClone(manifest);
      changed.checks.find((item) => item.id === id).ciJobs = jobs;
      assert.match(
        validateManifest(changed, settings, hosted).join("\n"),
        /Canonical CI ownership differs/,
      );
    }
  const prerequisite = fixture();
  prerequisite.manifest.checks[0].ciJobs = ["check", "build"];
  assert.match(
    inspect(prerequisite).join("\n"),
    /Canonical CI ownership differs/,
  );
});
const inspect = (state) =>
  validateManifest(state.manifest, state.settings, workflows(state));

test("Markdown scanning ignores empty or unfinished links and preserves later valid targets", () => {
  assert.deepEqual(
    markdownLinks("[one](owner.ts) []() [two](next.md) [unfinished](tail"),
    ["owner.ts", "next.md"],
  );
  assert.deepEqual(markdownLinks("[nested](two](part)"), []);
  assert.deepEqual(markdownLinks("]()](next.md)"), []);
  assert.deepEqual(markdownLinks("ordinary prose"), []);
});

test("Markdown destinations retain balanced or escaped parentheses and exclude optional titles", () => {
  assert.deepEqual(
    markdownLinks(
      [
        "[nested](docs/file(one(two)).md)",
        "[escaped](docs/file\\(name\\).md)",
        '[quoted](docs/file.md "A title (with parentheses)")',
        "[single](docs/file.md 'A title')",
        "[parenthesized](docs/file.md (A title))",
        '[angle](<docs/file (name).md> "A title")',
        "[external](https://example.test/file(name))",
      ].join("\n"),
    ),
    [
      "docs/file(one(two)).md",
      "docs/file(name).md",
      "docs/file.md",
      "docs/file.md",
      "docs/file.md",
      "docs/file (name).md",
      "https://example.test/file(name)",
    ],
  );
});

test("Markdown code examples are ignored while prose links stay visible", () => {
  const markdown = [
    "Inline `[example](missing-inline.md)` and ``[example](missing-double.md) ` ``.",
    "~~~markdown",
    "[example](missing-tilde.md)",
    "~~~",
    "````markdown",
    "```",
    "[example](missing-long-fence.md)",
    "```",
    "````",
    "[real](owner.ts)",
    "\\`[escaped-code-marker](test.ts)",
    "]`example`(must-not-be-manufactured.md)",
    "An unmatched ` marker preserves [real](../.env.local).",
  ].join("\n");
  assert.deepEqual(markdownLinks(markdown), [
    "owner.ts",
    "test.ts",
    "../.env.local",
  ]);
});

test("unclosed Markdown titles do not hide later valid links", () => {
  for (const quote of ['"', "'", "("])
    assert.deepEqual(
      markdownLinks(
        "[bad](owner.ts " + quote + "unfinished\n[good](missing.md)",
      ),
      ["missing.md"],
    );
  assert.deepEqual(
    markdownLinks('[bad](owner.ts "unfinished [good](test.ts "A title")'),
    ["test.ts"],
  );
  assert.deepEqual(
    markdownLinks('[outer](<text [inner](owner.ts "good")> "unfinished'),
    ["owner.ts"],
  );
});

test("container fences and indented code leave later real prose links visible", () => {
  const ticks = String.fromCharCode(96);
  const forms = [
    "> " +
      ticks.repeat(3) +
      "markdown\n> [example](missing.md)\n> " +
      ticks.repeat(4),
    "- item\n\n    " +
      ticks.repeat(3) +
      "markdown\n    [example](missing.md)\n    " +
      ticks.repeat(4),
    "    [example](missing.md)\n    continued code",
    "    - [example](missing.md)",
    ">     - [example](missing.md)",
    "- item\n\n      - [example](missing.md)",
    "> ~~~markdown\n> [example](missing.md)\n> ~~~~",
  ];
  for (const example of forms)
    assert.deepEqual(markdownLinks(example + "\n\n[real](owner.ts)"), [
      "owner.ts",
    ]);
  assert.deepEqual(markdownLinks("- parent\n    - [required](missing.md)"), [
    "missing.md",
  ]);
  assert.deepEqual(
    markdownLinks(
      "> " + ticks.repeat(3) + "\n> [example](ignored.md)\n[real](owner.ts)",
    ),
    ["owner.ts"],
  );
});

test("list tabs use visual columns before a fence and preserve outdented prose", () => {
  for (const marker of ["~~~", String.fromCharCode(96).repeat(3)]) {
    assert.deepEqual(
      markdownLinks(
        "- \t" + marker + "\n    [example](ignored.md)\n   [real](owner.ts)",
      ),
      ["owner.ts"],
    );
    assert.deepEqual(
      markdownLinks(
        "1.\t" + marker + "\n    [example](ignored.md)\n   [real](owner.ts)",
      ),
      ["owner.ts"],
    );
  }
});

test("list-prefixed quoted fences keep examples separate from later prose", () => {
  for (const marker of ["~~~", String.fromCharCode(96).repeat(3)]) {
    const close = marker + marker[0];
    for (const example of [
      "- > " + marker + "\n  > [example](ignored.md)\n  > " + close,
      "> - > " + marker + "\n>   > [example](ignored.md)\n>   > " + close,
      "- \t> " + marker + "\n\t> [example](ignored.md)\n\t> " + close,
    ])
      assert.deepEqual(
        markdownLinks(
          example + "\n\n[real](owner.ts)\n- parent\n    - [nested](test.ts)",
        ),
        ["owner.ts", "test.ts"],
      );
    assert.deepEqual(
      markdownLinks(
        "- > " + marker + "\n  > [example](ignored.md)\n> [real](owner.ts)",
      ),
      ["owner.ts"],
    );
  }
});

test("quoted fences end on lower-depth blank lines while container blanks stay inside", () => {
  for (const marker of ["~~~", String.fromCharCode(96).repeat(3)]) {
    for (const example of [
      "> " + marker + "\n> [example](ignored.md)\n\n> [real](owner.ts)",
      "> > " + marker + "\n> > [example](ignored.md)\n>\n> > [real](owner.ts)",
      "- > " + marker + "\n  > [example](ignored.md)\n\n> [real](owner.ts)",
    ])
      assert.deepEqual(markdownLinks(example), ["owner.ts"], example);
    for (const example of [
      "> " + marker + "\n>\n> [example](ignored.md)\n> " + marker,
      "- " + marker + "\n\n  [example](ignored.md)\n  " + marker,
      "- \t" + marker + "\n\t\n\t[example](ignored.md)\n\t" + marker,
      marker + "\n\n[example](ignored.md)\n" + marker,
    ])
      assert.deepEqual(markdownLinks(example + "\n\n[real](owner.ts)"), [
        "owner.ts",
      ]);
  }
});

test("code-span paragraphs retain indented prose while standalone comments do not", () => {
  for (const text of [
    "`code`\n    [broken](missing.md)",
    "``code ` example``\n\t[broken](missing.md)",
    "`code` <!-- note -->\n    [broken](missing.md)",
    "`multiline\ncode`\n    [broken](missing.md)",
    "> `code`\n>     [broken](missing.md)",
    "- `code`\n      [broken](missing.md)",
  ])
    for (const source of [text, text.replaceAll("\n", "\r\n")])
      assert.deepEqual(markdownLinks(source), ["missing.md"], source);
  for (const text of [
    "<!-- note -->\n    [example](ignored.md)",
    "<!-- note --> `code`\n    [example](ignored.md)",
    "<!--\nnote\n-->\n    [example](ignored.md)",
    "`code`\n\n    [example](ignored.md)",
    "#\n    [example](ignored.md)",
    "* * *\n    [example](ignored.md)",
    "- - -\n    [example](ignored.md)",
    "- parent\n  * * *\n      [example](ignored.md)",
  ])
    for (const source of [text, text.replaceAll("\n", "\r\n")])
      assert.deepEqual(markdownLinks(source), [], source);
});

test("inline code pairing respects paragraph blocks and preserves lazy continuations", () => {
  for (const text of [
    "` [broken](missing.md)\n\nclosing`",
    "` [broken](missing.md)\n> closing`",
    "` [broken](missing.md)\n\n> closing`",
    "- `[broken](missing.md)\n- closing`",
    "` [broken](missing.md)\n1. closing`",
    "1. `[broken](missing.md)\nlazy\n2. closing`",
    "> 1. `[broken](missing.md)\nlazy\n> 2. closing`",
    "1. `[broken](missing.md)\nlazy\n2.\nclosing`",
    "` [broken](missing.md)\n# heading`",
    "# heading `[broken](missing.md)\nclosing`",
    "` [broken](missing.md)\n---\nclosing`",
    "` [broken](missing.md)\n===\nclosing`",
  ])
    for (const source of [text, text.replaceAll("\n", "\r\n")])
      assert.deepEqual(markdownLinks(source), ["missing.md"], source);
  for (const text of [
    "> `[example](ignored.md)\nclosing`",
    "> > `[example](ignored.md)\n> closing`",
    "> `[example](ignored.md)\nclosing\n> end`",
    "- `[example](ignored.md)\n  closing`",
    "- `[example](ignored.md)\nclosing`",
    "` [example](ignored.md)\n2. closing`",
    "` [example](ignored.md)\n2. continuation\n3. closing`",
    "` [example](ignored.md)\n2. continuation\n2. closing`",
    "` [example](ignored.md)\n#not-heading`",
    "` [example](ignored.md)\n+\nclosing`",
  ])
    for (const source of [text, text.replaceAll("\n", "\r\n")])
      assert.deepEqual(markdownLinks(source), [], source);
});

test("outdented blank quotes end list-contained fences and comments", () => {
  for (const opener of ["~~~", String.fromCharCode(96).repeat(3), "<!--"]) {
    const closer = opener === "<!--" ? "-->" : opener;
    assert.deepEqual(
      markdownLinks(
        "- > " +
          opener +
          "\n  > [example](ignored.md)\n>\n  > [broken](missing.md)",
      ),
      ["missing.md"],
      opener,
    );
    for (const text of [
      "- > " + opener + "\n  >\n  > [example](ignored.md)\n  > " + closer,
      "- \t> " + opener + "\n\t>\n\t> [example](ignored.md)\n\t> " + closer,
    ])
      assert.deepEqual(markdownLinks(text + "\n\n[real](owner.ts)"), [
        "owner.ts",
      ]);
  }
});

test("paragraph boundaries distinguish ASCII blanks, CRLF and Unicode paragraph text", () => {
  assert.deepEqual(
    markdownLinks("`[example](ignored.md)\n\u00a0\n` [real](owner.ts)"),
    ["owner.ts"],
  );
  for (const text of [
    "`code`\r\n    [broken](missing.md)",
    "` [broken](missing.md)\r\n\r\nclosing`",
    "` [broken](missing.md)\r\n\r\n> closing`",
    "- > ~~~\r\n  > [example](ignored.md)\r\n>\r\n  > [broken](missing.md)",
  ])
    assert.deepEqual(markdownLinks(text), ["missing.md"], text);
  assert.deepEqual(
    markdownLinks(
      "~~~\r\n\r\n[example](ignored.md)\r\n~~~\r\n[real](owner.ts)",
    ),
    ["owner.ts"],
  );
});

test("HTML comments hide only commented links, including an unfinished comment", () => {
  for (const text of [
    "[before](owner.ts) <!-- [example](ignored.md) --> [after](test.ts)",
    "[before](owner.ts)\n<!--\n[example](ignored.md)\n-->\n[after](test.ts)",
    "[before](owner.ts) <!-- [first](ignored.md) --> <!-- [second](ignored.md) --> [after](test.ts)",
    "[before](owner.ts) <!--> [after](test.ts)",
    "[before](owner.ts) <!---> [after](test.ts)",
    "[before](owner.ts) <!-- <!--> [after](test.ts)",
    "[before](owner.ts) <!-- <!---> [after](test.ts)",
  ])
    assert.deepEqual(markdownLinks(text), ["owner.ts", "test.ts"], text);
  assert.deepEqual(
    markdownLinks("[before](owner.ts)\n<!-- [example](ignored.md)"),
    ["owner.ts"],
  );
});

test("list padding keeps five-column residual indentation as code", () => {
  for (const marker of ["-", "1.", "123456789."])
    for (const padding of [" ", "  ", "   ", "    "])
      assert.deepEqual(markdownLinks(marker + padding + "[real](owner.ts)"), [
        "owner.ts",
      ]);
  for (const example of [
    "-     [example](ignored.md)\n      [continued](ignored.md)",
    "1.     [example](ignored.md)\n       [continued](ignored.md)",
    "-\t  [example](ignored.md)",
    "1.\t   [example](ignored.md)",
    "> -     [example](ignored.md)\n>       [continued](ignored.md)",
    "- parent\n  -     [example](ignored.md)",
    "- paragraph\n-     [example](ignored.md)",
    "intro\n-     [example](ignored.md)",
  ])
    for (const text of [example, example.replaceAll("\n", "\r\n")])
      assert.deepEqual(markdownLinks(text + "\n\n[real](owner.ts)"), [
        "owner.ts",
      ]);
});

test("type-one raw HTML blocks use exact bounded starts and whole closing lines", () => {
  for (const name of ["pre", "script", "style", "textarea"])
    for (const example of [
      "<" +
        name +
        ">\n[example](ignored.md)\n</" +
        name +
        "> [also](ignored.md)",
      "<" + name.toUpperCase() + "\n\n[example](ignored.md)\n</STYLE>",
      "<" + name + ">[example](ignored.md)</textarea> [also](ignored.md)",
      "> <" + name + ">\n> [example](ignored.md)\n> </" + name + ">",
      "- <" + name + ">\n  [example](ignored.md)\n  </" + name + ">",
    ])
      for (const text of [example, example.replaceAll("\n", "\r\n")])
        assert.deepEqual(markdownLinks(text + "\n\n[real](owner.ts)"), [
          "owner.ts",
        ]);
  assert.deepEqual(markdownLinks("<pre>\n[example](ignored.md)"), []);
  assert.deepEqual(
    markdownLinks(
      "<pre>\n~~~\n<!--\n[example](ignored.md)\n</script>\n[real](owner.ts)",
    ),
    ["owner.ts"],
  );
  assert.deepEqual(
    markdownLinks("<prex> [real](owner.ts) </prex>\n<pre/> [next](test.ts)"),
    ["owner.ts", "test.ts"],
  );
});

test("type-six raw HTML blocks end on container blanks rather than closing tags", () => {
  for (const example of [
    "<div>\n[example](ignored.md)\n</div>\n[also](ignored.md)",
    "<DIV class=x>\n[example](ignored.md)",
    "</table>\n[example](ignored.md)",
    "<section/> [example](ignored.md)",
    "<div>\n\u00a0\n[example](ignored.md)",
    "> <div>\n> [example](ignored.md)\n>\n> [real](owner.ts)",
    "- <div>\n  [example](ignored.md)\n\n  [real](owner.ts)",
  ])
    for (const source of [example, example.replaceAll("\n", "\r\n")])
      assert.deepEqual(
        markdownLinks(
          source.includes("[real]") ? source : source + "\n\n[real](owner.ts)",
        ),
        ["owner.ts"],
        source,
      );
  for (const name of ["address", "div", "h1", "search", "table", "ul"])
    assert.deepEqual(markdownLinks("<" + name + "\n[example](ignored.md)"), []);
  for (const source of [
    "<divide> [real](owner.ts)",
    "prefix <div> [real](owner.ts)",
    "\\<div>\n[real](owner.ts)",
    "    <div>\n\n[real](owner.ts)",
    "<pre>\n\n[example](ignored.md)\n</pre>\n[real](owner.ts)",
    "> <div>\n> [example](ignored.md)\n[real](owner.ts)",
  ])
    assert.deepEqual(markdownLinks(source), ["owner.ts"], source);
});

test("complete inline CDATA is literal while incomplete or escaped openers preserve prose", () => {
  for (const source of [
    "prefix <![CDATA[[example](ignored.md)]]> [real](owner.ts)",
    "prefix <![CDATA[first\n[example](ignored.md)]]> [real](owner.ts)",
    "prefix <![CDATA[<!-- `[example](ignored.md)]]> [real](owner.ts)",
    "[<![CDATA[[example](ignored.md)]]>label](owner.ts)",
    "prefix <![CDATA[[example](ignored.md)]]> [real](owner.ts) ]]>",
    "> prefix <![CDATA[first\n> [example](ignored.md)]]> [real](owner.ts)",
    "- prefix <![CDATA[first\n  [example](ignored.md)]]> [real](owner.ts)",
    "prefix <![CDATA[first\nlast]]>\n    [real](owner.ts)",
  ])
    for (const text of [source, source.replaceAll("\n", "\r\n")])
      assert.deepEqual(markdownLinks(text), ["owner.ts"], text);
  for (const source of [
    "prefix <![CDATA[ [real](owner.ts)",
    "prefix <![cdata[[real](owner.ts)]]>",
    "prefix \\<![CDATA[[real](owner.ts)]]>",
    "`<![CDATA[` [real](owner.ts) `]]>`",
    'prefix <a title="<![CDATA["> [real](owner.ts)',
    "prefix <![CDATA[first\n\n[real](owner.ts)]]>",
    "prefix <![CDATA[first\n> [real](owner.ts)]]>",
    "prefix <![CDATA[first\n~~~\n~~~\n[real](owner.ts)]]>",
  ])
    assert.deepEqual(markdownLinks(source), ["owner.ts"], source);
  assert.deepEqual(
    markdownLinks("prefix <![CDATA[code]]>\n    [real](owner.ts)"),
    ["owner.ts"],
  );
});

test("block CDATA persists to EOF or its first closing line within its container", () => {
  for (const source of [
    "<![CDATA[\n[example](ignored.md)",
    "<![CDATA[\n\n<!--\n~~~\n[example](ignored.md)",
    "<![CDATA[code]]>\n    [example](ignored.md)",
  ])
    assert.deepEqual(markdownLinks(source), [], source);
  for (const source of [
    "<![CDATA[\n[example](ignored.md)\n]]> [also](ignored.md)\n[real](owner.ts)",
    "<![CDATA[[example](ignored.md)]]> [also](ignored.md)\n[real](owner.ts)",
    "> <![CDATA[\n> [example](ignored.md)\n\n[real](owner.ts)",
    "- > <![CDATA[\n  > [example](ignored.md)\n>\n  > [real](owner.ts)",
    "- <![CDATA[\n  [example](ignored.md)\n[real](owner.ts)",
  ])
    for (const text of [source, source.replaceAll("\n", "\r\n")])
      assert.deepEqual(markdownLinks(text), ["owner.ts"], text);
});

test("raw inline tag attributes are opaque without changing actual link destinations", () => {
  for (const tag of [
    '<a title="[example](ignored.md)">',
    '<custom-tag title="greater > [example](ignored.md)">',
    "<a title='[example](ignored.md)' data-x=one/>",
    "<a title=[example](ignored.md)>",
    '<a\n title="[example](ignored.md)">',
    '<a title="first\n[example](ignored.md)">',
    '<a flag data-x \n = "[example](ignored.md)">',
    '<a flag data-x = \n "[example](ignored.md)">',
  ])
    for (const text of [tag, tag.replaceAll("\n", "\r\n")])
      assert.deepEqual(markdownLinks("prefix " + text + " [real](owner.ts)"), [
        "owner.ts",
      ]);
  for (const tag of [
    '<a 1x="[broken](missing.md)">',
    '<a title="[broken](missing.md)"data-x=one>',
    '<a title="[broken](missing.md)" / >',
  ])
    assert.deepEqual(markdownLinks("prefix " + tag + " [real](owner.ts)"), [
      "missing.md",
      "owner.ts",
    ]);
  assert.deepEqual(
    markdownLinks('[<b>x](c.md) [<b title="]">x](d.md) [a](<b c>)'),
    ["c.md", "d.md", "b c"],
  );
  assert.deepEqual(
    markdownLinks(
      'prefix <a title="first\n\n[broken](missing.md)"> [real](owner.ts)',
    ),
    ["missing.md", "owner.ts"],
  );
  for (const example of [
    '> <a\n> title="[example](ignored.md)">Help</a>',
    '- > <a\n  > title="[example](ignored.md)">Help</a>',
    '- \t> <a\n\t> title="[example](ignored.md)">Help</a>',
  ])
    for (const text of [example, example.replaceAll("\n", "\r\n")])
      assert.deepEqual(markdownLinks(text + "\n\n[real](owner.ts)"), [
        "owner.ts",
      ]);
});

test("HTML attribute delimiters respect existing code and comment precedence", () => {
  for (const text of [
    'prefix <a title="`">Help</a> [real](owner.ts) `',
    'prefix <a title="<!--">Help</a> [real](owner.ts)',
    '`before <a title="`"> [real](owner.ts)',
    '\\<a title="[broken](owner.ts)">',
  ])
    assert.deepEqual(markdownLinks(text), ["owner.ts"], text);
});

test("literal comment delimiters in code and escaped openers preserve real prose", () => {
  for (const text of [
    "`<!--` [real](owner.ts) `-->`",
    "``<!-- ` example`` [real](owner.ts)",
    "`<!--\n-->` [real](owner.ts)",
    "~~~\n<!--\n~~~\n[real](owner.ts)",
    "```\n<!--\n```\n[real](owner.ts)",
    "    <!--\n\n[real](owner.ts)",
    "\\<!-- [real](owner.ts) -->",
  ])
    assert.deepEqual(markdownLinks(text), ["owner.ts"], text);
});

test("inline code cannot pair across a fence opening on a later line", () => {
  const ticks = String.fromCharCode(96).repeat(3);
  assert.deepEqual(
    markdownLinks(
      "paragraph " +
        ticks +
        " [real](owner.ts)\n" +
        ticks +
        "\n[example](ignored.md)\n" +
        ticks,
    ),
    ["owner.ts"],
  );
});

test("commented code markers cannot hide links after the comment closes", () => {
  for (const marker of ["~~~", String.fromCharCode(96).repeat(3), "`", "``"])
    assert.deepEqual(
      markdownLinks(
        "<!--\n" + marker + "\n[example](ignored.md)\n-->\n[real](owner.ts)",
      ),
      ["owner.ts"],
      marker,
    );
  for (const text of [
    "> <!--\n> [example](ignored.md)\n\n> [real](owner.ts)",
    "- <!--\n  [example](ignored.md)\n\n[real](owner.ts)",
    "<!--\n~~~\n-->\n`<!--` [real](owner.ts) `-->`",
  ])
    assert.deepEqual(markdownLinks(text), ["owner.ts"], text);
});

test("link extraction requires an unescaped balanced label and retains image labels", () => {
  for (const text of [
    "](missing.md)",
    "\\[escaped](missing.md)",
    "[escaped\\](missing.md)",
  ])
    assert.deepEqual(markdownLinks(text), [], text);
  assert.deepEqual(
    markdownLinks(
      "[outer [nested]](owner.ts) ![image](asset.svg) [escaped \\[brackets\\]](test.ts)",
    ),
    ["owner.ts", "asset.svg", "test.ts"],
  );
  assert.deepEqual(markdownLinks("]() [later](next.md)"), ["next.md"]);
});

test("malformed Markdown delimiter runs finish within a real child-process deadline", () => {
  const moduleUrl = new URL("./check-guidance.mjs", import.meta.url).href;
  const script = `const { markdownLinks } = await import(${JSON.stringify(moduleUrl)});
const malformed = "](".repeat(1_000_000);
const unclosedParentheses = "](file(".repeat(200_000);
const labeledUnclosedParentheses = "[bad](file(".repeat(200_000);
const labeledOpenings = "[bad](".repeat(200_000);
const unclosedComments = "<!--".repeat(200_000);
const thematicWhitespace = "- ".repeat(500_000);
const unicodeFences = ["\\u2028", "\\u2029"].map(separator => String.fromCharCode(96).repeat(1_000_000) + separator);
for (const input of [malformed, unclosedParentheses, labeledUnclosedParentheses, labeledOpenings, unclosedComments, thematicWhitespace, ...unicodeFences])
  if (markdownLinks(input).length !== 0) process.exitCode = 1;
const commentedMarkers = "<!--\\n" + ("~~~\\n" + String.fromCharCode(96) + "[bad](missing.md)" + String.fromCharCode(96) + "\\n").repeat(50_000) + "-->\\n[good](owner.ts)";
const visible = markdownLinks(commentedMarkers);
if (visible.length !== 1 || visible[0] !== "owner.ts") process.exitCode = 1;
const nestedLists = Array.from({length: 512}, (_, index) => " ".repeat(index * 2) + "- item").join("\\n");
const tick = String.fromCharCode(96);
const lazyList = nestedLists + "\\n" + " ".repeat(1024) + tick + "[hidden](missing.md)" + "\\nlazy".repeat(100_000) + "\\nclosing" + tick + " [good](owner.ts)";
const lazyLinks = markdownLinks(lazyList);
if (lazyLinks.length !== 1 || lazyLinks[0] !== "owner.ts") process.exitCode = 1;
for (const marker of [String.fromCharCode(34), String.fromCharCode(39), "("]) {
  const malformedTitles = ("[bad](owner.ts " + marker + "unfinished ").repeat(50_000) + "[good](owner.ts)";
  const links = markdownLinks(malformedTitles);
  if (links.length !== 1 || links[0] !== "owner.ts") process.exitCode = 1;
}`;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", script],
    {
      encoding: "utf8",
      timeout: 5_000,
      windowsHide: true,
    },
  );
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
});

test("malformed raw HTML tags finish within a real child-process deadline", () => {
  const moduleUrl = new URL("./check-guidance.mjs", import.meta.url).href;
  const script = `const { markdownLinks } = await import(${JSON.stringify(moduleUrl)});
for (const malformedTag of ["<a title='".repeat(100_000), "<a data=".repeat(100_000)]) {
  const tagLinks = markdownLinks(malformedTag + " [good](owner.ts)");
  if (tagLinks.length !== 1 || tagLinks[0] !== "owner.ts") process.exitCode = 1;
}`;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", script],
    {
      encoding: "utf8",
      timeout: 5_000,
      windowsHide: true,
    },
  );
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
});

test("CDATA opener runs finish within a separate real child-process deadline", () => {
  const moduleUrl = new URL("./check-guidance.mjs", import.meta.url).href;
  const script = `const { markdownLinks } = await import(${JSON.stringify(moduleUrl)});
for (const text of ["prefix " + "<![CDATA[".repeat(100_000), "prefix " + "<![CDATA[".repeat(100_000) + "]]>", "prefix " + "]] >".repeat(100_000)]) {
  const links = markdownLinks(text + " [real](owner.ts)");
  if (links.length !== 1 || links[0] !== "owner.ts") process.exitCode = 1;
}`;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", script],
    {
      encoding: "utf8",
      timeout: 5_000,
      windowsHide: true,
    },
  );
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
});

test("guidance recognizes genuine canonical full execution without duplicating each check in CI", () => {
  assert.deepEqual(inspect(fixture()), []);
});

test("full membership comparison preserves the declared execution and settings order", () => {
  const state = fixture();
  state.manifest.checks.unshift({
    id: "lint-check",
    command: "npm run lint",
    kind: "required",
    ciJobs: ["check"],
    scopes: ["all"],
  });
  state.manifest.profiles.full.push("lint-check");
  state.settings.recommendedChecks.push("npm run lint");
  assert.deepEqual(inspect(state), []);
  assert.deepEqual(state.manifest.profiles.full, ["types", "lint-check"]);
  assert.deepEqual(state.settings.recommendedChecks, [
    "npm run typecheck",
    "npm run lint",
  ]);
});

test("guidance rejects omitted, repeated, unknown or advisory full entries", () => {
  for (const full of [[], ["types", "types"], ["ghost"], ["types", "lab"]]) {
    const state = fixture();
    state.manifest.profiles.full = full;
    assert.ok(inspect(state).length > 0, JSON.stringify(full));
  }
});

test("guidance rejects stale settings projections and discovery pointers", () => {
  const state = fixture();
  state.settings.recommendedChecks = ["npm run stale"];
  state.settings.recommendedChecksSource.profile = "focused";
  for (const name of ["navigation", "validation", "evaluation"])
    state.settings[name] = "missing.json";
  const errors = inspect(state).join("\n");
  for (const message of [
    "project",
    "canonical validation",
    "Settings navigation",
    "Settings validation",
    "Settings evaluation",
  ])
    assert.ok(errors.includes(message), message);
});

test("guidance rejects duplicate IDs, invalid definitions and false CI ownership", () => {
  for (const change of [
    (state) => state.manifest.checks.push(state.manifest.checks[0]),
    (state) => {
      state.manifest.checks[0].kind = "unknown";
    },
    (state) => {
      state.manifest.checks[0].ciJobs = [];
    },
    (state) => {
      state.manifest.checks[1].ciJobs = ["check"];
    },
    (state) => {
      state.manifest.profiles.guidance = ["missing"];
    },
  ]) {
    const state = fixture();
    change(state);
    assert.ok(inspect(state).length > 0);
  }
  assert.deepEqual(validateManifest({}, {}, {}), [
    "Invalid validation manifest schema",
  ]);
});

test("guidance delegates blocking canonical execution to both trusted workflow validators", () => {
  for (const owner of ["ci", "sonar"]) {
    for (const mode of ["omitted", "conditional", "advisory", "repeated"]) {
      const state = fixture();
      const job = Object.values(state[owner].jobs)[0];
      const full = job.steps.find(
        (step) => step.run === "npm run validate -- full",
      );
      if (mode === "omitted")
        job.steps = job.steps.filter((step) => step !== full);
      if (mode === "conditional") full.if = "always()";
      if (mode === "advisory") full["continue-on-error"] = true;
      if (mode === "repeated") job.steps.push({ ...full });
      assert.ok(
        inspect(state).some((error) => error.includes("execution policy")),
        owner + mode,
      );
    }
  }
});

const taskFixture = () => ({
  navigation: {
    schemaVersion: 1,
    tasks: [
      {
        id: "account",
        when: "Change profile",
        owners: ["owner.ts"],
        contracts: [],
        tests: ["test.ts"],
        checks: ["types"],
      },
    ],
  },
  evaluation: {
    schemaVersion: 1,
    cases: [
      {
        id: "profile",
        prompt: { en: "Explain" },
        taskIds: ["account"],
        evidence: ["owner.ts"],
        mustExplain: ["HTTP ownership"],
        mustNot: ["Import persistence"],
        checks: ["types"],
      },
    ],
  },
});
test("navigation and evaluation require real source paths, English prompts and registered checks", () => {
  const { navigation, evaluation } = taskFixture();
  const exists = (filename) => ["owner.ts", "test.ts"].includes(filename);
  assert.deepEqual(
    validateNavigation(navigation, evaluation, new Set(["types"]), exists),
    [],
  );
  navigation.tasks[0].owners = ["missing.ts"];
  evaluation.cases[0].prompt.fa = "";
  evaluation.cases[0].taskIds = ["unknown"];
  evaluation.cases[0].checks = ["missing-check"];
  const errors = validateNavigation(
    navigation,
    evaluation,
    new Set(["types"]),
    exists,
  ).join("\n");
  for (const message of [
    "missing.ts",
    "English-only",
    "task reference",
    "missing-check",
  ])
    assert.ok(errors.includes(message), message);
});

test("navigation rejects malformed schemas, duplicate tasks and empty source criteria", () => {
  const { navigation, evaluation } = taskFixture();
  navigation.tasks.push({
    ...navigation.tasks[0],
    when: "",
    owners: [],
    contracts: null,
    checks: null,
  });
  evaluation.cases.push({
    ...evaluation.cases[0],
    evidence: [],
    mustExplain: [],
    mustNot: [],
  });
  const errors = validateNavigation(
    navigation,
    evaluation,
    new Set(["types"]),
    () => true,
  ).join("\n");
  for (const message of [
    "unique",
    "task trigger",
    "no owner",
    "Invalid paths",
    "Invalid checks",
    "source evidence",
    "positive/negative",
  ])
    assert.ok(errors.includes(message), message);
  assert.deepEqual(
    validateNavigation({}, evaluation, new Set(), () => true),
    ["Invalid navigation schema"],
  );
  assert.deepEqual(
    validateNavigation(navigation, {}, new Set(), () => true),
    ["Invalid evaluation schema"],
  );
});

const createFixture = async (context) => {
  const container = await mkdtemp(path.join(tmpdir(), "kernel-guidance-test-"));
  const root = path.join(container, "project");
  await mkdir(root);
  context.after(async () => {
    assert.equal(path.dirname(container), path.resolve(tmpdir()));
    assert.ok(path.basename(container).startsWith("kernel-guidance-test-"));
    await rm(container, { recursive: true, force: true });
  });
  const write = async (filename, content) => {
    const target = path.join(root, filename);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  };
  const json = (filename, value) => write(filename, JSON.stringify(value));
  const state = fixture(),
    { navigation, evaluation } = taskFixture();
  await Promise.all([
    json(".agents/validation.json", state.manifest),
    json(".agents/settings.json", state.settings),
    json(".agents/navigation.json", navigation),
    json(".agents/evaluation/cases.json", evaluation),
    json("package.json", {
      name: "guidance-fixture",
      scripts: { typecheck: "tsc", lighthouse: "node lab.mjs" },
    }),
    json("package-lock.json", {
      name: "guidance-fixture",
      packages: { "": {} },
    }),
    write(".github/workflows/ci.yml", stringify(state.ci)),
    write(".github/workflows/sonar.yml", stringify(state.sonar)),
    write("AGENTS.md", "# Guide\n"),
    write("owner.ts", "// synthetic\n"),
    write("test.ts", "// synthetic\n"),
  ]);
  for (const name of [
    "source-navigation",
    "validation",
    "comprehension-evaluation",
  ])
    for (const suffix of [".md", ".fa.md"])
      await write("docs/" + name + suffix, "# Guide\n");
  return { root, container, write, json, state, navigation, evaluation };
};

test("current guidance paths, instruction entrypoints and canonical matrix agree", async () => {
  const result = await checkGuidance();
  assert.ok(result.tasks > 0);
  assert.ok(result.cases > 0);
  assert.deepEqual(result.errors, []);
});

test("host adapters are optional but existing links and English-only instruction files are checked", async (context) => {
  const { root, write } = await createFixture(context);
  assert.deepEqual((await checkGuidance(root)).errors, []);
  const adapter = ".claude/skills/design/SKILL.md";
  await write(adapter, "[Local guide](../../../AGENTS.md)\n");
  assert.deepEqual((await checkGuidance(root)).errors, []);
  for (const link of [
    "../../../missing.md",
    "../../../../outside.md",
    "../../../.env.local",
    "../../../bad%ZZ.md",
  ]) {
    await write(adapter, `[Invalid guide](${link})\n`);
    assert.ok(
      (await checkGuidance(root)).errors.some((error) =>
        error.includes("guide link"),
      ),
      link,
    );
  }
  await write(adapter, "[Local guide](../../../AGENTS.md)\n");
  for (const translated of [
    ".agents/rules/example.fa.md",
    ".claude/skills/design/SKILL.fa.md",
    "AGENTS.fa.md",
  ]) {
    await write(translated, "# Guide\n");
    assert.ok(
      (await checkGuidance(root)).errors.some((error) =>
        error.includes("English only"),
      ),
    );
    await rm(path.join(root, translated));
  }
});

test("maintained guides accept real titled and parenthesized targets", async (context) => {
  const { root, write } = await createFixture(context);
  await write("docs/file(name).md", "# Synthetic target\n");
  await write("docs/file (name).md", "# Synthetic spaced target\n");
  await write(
    "docs/source-navigation.md",
    [
      "[balanced](file(name).md)",
      "[escaped](file\\(name\\).md)",
      '[titled](file(name).md "A title")',
      "[single](file(name).md 'A title')",
      '[angle](<file (name).md> "A title")',
      "`[example](missing-inline.md)`",
      "~~~markdown",
      "[example](missing-fenced.md)",
      "~~~",
      "[real](../owner.ts)",
    ].join("\n"),
  );
  assert.deepEqual((await checkGuidance(root)).errors, []);
});

test("local query targets and case-insensitive external schemes resolve correctly", async (context) => {
  const { root, write } = await createFixture(context);
  await write("docs/guide.md", "# Synthetic target\n");
  await write(
    "docs/source-navigation.md",
    [
      "[query](guide.md?plain=1#section)",
      "[fragment](guide.md#section?literal)",
      "[https](HTTPS://example.test/guide)",
      "[mail](Mailto:guide@example.invalid)",
      "[host](Codex://example)",
    ].join("\n"),
  );
  assert.deepEqual((await checkGuidance(root)).errors, []);
});

test("only the three reviewed public environment templates are valid guide targets", async (context) => {
  const { root, write } = await createFixture(context);
  for (const filename of [
    ".env.example",
    "deploy/docker/.env.example",
    "deploy/native/hosts.env.example",
  ]) {
    await write(filename, "SYNTHETIC_PUBLIC_TEMPLATE=true\n");
    await write(
      "docs/source-navigation.md",
      "[template](../" + filename + ")\n",
    );
    assert.deepEqual((await checkGuidance(root)).errors, [], filename);
  }
  for (const filename of [
    "docs/.env.example",
    "docs/.env.local.md",
    "deploy/native/api.env.example",
    "deploy/native/hosts.env.example.md",
    "deploy/native/hosts.env.local",
    "deploy/native/HOSTS.ENV.EXAMPLE",
    "deploy/docker/.env.example.backup",
    "deploy/docker/.env/README.md",
  ]) {
    await write(filename, "[sentinel](unread-target.md)\n");
    await write(
      "docs/source-navigation.md",
      "[private](../" + filename + ")\n",
    );
    const errors = (await checkGuidance(root)).errors;
    assert.ok(
      errors.includes(
        "Unsafe guide link: docs/source-navigation.md: ../" + filename,
      ),
      filename,
    );
    assert.ok(
      !errors.some((error) => error.includes("unread-target.md")),
      filename,
    );
  }
});

test("public deployment Markdown joins maintained links without following symbolic targets", async (context) => {
  const { root, write } = await createFixture(context);
  await write(
    "deploy/docker/README.md",
    "[فارسی](README.fa.md) [owner](../../owner.ts)\n",
  );
  await write(
    "deploy/docker/README.fa.md",
    "[English](README.md) [owner](../../owner.ts)\n",
  );
  assert.deepEqual((await checkGuidance(root)).errors, []);
  await write("deploy/docker/README.fa.md", "[broken](missing.md)\n");
  assert.ok(
    (await checkGuidance(root)).errors.includes(
      "Missing or unsafe guide link: deploy/docker/README.fa.md: missing.md",
    ),
  );
  await write("server/data/never-read.md", "[sentinel](unread-target.md)\n");
  await symlink(
    path.join(root, "server/data"),
    path.join(root, "deploy/alias"),
    "junction",
  );
  const errors = (await checkGuidance(root)).errors.join("\n");
  assert.match(errors, /Symbolic guidance path: deploy\/alias/);
  assert.ok(!errors.includes("unread-target.md"));
});

test("unsafe existing destinations fail for safety while missing targets retain missing diagnostics", async (context) => {
  const { root, container, write } = await createFixture(context);
  await write(".env.local", "SYNTHETIC_UNREAD_SECRET_FIXTURE\n");
  await writeFile(
    path.join(container, "outside.md"),
    "# Synthetic owned outside target\n",
  );
  for (const destination of [
    "../.env.local",
    "../.env.local?plain=1",
    "../../outside.md",
  ]) {
    for (const text of [
      '[bad](owner.ts "unfinished\n[unsafe](' + destination + ' "A title")\n',
      "`code`\n    [unsafe](" + destination + ")\n",
      "` [unsafe](" + destination + ")\n\n> closing`\n",
      "- > ~~~\n  > [example](ignored.md)\n>\n  > [unsafe](" +
        destination +
        ")\n",
      "<pre>\n[example](ignored.md)\n</pre>\n[unsafe](" + destination + ")\n",
      'prefix <a title="[example](ignored.md)"> [unsafe](' +
        destination +
        ")\n",
      'prefix <a 1x="[unsafe](' + destination + ')">\n',
      "<div>\n[example](ignored.md)\n</div>\n\n[unsafe](" + destination + ")\n",
      "prefix <![CDATA[[example](ignored.md)]]> [unsafe](" +
        destination +
        ")\n",
    ]) {
      await write("docs/source-navigation.md", text);
      assert.ok(
        (await checkGuidance(root)).errors.includes(
          "Unsafe guide link: docs/source-navigation.md: " + destination,
        ),
        text,
      );
    }
  }
  await write("docs/source-navigation.md", "[missing](missing(name).md)\n");
  assert.ok(
    (await checkGuidance(root)).errors.includes(
      "Missing or unsafe guide link: docs/source-navigation.md: missing(name).md",
    ),
  );
});

test("missing indexed paths, scripts and obsolete package containers fail validation", async (context) => {
  const { root, json, state } = await createFixture(context);
  state.settings.rules = [".agents/missing.md", ".env.local"];
  await json(".agents/settings.json", state.settings);
  await json("package.json", { name: "guidance-fixture", scripts: {} });
  await mkdir(path.join(root, "apps"));
  const errors = (await checkGuidance(root)).errors.join("\n");
  for (const message of [
    "missing/unsafe",
    "no package script",
    "Obsolete project container",
  ])
    assert.ok(errors.includes(message), message);
});

test("parallel guidance inspection reports files and link failures in deterministic order", async (context) => {
  const { root, write } = await createFixture(context);
  await Promise.all([
    write(
      ".agents/rules/ordered.md",
      "[first](missing-b.md) [second](missing-a.md)\n",
    ),
    write(".claude/skills/example/SKILL.md", "[third](missing-c.md)\n"),
    write("docs/ordered.md", "[fourth](missing-d.md) [fifth](missing-e.md)\n"),
  ]);
  const first = await checkGuidance(root);
  const second = await checkGuidance(root);
  assert.deepEqual(first.errors, second.errors);
  assert.deepEqual(first.errors, [
    "Missing or unsafe guide link: .agents/rules/ordered.md: missing-b.md",
    "Missing or unsafe guide link: .agents/rules/ordered.md: missing-a.md",
    "Missing or unsafe guide link: .claude/skills/example/SKILL.md: missing-c.md",
    "Missing or unsafe guide link: docs/ordered.md: missing-d.md",
    "Missing or unsafe guide link: docs/ordered.md: missing-e.md",
  ]);
});

test("symbolic documentation directories are rejected without reading target prose", async (context) => {
  const { root, write, json, navigation } = await createFixture(context);
  await write("server/data/never-read.md", "[sentinel](unread-target.md)\n");
  await symlink(
    path.join(root, "server/data"),
    path.join(root, "docs/alias"),
    "junction",
  );
  navigation.tasks[0].owners = ["docs/alias/never-read.md"];
  await json(".agents/navigation.json", navigation);
  const errors = (await checkGuidance(root)).errors.join("\n");
  assert.match(errors, /Symbolic guidance path/);
  assert.match(errors, /missing\/unsafe/);
  assert.ok(!errors.includes("unread-target.md"));
});

test("symbolic essential configuration is rejected before parsing outside JSON", async (context) => {
  const { root, write } = await createFixture(context);
  const outside = await mkdtemp(path.join(tmpdir(), "kernel-guidance-test-"));
  context.after(async () => {
    assert.equal(path.dirname(outside), path.resolve(tmpdir()));
    assert.ok(path.basename(outside).startsWith("kernel-guidance-test-"));
    await rm(outside, { recursive: true, force: true });
  });
  for (const name of [
    "validation.json",
    "settings.json",
    "navigation.json",
    "evaluation/cases.json",
  ]) {
    await mkdir(path.dirname(path.join(outside, name)), { recursive: true });
    await writeFile(path.join(outside, name), "UNREAD_OUTSIDE_JSON");
  }
  await rename(path.join(root, ".agents"), path.join(root, "original-agents"));
  await symlink(outside, path.join(root, ".agents"), "junction");
  await assert.rejects(checkGuidance(root), /escapes safe source/);
  assert.equal(
    await readFile(path.join(outside, "validation.json"), "utf8"),
    "UNREAD_OUTSIDE_JSON",
  );
  await write("README.md", "# Synthetic fixture\n");
});

test("guidance indexes reject traversal, private state, credentials and generated dependencies", () => {
  for (const value of [
    "../kernel/AGENTS.md",
    "C:/private/key",
    ".env.local",
    "src/.env.production",
    "docs/.env.example",
    "deploy/native/api.env.example",
    "deploy/native/hosts.env.local",
    "deploy/native/HOSTS.ENV.EXAMPLE",
    "deploy/docker/.env.example.backup",
    "server/data/test.sqlite",
    "node_modules/pkg/index.js",
    ".git/config",
    ".next/server.js",
    "coverage/report.md",
    "dist/index.md",
    "reports/run.md",
    ".agents/settings.local.json",
    "private.pem",
    "private.key",
  ])
    assert.equal(isSafeGuidancePath(value), false, value);
  for (const value of [
    "src/index.ts",
    "src/contracts/index.ts",
    ".env.example",
    "deploy/docker/.env.example",
    "deploy/native/hosts.env.example",
  ])
    assert.equal(isSafeGuidancePath(value), true, value);
});

test("standalone manifest and lockfile reject local links, workspaces and dependency drift", () => {
  assert.deepEqual(
    validateStandaloneManifest({
      name: "project",
      scripts: { build: "tsc" },
      dependencies: { axios: "1.20.0" },
    }),
    [],
  );
  const errors = validateStandaloneManifest({
    workspaces: [],
    dependencies: { "@kernel/contracts": "*", outside: "file:../kernel" },
    devDependencies: { local: "workspace:*", linked: "link:../shared" },
    scripts: { test: "npm run test --workspace=other" },
  });
  assert.equal(errors.length, 6);
  const pkg = { name: "project", dependencies: { axios: "1.20.0" } },
    lock = {
      name: "project",
      packages: { "": { dependencies: pkg.dependencies } },
    };
  assert.deepEqual(validateStandaloneLockfile(lock, pkg), []);
  lock.packages[""].dependencies = { axios: "0.0.0" };
  lock.packages["apps/old"] = {};
  lock.packages["node_modules/local"] = { link: true };
  assert.equal(validateStandaloneLockfile(lock, pkg).length, 3);
  assert.ok(
    validateStandaloneLockfile({}, pkg).some((error) =>
      error.includes("root project"),
    ),
  );
});
