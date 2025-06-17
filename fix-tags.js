require("dotenv").config();
const admin = require("firebase-admin");

const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_CONFIG, "base64").toString("utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const firestore = admin.firestore();

async function fixTags() {
  const snapshot = await firestore.collection("photos").get();
  let updated = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const tags = data.tags;

    if (typeof tags === "string") {
      // 문자열 → 배열로 변환
      await doc.ref.update({
        tags: [tags],
      });
      console.log(`✅ ${doc.id} 문서 수정됨: [${tags}]`);
      updated++;
    }
  }

  console.log(`🎉 수정 완료: ${updated}개 문서가 배열로 변환되었습니다.`);
}

fixTags().catch((err) => {
  console.error("❌ 오류 발생:", err);
});
