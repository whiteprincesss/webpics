// 📁 server.js

const express = require("express");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const port = 3000;

app.use(express.static("public"));
app.use(express.static("."));
app.use(express.urlencoded({ extended: true }));

function logToFile(text) {
  const now = new Date().toISOString();
  const logLine = `[${now}] ${text}\n`;
  fs.appendFileSync("server.log", logLine);
}

const db = new sqlite3.Database("./photos.db");
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filepath TEXT NOT NULL,
      tags TEXT,
      upload_time TEXT NOT NULL
    )
  `);
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/pics");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = file.originalname + Date.now();
    const hash = crypto.createHash("md5").update(base).digest("hex");
    cb(null, `${hash}${ext}`);
  },
});
const upload = multer({ storage });

app.get("/", (req, res) => {
  db.all("SELECT * FROM photos ORDER BY id DESC", (err, rows) => {
    if (err) return res.send("DB 오류 발생");

    const images = rows
      .map(
        (photo) => `
      <div class="photo-card">
        <div class="card-inner">
          <div class="front">
            <img src="${photo.filepath}" alt="사진">
            <a href="${photo.filepath}" download class="download-btn">⬇</a>
          </div>
          <div class="back">
            <p>태그: ${photo.tags || "없음"}</p>
            <p>업로드: ${new Date(photo.upload_time).toLocaleString("ko-KR", {
              timeZone: "Asia/Seoul",
            })}</p>
          </div>
        </div>
      </div>
    `
      )
      .join("\n");

    const html = `
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <title>WebPics 아카이브</title>
        <link rel="stylesheet" href="/style.css">
      </head>
      <body>
        <div class="container">
          <h1>📸 WebPics 사진 아카이브</h1>
          <div class="gallery">
            <a href="/upload" class="upload-box">+</a>
            ${images}
          </div>
          <p style="text-align:center; font-size:13px; color:#666; margin-top:40px;">
            문의는 @현서내꼬
          </p>
        </div>

        <script>
          document.addEventListener("DOMContentLoaded", () => {
            document.querySelectorAll(".photo-card").forEach(card => {
              card.addEventListener("click", () => {
                card.classList.toggle("flipped");
              });
            });
          });
        </script>
      </body>
      </html>
    `;
    res.send(html);
  });
});

app.get("/upload", (req, res) => {
  const tagsFile = path.join(__dirname, "tags.json");
  fs.readFile(tagsFile, "utf-8", (err, data) => {
    if (err) return res.send("태그를 불러오는 데 실패했습니다.");

    const tags = JSON.parse(data);
    const checkboxes = tags
      .map(
        (tag) => `
      <label style="margin-right: 12px;">
        <input type="checkbox" name="tags" value="${tag}"> ${tag}
      </label>
    `
      )
      .join("\n");

    const html = `
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <title>사진 업로드</title>
        <link rel="stylesheet" href="/style.css">
      </head>
      <body>
        <div class="container">
          <h1>📤 사진 업로드</h1>
          <form class="upload-form" action="/upload" method="post" enctype="multipart/form-data">
            <input type="file" name="photo" accept="image/*" required>
            <div style="margin: 12px 0;">
              ${checkboxes}
            </div>
            <button type="submit">업로드</button>
          </form>
          <a href="/" style="display:inline-block; margin-top:20px;">← 메인으로 돌아가기</a>
        </div>
      </body>
      </html>
    `;
    res.send(html);
  });
});

app.post("/upload", upload.single("photo"), (req, res) => {
  const file = req.file;
  const rawTags = req.body.tags;
  const tags = Array.isArray(rawTags) ? rawTags.join(", ") : rawTags || "";
  const filepath = `/pics/${file.filename}`;
  const uploadTime = new Date().toISOString();

  logToFile(`업로드됨: ${filepath} | 태그: ${tags}`);

  db.run(
    "INSERT INTO photos (filepath, tags, upload_time) VALUES (?, ?, ?)",
    [filepath, tags, uploadTime],
    (err) => {
      if (err) {
        console.error("DB 오류:", err);
        return res.send("DB 오류 발생!");
      }
      res.redirect("/");
    }
  );
});

app.listen(port, () => {
  console.log(`🚀 서버 실행 중: http://localhost:${port}`);
});
