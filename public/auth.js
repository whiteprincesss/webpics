// 🔐 Firebase 초기화
const firebaseConfig = {
  apiKey: "AIzaSyBBMlsw1GCv2igg73oGrolGqcQVTIgHsyE",
  authDomain: "webpics-b2443.firebaseapp.com",
  projectId: "webpics-b2443",
  storageBucket: "webpics-b2443.appspot.com",
  messagingSenderId: "996418354850",
  appId: "1:996418354850:web:86f4484bf0a732b7d761fb",
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// ✅ 구글 로그인
function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth
    .signInWithPopup(provider)
    .then(async (result) => {
      const user = result.user;
      const doc = await db.collection("users").doc(user.uid).get();
      if (!doc.exists || !doc.data().nickname) {
        window.location.href = "/signup";
      } else {
        alert("✅ 로그인 성공!");
        window.location.href = "/";
      }
    })
    .catch((err) => alert("Google 로그인 오류: " + err.message));
}

// ✅ 닉네임 설정
function setNickname() {
  const nickname = document.getElementById("auth-nickname").value.trim();
  const user = auth.currentUser;
  if (!nickname) return alert("닉네임을 입력해주세요.");
  if (!user) return alert("로그인 정보가 없습니다.");

  db.collection("users")
    .where("nickname", "==", nickname)
    .get()
    .then((snapshot) => {
      if (!snapshot.empty) {
        alert("이미 사용 중인 닉네임입니다.");
        throw new Error("중복 닉네임");
      }
      return db
        .collection("users")
        .doc(user.uid)
        .set({ nickname }, { merge: true });
    })
    .then(() => {
      alert("🎉 닉네임 설정 완료!");
      window.location.href = "/";
    })
    .catch((err) => {
      console.error("닉네임 오류:", err);
      if (err.message !== "중복 닉네임") {
        alert("닉네임 등록 중 오류가 발생했습니다.");
      }
    });
}

// ✅ 메뉴 렌더링
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    const menu = document.getElementById("menu-panel");
    if (!menu) return;

    auth.onAuthStateChanged((user) => {
      if (user) {
        db.collection("users")
          .doc(user.uid)
          .get()
          .then((doc) => {
            if (doc.exists && doc.data().nickname) {
              menu.innerHTML = `
                <div class="menu-user">👤 ${doc.data().nickname}님</div>
                <div class="menu-actions">
                  <a href="/mypage" class="menu-btn">마이페이지</a>
                  <button class="menu-btn" onclick="logout()">로그아웃</button>
                </div>
              `;
            }
          });
      } else {
        menu.innerHTML = `<button onclick="signInWithGoogle()">Google 로그인</button>`;
      }
    });
  }, 100);
});

// ✅ 로그아웃
function logout() {
  auth.signOut().then(() => {
    alert("로그아웃 되었습니다.");
    window.location.reload();
  });
}

// ✅ 햄버거 메뉴 토글
function toggleMenu() {
  const panel = document.getElementById("menu-panel");
  if (panel) {
    panel.classList.toggle("show");
  }
}
