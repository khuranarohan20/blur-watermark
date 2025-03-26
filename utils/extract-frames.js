import ffmpeg from "fluent-ffmpeg";
import fs from "fs-extra";

export const extractFrames = (inputVideo, outputDir) => {
  fs.ensureDirSync(outputDir);

  return new Promise((resolve, reject) => {
    ffmpeg(inputVideo)
      .output(`${outputDir}/frame_%04d.png`)
      .outputOptions(["-vf", "fps=25", "-q:v 2"])
      .on("end", () => {
        console.log("✅ Frames extracted successfully");
        resolve();
      })
      .on("error", reject)
      .run();
  });
};
