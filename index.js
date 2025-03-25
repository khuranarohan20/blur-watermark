const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs-extra");
const sharp = require("sharp");
const path = require("path");
const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);

const extractFrames = (inputVideo, outputDir) => {
  fs.ensureDirSync(outputDir);

  return new Promise((resolve, reject) => {
    ffmpeg(inputVideo)
      .output(`${outputDir}/frame_%04d.png`)
      .outputOptions(["-vf", "fps=25", "-q:v 2"]) // 🔥 Ensures all frames extracted
      .on("end", () => {
        console.log("✅ Frames extracted successfully");
        resolve();
      })
      .on("error", reject)
      .run();
  });
};

function reconstructVideo(frameDir, outputVideo) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(`${frameDir}/frame_%04d.png`)
      .inputFPS(25) // Make sure FFmpeg reads at 25 FPS
      .videoCodec("libx264")
      .outputOptions([
        "-crf 18",
        "-preset slow",
        "-pix_fmt yuv420p",
        "-r 25", // Ensure correct FPS
      ])
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

const mergeAudio = (videoWithoutAudio, originalVideo, finalOutput) => {
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

async function getWatermarkDetails(imagePath) {
  try {
    const { width, height } = await sharp(imagePath).metadata();

    // Define approximate region where watermark might be
    const watermarkHeight = Math.round(height * 0.05); // 5% of image height
    const watermarkRegion = {
      left: Math.round(width * 0.6), // Start searching from 60% of image width
      top: Math.round(height * 0.9), // Start from 90% of image height
      width: Math.round(width * 0.4), // Search in last 40% of width
      height: watermarkHeight,
    };

    // Extract the possible watermark region
    const watermarkImage = await sharp(imagePath)
      .extract(watermarkRegion)
      .toBuffer();

    const { data } = await sharp(watermarkImage)
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let minX = watermarkRegion.width, // Start with max width
      maxX = 0,
      minY = watermarkRegion.height, // Start with max height
      maxY = 0;

    // Scan pixels to detect the darkest areas (potential watermark)
    for (let y = 0; y < watermarkRegion.height; y++) {
      for (let x = 0; x < watermarkRegion.width; x++) {
        const index = y * watermarkRegion.width + x;
        if (data[index] < 200) {
          // Threshold for watermark detection
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }

    // Calculate watermark dimensions and position
    if (maxX > minX && maxY > minY) {
      return {
        width: maxX - minX,
        height: maxY - minY,
        left: watermarkRegion.left + minX,
        top: watermarkRegion.top + minY,
      };
    }

    return null; // No watermark detected
  } catch (error) {
    console.error("Error detecting watermark:", error);
    return null;
  }
}

async function removeWatermark(inputPath, outputPath) {
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

async function loopOverFolder(folderPath) {
  try {
    const files = await fs.readdir(folderPath, { withFileTypes: true });
    let frameIndex = 1; // Start frame numbering from 1

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
          frameIndex++; // Increment only if successful
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
