const router = require("express").Router();
const { upload } = require("../middlewares/imgUpload");
const { uploadToS3 } = require("../utils/uploadToS3");
const checkLogin = require("../middlewares/checkLogin");

// 이미지 선제 업로드
router.post(
  "/upload-image",
  checkLogin,
  upload.single("img1"),
  async (req, res) => {
    try {
      if (!req.file)
        return res.status(400).json({ message: "파일이 없습니다." });

      // 공통 함수 사용해서 S3에 올리고 주소 받기
      const imageUrl = await uploadToS3(req.file, req.user.username);

      // 에디터가 요구하는 JSON 형식으로 응답
      res.status(200).json({ url: imageUrl });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "이미지 서버 업로드 실패" });
    }
  },
);

module.exports = router;
