import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import {
  isSafeGuidancePath,
  markdownLinks,
  validateManifest,
  validateNavigation,
  validateStandaloneLockfile,
  validateStandaloneManifest,
} from "./check-guidance.mjs";
import {
  fixture,
  inspect,
  phaseFixture,
  taskFixture,
} from "./check-guidance.test-support.mjs";

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

test("malformed Markdown delimiter runs finish in a separate child process", () => {
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
      windowsHide: true,
    },
  );
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
});

test("malformed raw HTML tags finish in a separate child process", () => {
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
      windowsHide: true,
    },
  );
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
});

test("CDATA opener runs finish in a separate child process", () => {
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
      windowsHide: true,
    },
  );
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
});

test("guidance recognizes genuine canonical full execution without duplicating each check in CI", () => {
  assert.deepEqual(inspect(fixture()), []);
});

for (const [phase, count] of [
  ["repository-foundation", 10],
  ["storybook-verification", 12],
  ["application-verification", 17],
])
  test(`guidance enforces the ${phase} required-check contract`, () => {
    const state = phaseFixture(phase);
    assert.equal(state.manifest.profiles.full.length, count);
    assert.deepEqual(inspect(state), []);
    const omitted = structuredClone(state);
    const removed = omitted.manifest.profiles.full.pop();
    omitted.manifest.checks = omitted.manifest.checks.filter(
      ({ id }) => id !== removed,
    );
    omitted.settings.recommendedChecks.pop();
    assert.match(inspect(omitted).join("\n"), /declared publication phase/);
    const changed = structuredClone(state);
    changed.manifest.checks[0].command = "npm run unrelated";
    changed.settings.recommendedChecks[0] = "npm run unrelated";
    assert.match(inspect(changed).join("\n"), /declared publication phase/);
  });

test("normalized guidance rejects undeclared phases and false application readiness", () => {
  for (const change of [
    (manifest) => {
      manifest.phase = "unreviewed-phase";
    },
    (manifest) => {
      manifest.applicationReady = true;
    },
  ]) {
    const state = phaseFixture("repository-foundation");
    change(state.manifest);
    assert.match(inspect(state).join("\n"), /Validation publication phase/);
  }
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

test("guidance indexes reject traversal, private state, credentials and generated dependencies", () => {
  for (const value of [
    "../external-project/AGENTS.md",
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
    "deploy/docker/compose.env.example",
    "deploy/native/nginx.env.example",
  ])
    assert.equal(isSafeGuidancePath(value), true, value);
});

test("standalone manifest and lockfile reject local links, workspaces and dependency drift", () => {
  assert.deepEqual(
    validateStandaloneManifest({
      name: "project",
      scripts: { build: "tsc" },
      dependencies: { "@example/contracts": "^1.0.0", axios: "1.20.0" },
    }),
    [],
  );
  const errors = validateStandaloneManifest({
    workspaces: [],
    dependencies: {
      contracts: "github:example/contracts",
      outside: "file:../source",
    },
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

test("standalone dependencies use registry versions regardless of package scope", () => {
  for (const field of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ]) {
    assert.deepEqual(
      validateStandaloneManifest({
        [field]: { "@example/contracts": "~1.2.3" },
      }),
      [],
    );
    for (const version of [
      "",
      " ",
      null,
      "file:../source",
      "link:../source",
      "workspace:*",
      "github:example/source",
      "git+https://example.test/source.git",
      "https://example.test/source.tgz",
      "npm:external-source@1.0.0",
    ])
      assert.equal(
        validateStandaloneManifest({ [field]: { external: version } }).length,
        1,
        `${field}: ${version}`,
      );
  }
});
