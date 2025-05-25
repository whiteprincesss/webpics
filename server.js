
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

          // 다운로드 URL 올바르게 구성
          const dlUrl = base + "/upload/fl_attachment/" + rest;

          download.href = dlUrl;
          download.download = rest.split("/").pop(); // 파일명만 추출
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

app.listen(port, () => {
  console.log(`🚀 서버 실행 중: http://localhost:${port}`);
});
