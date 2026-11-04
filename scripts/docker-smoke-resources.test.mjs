import assert from "node:assert/strict";
import { test } from "node:test";

import { fixture } from "./docker-smoke-resources.test-support.mjs";

test("successful Docker fixtures remove only their container, image, builder cache and temporary directory", async () => {
  const fixtureValue = await fixture();
  await fixtureValue.run(async ({ builder }) => {
    assert.match(builder, /^kernel-admin-smoke-/);
    fixtureValue.state.image = true;
    fixtureValue.state.container = true;
  });
  assert.deepEqual(fixtureValue.state, {
    builder: false,
    image: false,
    container: false,
  });
  assert.equal(
    fixtureValue.attempts.some((args) =>
      /prune|--use|--keep-state|buildx ls/.test(args),
    ),
    false,
  );
  assert.ok(
    fixtureValue.attempts.some((args) =>
      args.includes("--driver docker-container --driver-opt default-load=true"),
    ),
  );
  await fixtureValue.cleaned();
});

test("a failed build still deletes its dedicated builder and partial image", async () => {
  const fixtureValue = await fixture();
  await assert.rejects(
    fixtureValue.run(async () => {
      fixtureValue.state.image = true;
      throw new Error("Synthetic failed build");
    }),
    /Synthetic failed build/,
  );
  assert.deepEqual(fixtureValue.state, {
    builder: false,
    image: false,
    container: false,
  });
  await fixtureValue.cleaned();
});

test("one cleanup failure does not suppress the test failure or stop remaining cleanup", async () => {
  const fixtureValue = await fixture({ removalFailure: true });
  await assert.rejects(
    fixtureValue.run(async () => {
      fixtureValue.state.image = true;
      fixtureValue.state.container = true;
      throw new Error("Synthetic test failure");
    }),
    (error) => {
      assert.ok(error instanceof AggregateError);
      assert.match(error.errors[0].message, /Synthetic test failure/);
      assert.match(
        error.errors[1].message,
        /Synthetic container removal failure/,
      );
      return true;
    },
  );
  assert.deepEqual(fixtureValue.state, {
    builder: false,
    image: false,
    container: true,
  });
  await fixtureValue.cleaned();
});

test("SIGINT aborts active Docker work and permits non-aborted cleanup", async () => {
  const fixtureValue = await fixture();
  await assert.rejects(
    fixtureValue.run(async ({ docker }) => {
      fixtureValue.state.image = true;
      fixtureValue.state.container = true;
      const pending = docker(["wait-for-interrupt"]);
      fixtureValue.signals.emit("SIGINT");
      await pending;
    }),
    /interrupted by SIGINT/,
  );
  assert.deepEqual(fixtureValue.state, {
    builder: false,
    image: false,
    container: false,
  });
  await fixtureValue.cleaned();
});

test("an existing resource name is never claimed or removed", async () => {
  const fixtureValue = await fixture({ preexisting: true });
  await assert.rejects(
    fixtureValue.run(async () => assert.fail("Body must not run")),
    /must not already exist/,
  );
  assert.equal(fixtureValue.state.builder, true);
  assert.equal(
    fixtureValue.attempts.some((args) => args.includes(" rm ")),
    false,
  );
  await fixtureValue.cleaned();
});

test("unexpected builder metadata errors fail closed without running a build", async () => {
  const fixtureValue = await fixture({ inspectFailure: true });
  await assert.rejects(
    fixtureValue.run(async () => assert.fail("Body must not run")),
    /Synthetic builder metadata error/,
  );
  assert.equal(fixtureValue.state.builder, false);
  await fixtureValue.cleaned();
});

test("a final image export during builder shutdown is still removed after a failed test", async () => {
  const fixtureValue = await fixture({ lateExport: true });
  await assert.rejects(
    fixtureValue.run(async () => {
      fixtureValue.state.container = true;
      throw new Error("Synthetic interrupted export");
    }),
    /Synthetic interrupted export/,
  );
  assert.deepEqual(fixtureValue.state, {
    builder: false,
    image: false,
    container: false,
  });
  await fixtureValue.cleaned();
});

test("non-Error callback rejections are preserved even when their value is undefined", async () => {
  const fixtureValue = await fixture();
  let rejected = false;
  try {
    await fixtureValue.run(async () => {
      throw undefined;
    });
  } catch (error) {
    rejected = true;
    assert.equal(error, undefined);
  }
  assert.equal(rejected, true);
  await fixtureValue.cleaned();
});

test("cleanup never passes malformed container identifiers to a removal command", async () => {
  const fixtureValue = await fixture({ containerId: "--all\n" });
  await assert.rejects(
    fixtureValue.run(async () => {
      fixtureValue.state.container = true;
      fixtureValue.state.image = true;
    }),
    AggregateError,
  );
  assert.equal(
    fixtureValue.attempts.some((attempt) => attempt.startsWith("container rm")),
    false,
  );
  assert.ok(
    fixtureValue.attempts.some((attempt) => attempt.startsWith("buildx rm")),
  );
  assert.ok(
    fixtureValue.attempts.some((attempt) => attempt.startsWith("image rm")),
  );
  await fixtureValue.cleaned();
});

for (const option of ["preexistingImage", "preexistingContainer"])
  test(`an existing ${option} is not claimed or removed`, async () => {
    const fixtureValue = await fixture({ [option]: true });
    await assert.rejects(
      fixtureValue.run(async () => assert.fail("Must not run")),
      /must not already exist/,
    );
    assert.equal(
      fixtureValue.attempts.some((attempt) =>
        /^(?:container|image|buildx) rm/.test(attempt),
      ),
      false,
    );
    await fixtureValue.cleaned();
  });
