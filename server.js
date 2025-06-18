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

// 📤 업로드
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

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const hash = hashes[i];

      const duplicate = await firestore
        .collection("photos")
        .where("file_hash", "==", hash)
        .get();
      if (!duplicate.empty) {
        return res.send(
          `<script>alert("❌ 이미 업로드된 이미지입니다."); window.location.href="/upload";</script>`
        );
      }

      const imageUrl = file?.secure_url || file?.url || file?.path || "";

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
  const tagParam = req.query.tags;
  const tagFilter = tagParam ? tagParam.split(",") : [];

  const snapshot = await firestore
    .collection("photos")
    .orderBy("upload_time", "desc")
    .get();
  let rows = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  if (tagFilter.length > 0) {
    rows = rows.filter((photo) => {
      const photoTags = Array.isArray(photo.tags) ? photo.tags : [photo.tags];
      return tagFilter.every((tag) => photoTags.includes(tag));
    });
  }

  const pagedRows = rows.slice(offset, offset + pageSize);
  const tagsPath = path.join(__dirname, "tags.json");
  const rawTags = JSON.parse(fs.readFileSync(tagsPath, "utf8"));
  const tags = ["전체", ...rawTags];
  const totalPages = Math.ceil(rows.length / pageSize);

  const filterButtons = tags
    .map((tag) => {
      const isActive =
        (tag === "전체" && tagFilter.length === 0) ||
        (tagFilter.length === 1 && tagFilter[0] === tag);
      const tagParamValue = tag === "전체" ? "" : encodeURIComponent(tag);
      return `<button class="filter-btn${
        isActive ? " active" : ""
      }" onclick="location.href='/?tags=${tagParamValue}'">${tag}</button>`;
    })
    .join("\n");

  const checkboxes = rawTags
    .map(
      (tag) =>
        `<label><input type="checkbox" name="tags" value="${tag}" ${
          tagFilter.includes(tag) ? "checked" : ""
        }/> ${tag}</label>`
    )
    .join("\n");

  const pagination = `
    <div style="text-align:center; margin-top:30px;">
      ${
        page > 1
          ? `<a href="/?page=${page - 1}&tags=${encodeURIComponent(
              tagParam || ""
            )}" style="margin-right:20px;">← 이전</a>`
          : ""
      }
      <span id="page-display" style="margin: 0 10px; font-weight:500; cursor:pointer;" onclick="editPageNumber()">
        ${page} / ${totalPages}
      </span>
      ${
        page < totalPages
          ? `<a href="/?page=${page + 1}&tags=${encodeURIComponent(
              tagParam || ""
            )}" style="margin-left:20px;">다음 →</a>`
          : ""
      }
    </div>
  `;

  const images = pagedRows
    .map((photo) => {
      const tagList = Array.isArray(photo.tags)
        ? photo.tags
        : typeof photo.tags === "string"
        ? [photo.tags]
        : [];

      return `
      <div class="photo-card" data-tags="${tagList.join(", ")}" data-doc-id="${
        photo.id
      }" data-filepath="${photo.filepath}" onclick="openLightbox('${
        photo.filepath
      }', '${photo.id}')">
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
      <div class="hamburger" onclick="toggleMenu()">☰</div>
      <div id="menu-panel" class="hamburger-menu show">
        <ul id="menu-items">
          <li><a href="/login">로그인</a></li>
          <li><a href="/signup">회원가입</a></li>
          <li><a href="/mypage">마이페이지</a></li>
        </ul>
      </div>

      <div class="container">
        <h1><a href="/">📸 WebPics 사진 아카이브</a></h1>

        <div class="filter-bar">
          <span>🔍 태그 필터:</span>
          ${filterButtons}
          <a href="#" class="multi-tag-toggle" onclick="toggleMultiTagForm()">다중태그 검색</a>
        </div>

        <div id="advanced-filter" style="display:none; margin-top:10px;">
          <form id="tag-filter-form" class="tag-filter-form" onsubmit="submitTags(event)">
            ${checkboxes}
            <button type="submit">적용</button>
          </form>
        </div>

        <div class="gallery">
          <a href="/upload" class="upload-box">+</a>
          ${images}
        </div>

        ${pagination}

        <p style="text-align:center; margin-top:40px; font-size:13px; color:#666;">문의는 @현서내꼬</p>
      </div>

      <div id="lightbox" onclick="closeLightbox()">
        <div class="lightbox-content" onclick="event.stopPropagation()">
          <div class="lightbox-img-wrapper">
            <img id="lightbox-img" src="" />
          </div>
          <div class="lightbox-info">
            <p id="lightbox-tags"></p>
            <a id="download-btn" href="#" download>⬇ 다운로드</a>
            <button id="delete-btn" style="display:none;">🗑 삭제</button>
          </div>
        </div>
      </div>

      <script>
        function toggleMenu() {
          const menu = document.getElementById("menu");
          menu.classList.toggle("show");
        }

        function toggleMultiTagForm() {
          const adv = document.getElementById("advanced-filter");
          adv.style.display = adv.style.display === "none" ? "block" : "none";
        }

        function submitTags(e) {
          e.preventDefault();
          const selected = [...document.querySelectorAll("input[name='tags']:checked")]
            .map(cb => cb.value)
            .join(",");
          location.href = '/?tags=' + encodeURIComponent(selected);
        }

        function editPageNumber() {
          const total = ${totalPages};
          const current = ${page};
          const input = prompt("이동할 페이지 번호를 입력하세요 (1 ~ " + total + ")", current);
          const num = parseInt(input);
          if (!isNaN(num) && num >= 1 && num <= total) {
            const tags = "${encodeURIComponent(tagParam || "")}";
            window.location.href = "/?page=" + num + "&tags=" + tags;
          } else if (input !== null) {
            alert("잘못된 페이지 번호입니다.");
          }
        }
      </script>
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

// 에러 핸들링
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
