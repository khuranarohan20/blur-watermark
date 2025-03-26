import fs from "fs";
import https from "https";
import mime from "mime-types";
import path from "path";

export const downloadFile = (url, outputFolder, index = Date.now()) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder, { recursive: true });
    }

    https
      .get(url, (response) => {
        const contentType = response.headers["content-type"];
        const extension = mime.extension(contentType) || "bin";

        if (!extension) {
          return reject(new Error("Could not determine file type."));
        }

        const fileName = `media-${index}.${extension}`;
        const outputPath = path.join(outputFolder, fileName);
        const file = fs.createWriteStream(outputPath);

        response.pipe(file);

        file.on("finish", () => {
          file.close();
          console.log(`Download completed: ${outputPath}`);
          resolve(outputPath);
        });

        file.on("error", (err) => {
          reject(err);
        });
      })
      .on("error", (err) => {
        reject(err);
      });
  });
};
