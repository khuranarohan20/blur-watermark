import { exec } from "child_process";
import util from "util";
import { getWatermarkDetails } from "./utils/get-watermark-details";

const execPromise = util.promisify(exec);

export async function removeWatermark(inputPath, outputPath) {
  const details = await getWatermarkDetails(inputPath);

  if (
    !details ||
    !details.width ||
    !details.height ||
    !details.left ||
    !details.top
  ) {
    console.log(`No watermark detected in ${inputPath}`);
    return;
  }

  const { width, height, left, top } = details;
  const command = `python remove_watermark.py ${inputPath} ${outputPath} ${width} ${height} ${left} ${top}`;

  try {
    const { stdout, stderr } = await execPromise(command);
    console.log(`✅ Watermark removed: ${outputPath}`);
    if (stderr) console.error(`⚠️ Python Warning: ${stderr}`);
  } catch (error) {
    console.error(
      `❌ Error removing watermark from ${inputPath}:`,
      error.message
    );
  }
}
