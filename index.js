const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs-extra");
const sharp = require("sharp");
const path = require("path");

const extractFrames = (inputVideo, outputDir) => {
  fs.ensureDirSync(outputDir);

  return new Promise((resolve, reject) => {
    ffmpeg(inputVideo)
      .output(`${outputDir}/frame_%04d.png`)
      .outputOptions("-q:v 2")
      .on("end", () => {
        console.log("✅ Frames extracted successfully");
        resolve();
      })
      .on("error", reject)
      .run();
  });
};

const reconstructVideo = (frameDir, inputVideo, outputVideo) => {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(`${frameDir}/frame_%04d.png`)
      .input(inputVideo)
      .inputFPS(25)

      .videoCodec("libx264")
      .outputOptions("-crf", "18", "-preset", "slow")

      .noAudio()
      .save(outputVideo)

      .on("end", () => {
        console.log("✅ Video reconstructed successfully");
        resolve();
      })
      .on("error", (err, stdout, stderr) => {
        console.error("❌ FFmpeg Error:", err);
        console.log("🔍 FFmpeg Output:", stdout);
        console.log("🔍 FFmpeg Logs:", stderr);
        reject(err);
      });
  });
};

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

async function getWatermarkWidth(imagePath) {
  try {
    const { width, height } = await sharp(imagePath).metadata();

    const watermarkHeight = Math.round(height * 0.05);
    const watermarkRegion = {
      left: Math.round(width * 0.6),
      top: Math.round(height * 0.9),
      width: Math.round(width * 0.4),
      height: watermarkHeight,
    };

    const watermarkImage = await sharp(imagePath)
      .extract(watermarkRegion)
      .toBuffer();

    const { data } = await sharp(watermarkImage)
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let minX = watermarkRegion.width,
      maxX = 0;

    for (let x = 0; x < watermarkRegion.width; x++) {
      for (let y = 0; y < watermarkHeight; y++) {
        const index = y * watermarkRegion.width + x;
        if (data[index] < 200) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
        }
      }
    }

    const watermarkWidth = maxX - minX;

    return watermarkWidth;
  } catch (error) {
    console.error("Error detecting watermark width:", error);
  }
}

const blurWatermark = async (inputImage, outputImage) => {
  try {
    if (!fs.existsSync(inputImage)) {
      console.error("❌ Error: File does not exist:", inputImage);
      return;
    }

    const { width, height } = await sharp(inputImage).metadata();

    console.log(`ℹ️ Image dimensions: ${width}x${height}`);

    const watermarkWidth = await getWatermarkWidth(inputImage);
    const watermarkHeight = 50;
    const watermarkX = width - watermarkWidth - 10;
    const watermarkY = height - watermarkHeight - 10;

    if (watermarkX < 0 || watermarkY < 0) {
      console.error("❌ Error: Watermark position is out of bounds.");
      return;
    }

    await sharp(inputImage)
      .extract({
        left: watermarkX,
        top: watermarkY,
        width: watermarkWidth,
        height: watermarkHeight,
      })
      .blur(10)
      .toBuffer()
      .then((blurredWatermark) =>
        sharp(inputImage)
          .composite([
            { input: blurredWatermark, left: watermarkX, top: watermarkY },
          ])
          .toFile(outputImage)
      );

    console.log("✅ Watermark blurred successfully! Saved to:", outputImage);
  } catch (error) {
    console.error("❌ Error processing image:", error);
  }
};

function loopOverFolder(folderPath) {
  return new Promise((resolve, reject) => {
    fs.readdir(folderPath, { withFileTypes: true }, (err, files) => {
      if (err) {
        console.error("Error reading folder:", err);
        return reject(err);
      }

      const processFilePromises = files.map(async (file) => {
        const fullPath = path.join(folderPath, file.name);

        if (file.isDirectory()) {
          await loopOverFolder(fullPath);
        } else {
          console.log("Processing file:", fullPath);
          await blurWatermark(fullPath, `blurred/${file.name}`);
        }
      });

      Promise.all(processFilePromises)
        .then(() => resolve())
        .catch(reject);
    });
  });
}

(async () => {
  try {
    console.log("🚀 Starting the process...");
    await extractFrames("1080p.mp4", "frames");
    console.log("Now remove the watermark manually or using AI...");
    await loopOverFolder("./frames");
    console.log("All watermarks blurred! Now contructing the video...");

    await reconstructVideo("./blurred", "1080p.mp4", "temp_video.mp4");
    await mergeAudio("temp_video.mp4", "1080p.mp4", "final_output.mp4");

    console.log("🎉 Processing complete! Your final video is ready.");
  } catch (error) {
    console.error("❌ Error:", error);
  }
})();
