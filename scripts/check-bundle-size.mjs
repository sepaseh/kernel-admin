import console from "node:console";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const assetsDirectory = path.resolve("dist/assets");
export const maximumChunkBytes = 450_000;
export const maximumTotalBytes = 1_900_000;

export const evaluateBundleAssets = (assets) => {
  if (assets.length === 0) throw new Error("No JavaScript assets found");

  const oversizedAssets = assets.filter(
    ({ bytes }) => bytes > maximumChunkBytes,
  );
  const totalBytes = assets.reduce((total, { bytes }) => total + bytes, 0);
  const findings = [];
  if (oversizedAssets.length > 0 || totalBytes > maximumTotalBytes) {
    findings.push(
      ...oversizedAssets.map(
        ({ bytes, name }) =>
          `${name} is ${bytes.toLocaleString()} bytes (limit ${maximumChunkBytes.toLocaleString()})`,
      ),
    );
    if (totalBytes > maximumTotalBytes) {
      findings.push(
        `Total JavaScript is ${totalBytes.toLocaleString()} bytes (limit ${maximumTotalBytes.toLocaleString()})`,
      );
    }
  }

  return {
    largestAsset: assets.toSorted((a, b) => b.bytes - a.bytes)[0],
    totalBytes,
    findings,
  };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const assetNames = await readdir(assetsDirectory);
  const javascriptAssets = assetNames.filter((name) => name.endsWith(".js"));
  const assets = await Promise.all(
    javascriptAssets.map(async (name) => ({
      bytes: (await stat(path.join(assetsDirectory, name))).size,
      name,
    })),
  );
  let result;
  try {
    result = evaluateBundleAssets(assets);
  } catch (error) {
    if (error.message === "No JavaScript assets found") {
      throw new Error(`No JavaScript assets found in ${assetsDirectory}`, {
        cause: error,
      });
    }
    throw error;
  }

  const { largestAsset, totalBytes, findings } = result;
  console.log(
    `Bundle measured: ${assets.length} chunks, ${totalBytes.toLocaleString()} bytes total, ` +
      `${largestAsset.name} largest at ${largestAsset.bytes.toLocaleString()} bytes.`,
  );
  for (const finding of findings) console.warn(`Advisory: ${finding}`);
}
