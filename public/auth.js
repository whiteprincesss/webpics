function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase
    .auth()
    .signInWithPopup(provider)
    .then(async (result) => {
      const user = result.user;
      const doc = await firebase
        .firestore()
        .collection("users")
        .doc(user.uid)
        .get();
      if (!doc.exists || !doc.data().nickname) {
        window.location.href = "/signup";
      } else {
        alert("✅ 로그인 성공!");
        window.location.href = "/";
      }
    })
    .catch((err) => alert("Google 로그인 오류: " + err.message));
}

function setNickname() {
  const nickname = document.getElementById("auth-nickname").value.trim();
  const user = firebase.auth().currentUser;
  if (!nickname) return alert("닉네임을 입력해주세요.");
  if (!user) return alert("로그인 정보가 없습니다.");

  firebase
    .firestore()
    .collection("users")
    .where("nickname", "==", nickname)
    .get()
    .then((snapshot) => {
      if (!snapshot.empty) {
        alert("이미 사용 중인 닉네임입니다.");
        throw new Error("중복 닉네임");
      }
      return firebase
        .firestore()
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

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    const menu = document.getElementById("menu-panel");
    if (!menu) return;

    firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        firebase
          .firestore()
          .collection("users")
          .doc(user.uid)
          .get()
          .then((doc) => {
            if (doc.exists && doc.data().nickname) {
              menu.innerHTML = `
                <div style="padding: 4px 10px; font-size: 14px; color: #666;">${
                  doc.data().nickname
                }님</div>
                <a href="/mypage"><button>마이페이지</button></a>
                <button onclick="logout()">로그아웃</button>
              `;
            }
          });
      } else {
        menu.innerHTML = `<button onclick="signInWithGoogle()">Google 로그인</button>`;
      }
    });
  }, 100); // 햄버거 메뉴 렌더링 시간 고려해서 약간 지연
});

function logout() {
  firebase
    .auth()
    .signOut()
    .then(() => {
      alert("로그아웃 되었습니다.");
      window.location.reload();
    });
}

function toggleMenu() {
  const panel = document.getElementById("menu-panel");
  panel.classList.toggle("show");
}
