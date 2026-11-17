import { lstat, rename } from "node:fs/promises";
import path from "node:path";

// Callers exclusively own the canonical parent and newly created workspace.
// Move the entry itself so later access does not resolve through the public path.
export async function withOwnedBuildDirectory({
  build,
  workspace,
  information,
  run,
}) {
  const owned = path.join(workspace, "build");
  const failures = [];
  let claimed = false,
    result,
    recoveryDirectory;
  try {
    await rename(build, owned);
    claimed = true;
    const moved = await lstat(owned, { bigint: true });
    if (
      !moved.isDirectory() ||
      moved.dev !== information.dev ||
      moved.ino !== information.ino
    )
      throw Object.assign(
        new Error("Build directory changed while acquiring ownership."),
        { code: "ESTALE" },
      );

    result = await run(owned);
  } catch (error) {
    failures.push(error);
  }
  if (claimed) {
    try {
      let existing;
      try {
        existing = await lstat(build);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      if (existing)
        throw Object.assign(new Error("Build path is occupied."), {
          code: "EEXIST",
        });

      await rename(owned, build);
    } catch (error) {
      recoveryDirectory = owned;
      failures.push(
        Object.assign(
          new Error(`Build preserved for recovery at ${owned}.`, {
            cause: error,
          }),
          { code: error.code, recoveryDirectory },
        ),
      );
    }
  }
  if (failures.length > 1)
    throw Object.assign(
      new AggregateError(failures, "Build operation and restoration failed.", {
        cause: failures[0],
      }),
      { recoveryDirectory },
    );

  if (failures.length) throw failures[0];

  return result;
}
