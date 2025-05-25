// 🔐 Firebase Auth + Firestore + 회원가입 확장
const auth = firebase.auth();
const db = firebase.firestore();
let mode = "login";

function submitAuthPage(mode) {
  const email = document.getElementById("auth-email").value;
  const pw = document.getElementById("auth-password").value;
  const nickname = document.getElementById("auth-nickname")?.value?.trim();

  if (mode === "login") {
    auth.signInWithEmailAndPassword(email, pw)
      .then(() => {
        alert("✅ 로그인 성공!");
        window.location.href = "/";
      })
      .catch(err => alert("로그인 오류: " + err.message));
  } else {
    if (!nickname) {
      alert("닉네임을 입력해주세요.");
      return;
    }

    // 닉네임 중복 체크
    db.collection("users").where("nickname", "==", nickname).get()
      .then(snapshot => {
        if (!snapshot.empty) {
          alert("이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해주세요.");
        } else {
          // 닉네임 중복 아님 → 회원 생성
          auth.createUserWithEmailAndPassword(email, pw)
            .then(userCred => {
              const uid = userCred.user.uid;
              return db.collection("users").doc(uid).set({ nickname });
            })
            .then(() => {
              alert("🎉 회원가입 완료! 로그인 해주세요.");
              window.location.href = "/login";
            })
            .catch(err => alert("회원가입 오류: " + err.message));
        }
      })
      .catch(err => alert("닉네임 확인 오류: " + err.message));
  }
}

auth.onAuthStateChanged(user => {
  if (user) {
    console.log("🔓 로그인됨:", user.email);
  } else {
    console.log("🔒 로그아웃 상태");
  }
});
auth.onAuthStateChanged(user => {
  const menu = document.getElementById("menu-panel");
  if (!menu) return;

  if (user) {
    // 로그인 상태
    menu.innerHTML = `
      <a href="/mypage"><button>마이페이지</button></a>
      <button onclick="logout()">로그아웃</button>
    `;
  } else {
    // 비로그인 상태
    menu.innerHTML = `
      <a href="/login"><button>로그인</button></a>
      <a href="/signup"><button>회원가입</button></a>
    `;
  }
});

function logout() {
  auth.signOut().then(() => {
    alert("로그아웃 되었습니다.");
    window.location.reload();
  });
}
