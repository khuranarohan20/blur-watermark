import ffmpeg from "fluent-ffmpeg";

export const mergeAudio = (videoWithoutAudio, originalVideo, finalOutput) => {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoWithoutAudio)
      .input(originalVideo)
      .output(finalOutput)
      .outputOptions("-c:v copy", "-map 0:v", "-map 1:a?", "-c:a copy")
      .on("end", () => {
        console.log("✅ Audio added back successfully");
        resolve();
      })
      .on("error", reject)
      .run();
  });
};
