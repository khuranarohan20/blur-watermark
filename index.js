import cors from "cors";
import express from "express";
import { downloadFile } from "./utils/download-file.js";
import { startProcess } from "./utils/start-process.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/v1/health", (req, res) => {
  res.status(200).json({ status: "Up and Running" });
});

app.post("/v1/process-media", async (req, res) => {
  try {
    const { mediaUrl } = req.body;

    if (!mediaUrl) {
      return res.status(400).json({ error: "URLS are required" });
    }
    if (!Array.isArray(mediaUrl)) {
      return res.status(400).json({ error: "URLS should be an array" });
    }

    await Promise.all(
      mediaUrl.map((url, index) => downloadFile(url, "input", index))
    );

    res.status(200).json({ message: "Media processing started" });
    await startProcess();
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(5000, () => console.log("🚀 Server is running on port 5000"));
