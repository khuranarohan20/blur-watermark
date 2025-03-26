import fs from "fs-extra";
import path from "path";
import { removeWatermark } from "./remove-watermark";

export async function loopOverFolder(folderPath) {
  try {
    const files = await fs.readdir(folderPath, { withFileTypes: true });
    let frameIndex = 1;

    for (const file of files) {
      const fullPath = path.join(folderPath, file.name);

      if (file.isDirectory()) {
        await loopOverFolder(fullPath);
      } else {
        const outputPath = `blurred/frame_${String(frameIndex).padStart(
          4,
          "0"
        )}.png`;

        try {
          console.log(`Processing file: ${fullPath} -> ${outputPath}`);
          await removeWatermark(fullPath, outputPath);
          frameIndex++;
        } catch (error) {
          console.error(`❌ Failed to process ${fullPath}, skipping...`);
        }
      }
    }

    console.log("✅ All frames processed!");
  } catch (err) {
    console.error("❌ Error reading folder:", err);
  }
}
