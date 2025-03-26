import ffmpeg from "fluent-ffmpeg";

export function reconstructVideo(frameDir, outputVideo) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(`${frameDir}/frame_%04d.png`)
      .inputFPS(25)
      .videoCodec("libx264")
      .outputOptions(["-crf 18", "-preset slow", "-pix_fmt yuv420p", "-r 25"])
      .save(outputVideo)
      .on("end", () => {
        console.log("✅ Video reconstructed successfully:", outputVideo);
        resolve();
      })
      .on("error", (err, stdout, stderr) => {
        console.error("❌ FFmpeg Error:", err);
        console.log("🔍 FFmpeg Output:", stdout);
        console.log("🔍 FFmpeg Logs:", stderr);
        reject(err);
      });
  });
}
