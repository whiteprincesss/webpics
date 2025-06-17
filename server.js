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
    resource_type: "image",
    public_id: (req, file) =>
      file.originalname.split(".")[0] + "-" + Date.now(),
  },
});
const upload = multer({ storage });

app.use(express.static("public"));
app.use(express.static("."));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 📤 사진 업로드
app.post("/upload", upload.array("photo"), async (req, res) => {
  try {
    const { uid, nickname } = req.body;
    const rawTags = req.body.tags;
    const hashes = JSON.parse(req.body.hashes || "[]");
    const tags = Array.isArray(rawTags)
      ? rawTags
      : typeof rawTags === "string"
      ? [rawTags]
      : [];
    const uploadTime = new Date().toISOString();
    const files = req.files;

    if (!files || !Array.isArray(files)) {
      return res.send(
        `<script>alert("❌ 파일이 업로드되지 않았습니다."); window.location.href="/upload";</script>`
      );
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const hash = hashes[i];

      if (!hash) {
        return res.send(
          `<script>alert("❌ 파일 해시가 누락되었습니다."); window.location.href="/upload";</script>`
        );
      }

      const duplicate = await firestore
        .collection("photos")
        .where("file_hash", "==", hash)
        .get();
      if (!duplicate.empty) {
        return res.send(
          `<script>alert("❌ 이미 업로드된 이미지입니다."); window.location.href="/upload";</script>`
        );
      }

      const imageUrl =
        typeof file?.secure_url === "string"
          ? file.secure_url
          : typeof file?.url === "string"
          ? file.url
          : typeof file?.path === "string"
          ? file.path
          : "";

      if (!imageUrl) {
        return res.send(
          `<script>alert("❌ 이미지 URL 추출 실패"); window.location.href="/upload";</script>`
        );
      }

      await firestore.collection("photos").add({
        filepath: imageUrl,
        file_hash: hash,
        tags,
        upload_time: uploadTime,
        upload_by: uid,
        uploader_nickname: nickname || "익명",
      });
    }

    res.redirect("/");
  } catch (err) {
    console.error("❌ 서버 오류:", err);
    res
      .status(500)
      .send(
        `<script>alert("❌ 서버 오류 발생: ${err.message}"); window.location.href="/upload";</script>`
      );
  }
});

// 🏠 메인 페이지
app.get("/", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = 19;
  const offset = (page - 1) * pageSize;
  const tagFilter = req.query.tag || "전체";

  // let query = firestore.collection("photos").orderBy("upload_time", "desc");
  let query;
  if (tagFilter === "전체") {
    query = firestore.collection("photos").orderBy("upload_time", "desc");
  } else {
    query = firestore
      .collection("photos")
      .where("tags", "array-contains", tagFilter)
      .orderBy("upload_time", "desc");
  }


  const snapshot = await query.get();
  const totalPhotos = snapshot.size;
  const rows = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const pagedRows = rows.slice(offset, offset + pageSize);

  const tagsPath = path.join(__dirname, "tags.json");
  const tagData = fs.readFileSync(tagsPath, "utf-8");
  const rawTags = JSON.parse(tagData);
  const tags = ["전체", ...rawTags];

  const filterButtons = tags
    .map(
      (tag) =>
        `<button class="filter-btn${
          tag === tagFilter ? " active" : ""
        }" onclick="location.href='/?page=1&tag=${encodeURIComponent(
          tag
        )}'">${tag}</button>`
    )
    .join("\n");

    const images = pagedRows
      .map((photo) => {
        const tagList = Array.isArray(photo.tags)
          ? photo.tags
          : typeof photo.tags === "string"
          ? [photo.tags]
          : [];

        return `
        <div class="photo-card" data-tags="${tagList.join(
          ", "
        )}" data-doc-id="${photo.id}" data-filepath="${
          photo.filepath
        }" onclick="openLightbox('${photo.filepath}', '${photo.id}')">
          <div class="card-inner">
            <div class="front"><img src="${photo.filepath}" alt="사진"></div>
            <div class="back">
              <p>태그: ${tagList.join(", ") || "없음"}</p>
              <p>업로드: ${new Date(photo.upload_time).toLocaleString("ko-KR", {
                timeZone: "Asia/Seoul",
              })}</p>
            </div>
          </div>
        </div>
      `;
      })
      .join("\n");

  const totalPages = Math.ceil(totalPhotos / pageSize);
  const prevPage = page > 1 ? page - 1 : null;
  const nextPage = page < totalPages ? page + 1 : null;

  const pagination = `
    <div style="text-align:center; margin-top:30px;">
      ${
        prevPage
          ? `<a href="/?page=${prevPage}&tag=${encodeURIComponent(
              tagFilter
            )}" style="margin-right:20px;">← 이전</a>`
          : ""
      }
      <span id="page-display" style="margin: 0 10px; font-weight:500;">${page} / ${totalPages}</span>
      ${
        nextPage
          ? `<a href="/?page=${nextPage}&tag=${encodeURIComponent(
              tagFilter
            )}" style="margin-left:20px;">다음 →</a>`
          : ""
      }
    </div>
  `;

  const html = `
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8" />
      <title>WebPics</title>
      <link rel="stylesheet" href="/style.css" />
      <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
      <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js"></script>
      <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>
      <script src="/auth.js" defer></script>
      <script src="/lightbox_admin.js" defer></script>
    </head>
    <body>
      <div class="container">
        <h1><a href="/">📸 WebPics 사진 아카이브</a></h1>

        <div class="filter-bar">
          <span>🔍 태그 필터:</span>
          ${filterButtons}
        </div>

        <div class="gallery">
          <a href="/upload" class="upload-box">+</a>
          ${images}
        </div>

        ${pagination}

        <p style="text-align:center; margin-top:40px; font-size:13px; color:#666;">문의는 @현서내꼬</p>
      </div>

      <div id="lightbox" onclick="closeLightbox()">
        <img id="lightbox-img" src="" />
        <a id="download-btn" href="#" download>⬇ 다운로드</a>
        <button id="delete-btn" style="display:none;">🗑 삭제</button>
      </div>
    </body>
    </html>
  `;

  res.send(html);
});

// 기타 라우트
app.get("/signup", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "signup.html"))
);
app.get("/login", (req, res) => res.redirect("/"));
app.get("/mypage", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "mypage.html"))
);
app.get("/upload", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "upload.html"))
);
app.get("/admin", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "admin.html"))
);

// 404 & 500 에러 핸들링
app.use((req, res) =>
  res.status(404).sendFile(path.join(__dirname, "public", "404.html"))
);
app.use((err, req, res, next) => {
  console.error("🔥 서버 오류 발생:", err);
  res.status(500).sendFile(path.join(__dirname, "public", "500.html"));
});

app.listen(port, () => {
  console.log(`🚀 WebPics 서버 실행 중: http://localhost:${port}`);
});
