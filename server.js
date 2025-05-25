require("dotenv").config();
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const admin = require("firebase-admin");

// ✅ Firebase 서비스 계정 JSON을 base64 디코딩하여 로드
const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_CONFIG, "base64").toString("utf8")
);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const firestore = admin.firestore();

const app = express();
const port = process.env.PORT || 3000;

// ✅ Cloudinary 설정
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

// ✅ 메인 페이지
app.get("/", async (req, res) => {
  const snapshot = await firestore.collection("photos").orderBy("upload_time", "desc").get();
  const rows = snapshot.docs.map(doc => doc.data());

  const images = rows.map(photo => `
    <div class="photo-card" onclick="openLightbox('${photo.filepath}')">
      <div class="card-inner">
        <div class="front">
          <img src="${photo.filepath}" alt="사진">
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
      <div class="navbar">
        <div class="menu-icon" onclick="toggleMenu()">☰</div>
        <div id="menu-panel" class="hidden">
          <button onclick="showLogin()">로그인</button>
          <button onclick="showSignup()">회원가입</button>
        </div>
      </div>
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

      <div id="lightbox" onclick="closeLightbox()">
        <img id="lightbox-img" src="" alt="확대된 이미지">
        <a id="download-btn" href="#" download>⬇ 다운로드</a>
      </div>

      <script>
        function toggleMenu() {
          document.getElementById("menu-panel").classList.toggle("show");
        }
        function showLogin() {
          alert("🧑 로그인 모달 띄우기!");
        }
        function showSignup() {
          alert("🆕 회원가입 모달 띄우기!");
        }

        function openLightbox(url) {
          const img = document.getElementById("lightbox-img");
          const download = document.getElementById("download-btn");

          img.src = url;
          const parts = url.split("/upload/");
          const base = parts[0];
          const rest = parts[1];
          const dlUrl = base + "/upload/fl_attachment/" + rest;

          download.href = dlUrl;
          download.download = rest.split("/").pop();
          document.getElementById("lightbox").classList.add("show");
        }

        function closeLightbox() {
          document.getElementById("lightbox").classList.remove("show");
        }
      </script>
    </body>
    </html>
  `;
  res.send(html);
});

// ✅ 업로드 페이지 (/upload GET)
app.get("/upload", (req, res) => {
  const tagsPath = path.join(__dirname, "tags.json");

  fs.readFile(tagsPath, "utf-8", (err, data) => {
    if (err) {
      return res.send("❌ 태그를 불러오는 데 실패했습니다.");
    }

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
            <input type="file" name="photo" accept="image/*" multiple required>
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

// ✅ 업로드 처리 (/upload POST)
app.post("/upload", upload.array("photo", 10), async (req, res) => {
  const files = req.files;
  const rawTags = req.body.tags;
  const tags = Array.isArray(rawTags) ? rawTags.join(", ") : rawTags || "";
  const uploadTime = new Date().toISOString();

  for (const file of files) {
    await firestore.collection("photos").add({
      filepath: file.path,
      tags,
      upload_time: uploadTime
    });
  }

  res.redirect("/");
});

// ✅ 서버 실행
app.listen(port, () => {
  console.log(`🚀 서버 실행 중: http://localhost:${port}`);
});
