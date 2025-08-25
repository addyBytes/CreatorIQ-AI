const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const ytdl = require("@distube/ytdl-core");
const ytpl = require("ytpl");
const archiver = require("archiver");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");
require("dotenv").config();

const PORT = 5000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5000"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(cors());
app.use(express.json());

io.on("connection", (socket) => {
  console.log(`✅ User connected: ${socket.id}`);

  socket.on("downloadPlaylist", async ({ playlistURL }) => {
    try {
      if (!ytpl.validateID(playlistURL)) {
        return socket.emit("playlistError", "Invalid YouTube Playlist URL.");
      }

      socket.emit("playlistProgress", { message: "Fetching playlist information..." });

      const playlist = await ytpl(playlistURL, { limit: Infinity });
      const tempDir = path.join(__dirname, "temp", socket.id);
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

      socket.emit("playlistProgress", {
        message: `Found ${playlist.items.length} videos. Starting downloads...`,
      });

      for (let i = 0; i < playlist.items.length; i++) {
        const video = playlist.items[i];
        const safeTitle = video.title.replace(/[^\w\s-]/g, "_") + ".mp4";

        socket.emit("playlistProgress", {
          message: `Downloading video ${i + 1}/${playlist.items.length}: ${safeTitle}`,
        });

        const videoStream = ytdl(video.shortUrl, {
          filter: "audioandvideo",
          quality: "highest",
        });
        const writeStream = fs.createWriteStream(path.join(tempDir, safeTitle));

        await new Promise((resolve, reject) => {
          videoStream.pipe(writeStream);
          videoStream.on("error", reject);
          writeStream.on("finish", resolve);
          writeStream.on("error", reject);
        });
      }

      socket.emit("playlistProgress", { message: "All videos downloaded. Creating ZIP file..." });

      const zipFileName = `${playlist.title.replace(/[^\w\s-]/g, "_")}.zip`;
      const zipFilePath = path.join(__dirname, "temp", zipFileName);
      const output = fs.createWriteStream(zipFilePath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      archive.pipe(output);
      archive.directory(tempDir, false);

      await new Promise((resolve, reject) => {
        output.on("close", resolve);
        archive.on("error", reject);
        archive.finalize();
      });

      const downloadUrl = `/download-zip/${zipFileName}`;
      socket.emit("playlistFinished", { downloadUrl });

      setTimeout(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
        if (fs.existsSync(zipFilePath)) fs.unlinkSync(zipFilePath);
      }, 30 * 60 * 1000);
    } catch (error) {
      console.error("❌ Playlist download error:", error);
      socket.emit("playlistError", "An error occurred while processing the playlist.");
    }
  });

  socket.on("disconnect", () => console.log(`❌ User disconnected: ${socket.id}`));
});

app.get("/details", async (req, res) => {
  try {
    const videoURL = req.query.url;
    if (!videoURL || !ytdl.validateURL(videoURL)) {
      return res.status(400).json({ error: "Invalid or no YouTube URL provided" });
    }

    const info = await ytdl.getInfo(videoURL);
    const videoFormats = ytdl.filterFormats(info.formats, "audioandvideo");

    const details = {
      title: info.videoDetails.title,
      viewCount: info.videoDetails.viewCount,
      thumbnail: info.videoDetails.thumbnails.at(-1).url,
      videoFormats,
      description: info.videoDetails.description,
      keywords: info.videoDetails.keywords,
    };

    res.json(details);
  } catch (err) {
    console.error("❌ Error in /details route:", err.message);
    res.status(500).json({ error: "Failed to fetch video details." });
  }
});

app.get("/download", async (req, res) => {
  try {
    const { url: videoURL, format: formatType = "mp4", quality, socketId } = req.query;
    if (!videoURL) return res.status(400).send("No YouTube URL provided");

    const info = await ytdl.getInfo(videoURL);
    const safeTitle = info.videoDetails.title.replace(/[^\w\s-]/g, "_");

    let downloadStream;
    if (formatType === "mp4") {
      res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.mp4"`);
      res.setHeader("Content-Type", "video/mp4");
      downloadStream = ytdl(videoURL, { quality: quality || "highest" });
    } else if (formatType === "m4a") {
      res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.m4a"`);
      res.setHeader("Content-Type", "audio/mp4");
      downloadStream = ytdl(videoURL, { filter: "audioonly", quality: "highestaudio" });
    } else {
      return res.status(400).send("Invalid format requested.");
    }

    downloadStream.on("progress", (_, downloaded, total) => {
      const percent = Math.floor((downloaded / total) * 100);
      if (socketId) io.to(socketId).emit("downloadProgress", { progress: percent });
    });

    downloadStream.on("end", () => {
      if (socketId) io.to(socketId).emit("downloadProgress", { progress: 100 });
    });

    downloadStream.pipe(res);
  } catch (err) {
    console.error("❌ Error in /download route:", err.message);
    if (!res.headersSent) res.status(500).send("Download failed!");
  }
});

app.get("/download-zip/:fileName", (req, res) => {
  const fileName = req.params.fileName;
  const filePath = path.join(__dirname, "temp", fileName);

  if (fs.existsSync(filePath)) {
    res.download(filePath, fileName, (err) => {
      if (err) console.error("Error sending zip file:", err);
    });
  } else {
    res.status(404).send("File not found or has been cleaned up.");
  }
});

app.post("/chat-with-ai", async (req, res) => {
  try {
    const { videoDetails, userQuestion } = req.body;
    if (!videoDetails || !userQuestion) {
      return res.status(400).json({ error: "Missing video details or user question." });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    const textPrompt = `
      You are a YouTube content strategy expert.
      Analyze the provided thumbnail and video metadata.
      Video Details:
      - Title: "${videoDetails.title}"
      - Description: "${videoDetails.description}"
      - Tags: [${videoDetails.keywords.join(", ")}]
      User question: "${userQuestion}"
      Provide a helpful, concise, and actionable answer.
    `;

    const imageUrl = videoDetails.thumbnail;
    const imageResponse = await axios.get(imageUrl, { responseType: "arraybuffer" });
    const imagePart = {
      inlineData: {
        data: Buffer.from(imageResponse.data).toString("base64"),
        mimeType: imageResponse.headers["content-type"],
      },
    };

    const result = await model.generateContent([textPrompt, imagePart]);
    const response = await result.response;

    res.json({ answer: response.text() });
  } catch (error) {
    console.error("❌ Error in /chat-with-ai route:", error.message);
    res.status(500).json({ error: "An error occurred while talking to the AI." });
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
});
