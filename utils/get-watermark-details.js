import sharp from "sharp";

export async function getWatermarkDetails(imagePath) {
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
      maxX = 0,
      minY = watermarkRegion.height,
      maxY = 0;

    for (let y = 0; y < watermarkRegion.height; y++) {
      for (let x = 0; x < watermarkRegion.width; x++) {
        const index = y * watermarkRegion.width + x;
        if (data[index] < 200) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (maxX > minX && maxY > minY) {
      return {
        width: maxX - minX,
        height: maxY - minY,
        left: watermarkRegion.left + minX,
        top: watermarkRegion.top + minY,
      };
    }

    return null;
  } catch (error) {
    console.error("Error detecting watermark:", error);
    return null;
  }
}
