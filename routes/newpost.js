const router = require("express").Router();
const checkLogin = require("../middlewares/checkLogin");
const { upload } = require("../middlewares/imgUpload");
const { uploadToS3 } = require("../utils/uploadToS3");
const md = require("markdown-it")();
const container = require("markdown-it-container");

//글 작성 로직
router.post("/newpost", checkLogin, upload.single("img1"), async (req, res) => {
  let db = req.db;
  try {
    const { title, content } = req.body;
    let thumbnailImageUrl = null;

    if (req.file) {
      thumbnailImageUrl = await uploadToS3(req.file, req.user.username);
    }

    const summary = content
      .replace(/[#*`>]/g, "") // #, *, `, > 기호 제거
      .replace(/\[.*?\]\(.*?\)/g, "") // [링크](주소) 형태 제거
      .replace(/!\[.*?\]\(.*?\)/g, "") // ![이미지](주소) 형태 제거
      .slice(0, 150); // 앞부분 150자만 추출

    const newPost = {
      title,
      content, //
      summary,
      img: thumbnailImageUrl,
      createdAt: new Date(),
      author: {
        username: req.user.username,
        email: req.user.email,
        img: req.user.img,
      },
      updatedAt: new Date(),
    };

    await db.collection("post").insertOne(newPost);
    res.status(200).json({ message: "글을 작성하였습니다." });
  } catch (error) {
    res.status(500).json({ message: "서버 에러" });
  }
});

module.exports = router;
