function openLightbox(url, photoId) {
  const img = document.getElementById("lightbox-img");
  const download = document.getElementById("download-btn");
  const deleteBtn = document.getElementById("delete-btn");
  const tagsEl = document.getElementById("lightbox-tags");

  img.src = url;

  const parts = url.split("/upload/");
  const base = parts[0];
  const rest = parts[1];
  const dlUrl = base + "/upload/fl_attachment/" + rest;
  download.href = dlUrl;
  download.download = rest.split("/").pop();

  // 태그 불러오기
  const card = document.querySelector(`[data-doc-id="${photoId}"]`);
  const tagText = card?.getAttribute("data-tags") || "태그 없음";
  tagsEl.textContent = "📎 태그: " + tagText;

  document.getElementById("lightbox").classList.add("show");

  // 삭제 버튼 기본 비활성화
  deleteBtn.style.display = "none";

  if (typeof auth !== "undefined" && typeof db !== "undefined") {
    auth.onAuthStateChanged(async (user) => {
      if (user) {
        const doc = await db.collection("users").doc(user.uid).get();
        if (doc.exists && doc.data().role === "admin") {
          deleteBtn.style.display = "inline-block";
          deleteBtn.onclick = () => {
            if (confirm("이 사진을 삭제할까요?")) {
              db.collection("photos")
                .doc(photoId)
                .delete()
                .then(() => {
                  alert("삭제 완료");
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
