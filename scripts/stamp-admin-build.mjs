import {
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  realpath,
  rename,
  rmdir,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

async function publishBuildMetadata(build, contents, operations) {
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
      await operations.publishDirectory(identity, path.join(build, "_kernel"));
      published = true;
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
  try {
    await operations.removeDirectory(staging);
  } catch (error) {
    failures.push(error);
  }
  if (failures.length > 1)
    throw new AggregateError(
      failures,
      "Build metadata publication or owned cleanup failed.",
      {
        cause: failures[0],
      },
    );

  if (failures.length) throw failures[0];
}

export async function stampAdminBuild({
  environment,
  buildDirectory = path.resolve("dist"),
  openFile = open,
  publishDirectory = rename,
  removeFile = unlink,
  removeDirectory = rmdir,
}) {
  const metadata = createBuildMetadata(environment);
  const requested = path.resolve(buildDirectory);
  const build = await realpath(requested);
  if (
    (await lstat(requested)).isSymbolicLink() ||
    !(await lstat(build)).isDirectory()
  )
    throw new Error("Build output must be an ordinary directory.");
  const entry = path.join(build, "index.html"),
    information = await lstat(entry);
  if (
    !information.isFile() ||
    information.isSymbolicLink() ||
    !/<html(?:\s|>)/i.test(await readFile(entry, "utf8"))
  )
    throw new Error(
      "A completed HTML build is required before stamping metadata.",
    );
  let existing;
  try {
    existing = await lstat(path.join(build, "_kernel"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (existing) {
    if (existing.isSymbolicLink() || !existing.isDirectory())
      throw new Error("Build metadata directory must remain inside the build.");

    throw Object.assign(new Error("Build metadata identity already exists."), {
      code: "EEXIST",
    });
  }
  await publishBuildMetadata(build, `${JSON.stringify(metadata, null, 2)}\n`, {
    openFile,
    publishDirectory,
    removeFile,
    removeDirectory,
  });
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
    process.exitCode = 1;
  }
}
