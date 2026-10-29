import { randomUUID } from "node:crypto";
import {
  link,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
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

async function writeBuildMetadata(
  file,
  contents,
  openFile,
  linkFile,
  removeFile,
) {
  const temporary = path.join(path.dirname(file), `.build-${randomUUID()}.tmp`);
  const handle = await openFile(temporary, "wx");
  const failures = [];
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
    try {
      await linkFile(temporary, file);
    } catch (error) {
      failures.push(error);
    }
  }
  try {
    await removeFile(temporary);
  } catch (error) {
    failures.push(error);
  }
  if (failures.length) {
    if (failures.length > 1)
      throw new AggregateError(
        failures,
        "Build metadata write or owned-file cleanup failed.",
        { cause: failures[0] },
      );

    throw failures[0];
  }
}

export async function stampAdminBuild({
  environment,
  buildDirectory = path.resolve("dist"),
  openFile = open,
  linkFile = link,
  removeFile = unlink,
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
  const directory = path.join(build, "_kernel");
  await mkdir(directory, { recursive: true });
  const directoryInfo = await lstat(directory);
  if (directoryInfo.isSymbolicLink() || !directoryInfo.isDirectory())
    throw new Error("Build metadata directory must remain inside the build.");
  await writeBuildMetadata(
    path.join(directory, "build.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
    openFile,
    linkFile,
    removeFile,
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
    process.exitCode = 1;
  }
}
