
require("dotenv").config();
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const admin = require("firebase-admin");

const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const firestore = admin.firestore();

const app = express();
const port = process.env.PORT || 3000;

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "webpics",
    format: async () => "jpg",
    public_id: (req, file) => file.originalname.split(".")[0] + "-" + Date.now(),
  },
});
const upload = multer({ storage });

app.use(express.static("public"));
app.use(express.static("."));
app.use(express.urlencoded({ extended: true }));

app.get("/", async (req, res) => {
  const snapshot = await firestore.collection("photos").orderBy("upload_time", "desc").get();
  const rows = snapshot.docs.map(doc => doc.data());

  const images = rows.map(photo => `
    <div class="photo-card">
      <div class="card-inner">
        <div class="front">
          <img src="${photo.filepath}" alt="사진">
          <a href="${photo.filepath}" download class="download-btn">⬇</a>
        </div>
        <div class="back">
          <p>태그: ${photo.tags || "없음"}</p>
          <p>업로드: ${new Date(photo.upload_time).toLocaleString("ko-KR", {
            timeZone: "Asia/Seoul"
          })}</p>
        </div>
      </div>
    </div>
  `).join("\n");

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

app.get("/upload", (req, res) => {
  const tagsFile = path.join(__dirname, "tags.json");
  fs.readFile(tagsFile, "utf-8", (err, data) => {
    if (err) return res.send("태그를 불러오는 데 실패했습니다.");
    const tags = JSON.parse(data);
    const checkboxes = `
      <div class="tag-list">
        ${tags.map(tag => `
          <label>
            <input type="checkbox" name="tags" value="${tag}"> ${tag}
          </label>
        `).join("\n")}
      </div>
    `;
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
            ${checkboxes}
            <div class="upload-footer">
              <button type="submit">업로드</button>
            </div>
          </form>
          <a href="/">← 메인으로 돌아가기</a>
        </div>
      </body>
      </html>
    `;
    res.send(html);
  });
});

app.post("/upload", upload.single("photo"), async (req, res) => {
  const file = req.file;
  const rawTags = req.body.tags;
  const tags = Array.isArray(rawTags) ? rawTags.join(", ") : rawTags || "";
  const filepath = file.path;
  const uploadTime = new Date().toISOString();

  console.log("✅ Firestore 저장:", filepath);

  await firestore.collection("photos").add({
    filepath,
    tags,
    upload_time: uploadTime
  });

  res.redirect("/");
});

app.listen(port, () => {
  console.log(`🚀 서버 실행 중: http://localhost:${port}`);
});
