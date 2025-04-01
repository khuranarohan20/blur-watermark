import { exec } from "child_process";
import fs from "fs-extra";
import util from "util";

const execPromise = util.promisify(exec);

export async function removeWatermark(inputPath, outputPath) {
  try {
    // Ensure output directory exists
    await fs.ensureDir(outputPath);

    // Use directory mode to process all frames at once
    const command = `python remove_watermark.py "${inputPath}" "${outputPath}"`;

    const { stdout, stderr } = await execPromise(command);
    console.log(`✅ Watermark removed from all frames in: ${inputPath}`);
    if (stderr) console.error(`⚠️ Python Warning: ${stderr}`);
  } catch (error) {
    console.error(
      `❌ Error removing watermark from ${inputPath}:`,
      error.message
    );
  }
}
