import { constants } from "node:fs";
import {
  copyFile,
  lstat,
  mkdir,
  open,
  readdir,
  realpath,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  validateBasePath,
  validateOrigin,
  validateReleaseId,
} from "./validate-deployment-env.mjs";

const defaultRepository = fileURLToPath(new URL("../", import.meta.url));
const inside = (root, file) => {
  const relative = path.relative(root, file);
  return (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
};
const excluded = (name) =>
  name.startsWith(".") ||
  /\.(?:pem|key|p12|pfx|sqlite|db)(?:-.*)?$/i.test(name) ||
  /^(?:credentials|secrets)(?:\.|$)/i.test(name);

async function copyAssets(source, target, metadataFile) {
  const information = await lstat(source);
  if (information.isSymbolicLink())
    throw new Error("Release assets cannot contain symbolic links.");
  if (information.isDirectory()) {
    await mkdir(target, { recursive: true });
    const entries = (await readdir(source))
      .filter(
        (entry) =>
          !excluded(entry) && path.join(source, entry) !== metadataFile,
      )
      .sort((left, right) => left.localeCompare(right, "en"));
    const results = await Promise.allSettled(
      entries.map((entry) =>
        copyAssets(
          path.join(source, entry),
          path.join(target, entry),
          metadataFile,
        ),
      ),
    );
    const failure = results.find((result) => result.status === "rejected");
    if (failure) throw failure.reason;
  } else if (information.isFile())
    await copyFile(source, target, constants.COPYFILE_EXCL);
  else throw new Error("Unsupported release asset.");
}

async function readBuildMetadata(build, filename) {
  const message = "Build metadata must remain inside the build.";
  if ((await lstat(path.dirname(filename))).isSymbolicLink())
    throw new Error(message);

  const handle = await open(
    filename,
    constants.O_RDONLY |
      (constants.O_NOFOLLOW ?? 0) |
      (constants.O_NONBLOCK ?? 0),
  );
  try {
    const opened = await handle.stat({ bigint: true });
    const entry = await lstat(filename, { bigint: true });
    if (
      !opened.isFile() ||
      !entry.isFile() ||
      opened.dev !== entry.dev ||
      opened.ino !== entry.ino ||
      !inside(build, await realpath(filename))
    )
      throw new Error(message);

    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

export async function packageRelease({
  repositoryRoot = defaultRepository,
  releaseId,
}) {
  validateReleaseId(releaseId);
  const repository = await realpath(repositoryRoot);
  const build = path.join(repository, "dist");
  if (
    (await lstat(build)).isSymbolicLink() ||
    !inside(repository, await realpath(build))
  )
    throw new Error("Build output must remain inside the repository.");
  const metadataFile = path.join(build, "_kernel/build.json");
  const metadataBytes = await readBuildMetadata(build, metadataFile);
  const metadata = JSON.parse(metadataBytes.toString("utf8"));
  if (metadata.releaseId !== releaseId)
    throw new Error(
      "Release ID differs from the completed build; rebuild with the intended VITE_RELEASE_ID.",
    );
  validateBasePath(metadata.basePath);
  validateOrigin(metadata.apiOrigin);
  if (!(await lstat(path.join(build, "index.html"))).isFile())
    throw new Error("Admin production build is missing.");
  const outputRoot = path.join(repository, "releases");
  try {
    const information = await lstat(outputRoot);
    if (information.isSymbolicLink() || !information.isDirectory())
      throw new Error("Release output must be an ordinary release directory.");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await mkdir(outputRoot);
  }
  const resolvedOutput = await realpath(outputRoot);
  if (!inside(repository, resolvedOutput) || inside(build, resolvedOutput))
    throw new Error(
      "Release output must remain inside the repository and outside the build.",
    );
  const output = path.join(outputRoot, releaseId);
  await mkdir(output);
  const publicRoot = path.join(output, "public");
  const applicationRoot = path.join(publicRoot, metadata.basePath.slice(1));
  await copyAssets(build, applicationRoot, metadataFile);
  await writeFile(
    path.join(applicationRoot, "_kernel/build.json"),
    metadataBytes,
    {
      flag: "wx",
    },
  );
  const release = {
    schemaVersion: 1,
    application: "kernel-admin",
    releaseId,
    basePath: metadata.basePath,
    apiOrigin: metadata.apiOrigin,
    createdAt: new Date().toISOString(),
    entrypoint: `public${metadata.basePath}index.html`,
  };
  await writeFile(
    path.join(output, "release.json"),
    `${JSON.stringify(release, null, 2)}\n`,
    { flag: "wx" },
  );
  await writeFile(
    path.join(applicationRoot, "_kernel/release.json"),
    `${JSON.stringify({ release: releaseId })}\n`,
    { flag: "wx" },
  );
  return { directory: output, release };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const arguments_ = process.argv.slice(2);
    if (arguments_.length !== 1 || !arguments_[0].startsWith("--release="))
      throw new Error("Use --release=ID.");
    const result = await packageRelease({ releaseId: arguments_[0].slice(10) });
    console.info(`Packaged ${result.release.releaseId}: ${result.directory}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
