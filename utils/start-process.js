import fs from "fs";
import path from "path";

import { extractFrames } from "./extract-frames.js";
import { loopOverFolder } from "./loop-over-folder.js";
import { reconstructVideo } from "./recontruct-video.js";

export const startProcess = async () => {
  try {
    console.log("🚀 Starting batch processing...");

    const inputFolder = "input";
    const files = fs
      .readdirSync(inputFolder)
      .filter((file) => file.startsWith("media-") && file.endsWith(".mp4"))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)[0], 10);
        const numB = parseInt(b.match(/\d+/)[0], 10);
        return numA - numB;
      });

    if (files.length === 0) {
      console.log("❌ No media files found in the input folder.");
      return;
    }

    const start = performance.now();

    for (const file of files) {
      const filePath = path.join(inputFolder, file);
      console.log(`🚀 Processing: ${file}...`);

      const framesFolder = `frames_${file}`;
      const blurredFolder = `blurred_${file}`;

      await extractFrames(filePath, framesFolder);
      console.log(
        `Now remove the watermark manually or using AI for: ${file}...`
      );

      await loopOverFolder(framesFolder, blurredFolder);
      console.log(`✅ Watermarks removed for: ${file}! Now reconstructing...`);

      const tempVideo = `temp_${file}`;
      const finalOutput = `final_${file}`;

      await reconstructVideo(blurredFolder, tempVideo);
      //   fs.rmdirSync(framesFolder, { recursive: true });
      //   fs.rmdirSync(blurredFolder, { recursive: true });
      //   await mergeAudio(tempVideo, filePath, finalOutput);

      console.log(`🎉 Processing complete for: ${file}!`);
    }

    const end = performance.now();

    console.log("✅ All files processed successfully!");
    console.log(`🚀 Processing took ${(end - start) / 1000} seconds.`);
  } catch (error) {
    console.error("❌ Error:", error);
  }
};
