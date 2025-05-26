require("dotenv").config();
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const admin = require("firebase-admin");

const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_CONFIG, "base64").toString("utf8")
);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
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
    resource_type: "image", // 👈 반드시 넣기!
    public_id: (req, file) =>
      file.originalname.split(".")[0] + "-" + Date.now(),
  },
});
const upload = multer({ storage });

app.use(express.static("public"));
app.use(express.static("."));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.post("/upload", upload.array("photo"), async (req, res) => {
  try {
    const { uid, nickname } = req.body;
    const rawTags = req.body.tags;
    const hashes = JSON.parse(req.body.hashes || "[]");
    const tags = Array.isArray(rawTags) ? rawTags.join(", ") : rawTags || "";
    const uploadTime = new Date().toISOString();
    const files = req.files;

    if (!files || !Array.isArray(files)) {
      return res.send(`<script>alert("❌ 파일이 업로드되지 않았습니다."); window.location.href="/upload";</script>`);
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const hash = hashes[i];

      console.log("🔥 FILE =", file);
      console.log("📛 HASH =", hash);

      if (!hash) {
        return res.send(`<script>alert("❌ 파일 해시가 누락되었습니다."); window.location.href="/upload";</script>`);
      }

      const duplicate = await firestore.collection("photos").where("file_hash", "==", hash).get();
      if (!duplicate.empty) {
        return res.send(`<script>alert("❌ 이미 업로드된 이미지입니다."); window.location.href="/upload";</script>`);
      }

      const imageUrl =
        typeof file?.secure_url === "string" ? file.secure_url :
        typeof file?.url === "string" ? file.url :
        typeof file?.path === "string" ? file.path :
        "";

      if (!imageUrl) {
        return res.send(`<script>alert("❌ 이미지 URL 추출 실패"); window.location.href="/upload";</script>`);
      }

      await firestore.collection("photos").add({
        filepath: imageUrl,
        file_hash: hash,
        tags,
        upload_time: uploadTime,
        upload_by: uid,
        uploader_nickname: nickname || "익명"
      });
    }

    res.redirect("/");
  } catch (err) {
    console.error("❌ 서버 오류:", err);
    res.status(500).send(`<script>alert("❌ 서버 오류 발생: ${err.message}"); window.location.href="/upload";</script>`);
  }
});

app.get("/", async (req, res) => {
  const snapshot = await firestore
    .collection("photos")
    .orderBy("upload_time", "desc")
    .get();
  const rows = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  const tagsPath = path.join(__dirname, "tags.json");
  const tagData = fs.readFileSync(tagsPath, "utf-8");
  const tags = JSON.parse(tagData);

  const filterButtons = tags
    .map(
      (tag) => `
    <button class="filter-btn" onclick="filterByTag('${tag}')">${tag}</button>
  `
    )
    .join("\n");

  const images = rows
    .map(
      (photo) => `
    <div class="photo-card" data-tags="${photo.tags || ""}" data-doc-id="${
        photo.id
      }" data-filepath="${photo.filepath}" onclick="openLightbox('${
        photo.filepath
      }', '${photo.id}')">
      <div class="card-inner">
        <div class="front"><img src="${photo.filepath}" alt="사진"></div>
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
      <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
      <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js"></script>
      <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>
      <script src="/lightbox_admin.js"></script>
      <script>
        const firebaseConfig = {
          apiKey: "AIzaSyBBMlsw1GCv2igg73oGrolGqcQVTIgHsyE",
          authDomain: "webpics-b2443.firebaseapp.com",
          projectId: "webpics-b2443",
          storageBucket: "webpics-b2443.appspot.com",
          messagingSenderId: "996418354850",
          appId: "1:996418354850:web:86f4484bf0a732b7d761fb"
        };
        firebase.initializeApp(firebaseConfig);
      </script>
      <script src="/auth.js" defer></script>
    </head>
    <body>
      <div class="navbar">
        <div class="menu-icon" onclick="toggleMenu()">☰</div>
        <div id="menu-panel" class="hidden"></div>
      </div>
      <div class="container">
        <h1>📸 WebPics 사진 아카이브</h1>
        <div class="tag-filter">
          <button class="filter-btn active" onclick="filterByTag('전체')">전체</button>
          ${filterButtons}
        </div>
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
        <button id="delete-btn" style="display:none;">🗑 삭제</button>
      </div>
      <script>
        function toggleMenu() {
          document.getElementById("menu-panel").classList.toggle("show");
        }
        function openLightbox(url, photoId) {
          const img = document.getElementById("lightbox-img");
          const download = document.getElementById("download-btn");
          const deleteBtn = document.getElementById("delete-btn");

          img.src = url;
          const parts = url.split("/upload/");
          const base = parts[0];
          const rest = parts[1];
          const dlUrl = base + "/upload/fl_attachment/" + rest;

          download.href = dlUrl;
          download.download = rest.split("/").pop();
          document.getElementById("lightbox").classList.add("show");

          // 삭제 버튼 처리
          if (deleteBtn) {
            deleteBtn.style.display = "none";
            auth.onAuthStateChanged(async user => {
              if (user) {
                const userDoc = await db.collection("users").doc(user.uid).get();
                if (userDoc.exists && userDoc.data().role === "admin") {
                  deleteBtn.style.display = "inline-block";
                  deleteBtn.onclick = () => {
                    if (confirm("정말로 이 사진을 삭제할까요?")) {
                      db.collection("photos").doc(photoId).delete().then(() => {
                        alert("삭제 완료!");
                        document.getElementById("lightbox").classList.remove("show");
                        window.location.reload();
                      });
                    }
                  };
                }
              }
            });
          }
        }
        function closeLightbox() {
          document.getElementById("lightbox").classList.remove("show");
        }
        function filterByTag(tag) {
          document.querySelectorAll(".filter-btn").forEach(button => {
            button.classList.toggle("active", button.textContent === tag || (tag === "전체" && button.textContent === "전체"));
          });
          document.querySelectorAll(".photo-card").forEach(card => {
            const tags = card.dataset.tags || "";
            card.style.display = (tag === "전체" || tags.includes(tag)) ? "block" : "none";
          });
        }
      </script>
    </body>
    </html>
  `;
  res.send(html);
});

app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "signup.html"));
});

app.get("/login", (req, res) => {
  res.redirect("/");
});

app.get("/mypage", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "mypage.html"));
});

app.get("/upload", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "upload.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.listen(port, () => {
  console.log(`🚀 서버 실행 중: http://localhost:${port}`);
});
