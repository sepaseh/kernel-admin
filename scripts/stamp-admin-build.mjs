import { constants } from "node:fs";
import {
  lstat,
  mkdir,
  mkdtemp,
  open,
  realpath,
  rename,
  rmdir,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { withOwnedBuildDirectory } from "./build-directory.mjs";
import {
  validateBasePath,
  validateOrigin,
  validateReleaseId,
} from "./validate-deployment-env.mjs";

export function createBuildMetadata(environment) {
  validateOrigin(environment.VITE_API_BASE_URL);
  return {
    schemaVersion: 1,
    releaseId: validateReleaseId(environment.VITE_RELEASE_ID),
    basePath: validateBasePath(environment.VITE_APP_BASE_URL),
    apiOrigin: environment.VITE_API_BASE_URL,
  };
}

async function requireCompletedBuild(entry, openEntry) {
  const information = await lstat(entry, { bigint: true });
  if (!information.isFile())
    throw new Error(
      "A completed HTML build is required before stamping metadata.",
    );

  const handle = await openEntry(
    entry,
    constants.O_RDONLY |
      (constants.O_NOFOLLOW ?? 0) |
      (constants.O_NONBLOCK ?? 0),
  );
  try {
    const opened = await handle.stat({ bigint: true });
    const current = await lstat(entry, { bigint: true });
    if (
      !opened.isFile() ||
      !current.isFile() ||
      information.dev !== opened.dev ||
      information.ino !== opened.ino ||
      opened.dev !== current.dev ||
      opened.ino !== current.ino ||
      !/<html(?:\s|>)/i.test(await handle.readFile("utf8"))
    )
      throw new Error(
        "A completed HTML build is required before stamping metadata.",
      );
  } finally {
    await handle.close();
  }
}

async function requireMissingMetadataDirectory(build) {
  let existing;
  try {
    existing = await lstat(path.join(build, "_kernel"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (existing) {
    if (existing.isSymbolicLink() || !existing.isDirectory())
      throw Object.assign(
        new Error("Build metadata directory must remain inside the build."),
        { code: "ESTALE" },
      );

    throw Object.assign(new Error("Build metadata identity already exists."), {
      code: "EEXIST",
    });
  }
}

async function publishBuildMetadata(build, information, contents, operations) {
  const staging = await mkdtemp(
    path.join(path.dirname(build), ".kernel-build-"),
  );
  const identity = path.join(staging, "identity");
  const temporary = path.join(identity, "build.json");
  const failures = [];
  let directoryOwned = false,
    fileOwned = false,
    published = false;
  try {
    await mkdir(identity);
    directoryOwned = true;
    const handle = await operations.openFile(temporary, "wx");
    fileOwned = true;
    try {
      await handle.writeFile(contents);
    } catch (error) {
      failures.push(error);
    }
    try {
      await handle.close();
    } catch (error) {
      failures.push(error);
    }
    if (!failures.length) {
      await withOwnedBuildDirectory({
        build,
        workspace: staging,
        information,
        run: async (owned) => {
          await requireCompletedBuild(
            path.join(owned, "index.html"),
            operations.openEntry,
          );
          await requireMissingMetadataDirectory(owned);
          await operations.publishDirectory(
            identity,
            path.join(owned, "_kernel"),
          );
          published = true;
        },
      });
    }
  } catch (error) {
    failures.push(error);
  }
  if (!published && fileOwned) {
    try {
      await operations.removeFile(temporary);
    } catch (error) {
      failures.push(error);
    }
  }
  if (!published && directoryOwned) {
    try {
      await operations.removeDirectory(identity);
    } catch (error) {
      failures.push(error);
    }
  }
  if (!failures.some((error) => error.recoveryDirectory)) {
    try {
      await operations.removeDirectory(staging);
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length > 1)
    throw Object.assign(
      new AggregateError(
        failures,
        "Build metadata publication or owned cleanup failed.",
        {
          cause: failures[0],
        },
      ),
      {
        recoveryDirectory: failures.find((error) => error.recoveryDirectory)
          ?.recoveryDirectory,
      },
    );

  if (failures.length) throw failures[0];
}

export async function stampAdminBuild({
  environment,
  buildDirectory = path.resolve("dist"),
  openEntry = open,
  openFile = open,
  publishDirectory = rename,
  removeFile = unlink,
  removeDirectory = rmdir,
}) {
  const metadata = createBuildMetadata(environment);
  const requested = path.resolve(buildDirectory);
  const information = await lstat(requested, { bigint: true });
  if (!information.isDirectory())
    throw new Error("Build output must be an ordinary directory.");
  const build = path.join(
    await realpath(path.dirname(requested)),
    path.basename(requested),
  );
  await publishBuildMetadata(
    build,
    information,
    `${JSON.stringify(metadata, null, 2)}\n`,
    {
      openEntry,
      openFile,
      publishDirectory,
      removeFile,
      removeDirectory,
    },
  );
  return metadata;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    await stampAdminBuild({ environment: process.env });
  } catch (error) {
    console.error(error.message);
    if (error.recoveryDirectory)
      console.error(`Preserved build: ${error.recoveryDirectory}`);
    process.exitCode = 1;
  }
}
