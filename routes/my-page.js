const router = require("express").Router();
const { upload } = require("../middlewares/imgUpload");
const checkLogin = require("../middlewares/checkLogin");
const sharp = require("sharp"); // 이미지 압축
const { s3Client } = require("../models/s3Client");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { ObjectId } = require("mongodb");

// 마이 페이지 라우팅
router.get("/", (req, res) => {
  if (!req.user) {
    return res.redirect("/");
  }
  res.render("my-page.ejs");
});
// 프로필 이미지 업로드
router.post(
  "/img",
  checkLogin,
  upload.single("profileImg"),
  async (req, res) => {
    let db = req.db;
    try {
      if (!req.file) {
        return res.status(400).send({ message: "업로드할 파일이 없습니다." });
      }
      // Sharp를 이용한 프로필 이미지 최적화
      const optimizedBuffer = await sharp(req.file.buffer)
        .resize(300, 300, { fit: "cover", position: "center" })
        .webp({ quality: 90 })
        .toBuffer();
      // S3 파일명 설정
      const fileName = `profiles/${req.user._id}-${Date.now()}.webp`;
      // AWS S3에 업로드
      const params = {
        Bucket: "nodeblogforum0530",
        Key: fileName,
        Body: optimizedBuffer,
        ContentType: "image/webp",
      };
      await s3Client.send(new PutObjectCommand(params));
      // 업로드된 새 이미지 URL 생성
      const newImageUrl = `https://nodeblogforum0530.s3.ap-southeast-2.amazonaws.com/${fileName}`;
      //  DB 업데이트
      await db
        .collection("users")
        .updateOne(
          { _id: new ObjectId(req.user._id) },
          { $set: { img: newImageUrl } },
        );
      return res.status(200).json({
        message: "사진 업로드 성공",
        url: newImageUrl,
      });
    } catch (error) {
      console.error("프로필 업로드 에러:", error);
      return res.status(500).json({ message: "사진 업로드 실패" });
    }
  },
);

module.exports = router;
