import { extractFrames } from "./utils/extract-frames";
import { loopOverFolder } from "./utils/loop-over-folder";
import { mergeAudio } from "./utils/merge-audio";
import { reconstructVideo } from "./utils/recontruct-video";

(async () => {
  try {
    console.log("🚀 Starting the process...");
    await extractFrames("1080p.mp4", "frames");
    console.log("Now remove the watermark manually or using AI...");
    await loopOverFolder("./frames");
    console.log("✅ All watermarks removed! Now contructing the video...");

    await reconstructVideo("./blurred", "temp_video.mp4");
    await mergeAudio("temp_video.mp4", "1080p.mp4", "final_output.mp4");

    console.log("🎉 Processing complete! Your final video is ready.");
  } catch (error) {
    console.error("❌ Error:", error);
  }
})();
