import fs from "fs-extra";
import { removeWatermark } from "./remove-watermark.js";

export async function loopOverFolder(folderPath, blurFolderPath) {
  try {
    // Ensure both directories exist
    await fs.ensureDir(folderPath);
    await fs.ensureDir(blurFolderPath);

    // Process the entire folder at once
    console.log(`Processing folder: ${folderPath} -> ${blurFolderPath}`);
    await removeWatermark(folderPath, blurFolderPath);

    console.log("✅ All frames processed!");
  } catch (err) {
    console.error("❌ Error processing folder:", err);
  }
}
