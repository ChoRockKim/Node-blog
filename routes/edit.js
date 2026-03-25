const router = require("express").Router();
const { ObjectId } = require("mongodb");
const { upload } = require("../middlewares/imgUpload");
const uploadToS3 = require("../utils/uploadToS3");

// 글 수정 페이지 렌더링
router.get("/edit/:id", async (req, res) => {
  let db = req.db;
  // 로그인 확인
  if (!req.user) {
    return res.redirect("/list");
  }
  const id = req.params.id;
  const result = await db.collection("post").findOne({ _id: new ObjectId(id) });
  // 작성자 확인
  if (result.author.email != req.user.email) {
    return res.redirect("/list");
  }
  res.render("edit.ejs", { post: result });
});

router.patch("/edit", upload.single("img1"), async (req, res) => {
  let db = req.db;
  const { title, content, _id } = req.body;
  try {
    if (!content.trim() || !title.trim()) {
      res.status(400).send({ message: "모든 항목을 채워야 합니다." });
    }
    if (req.file) {
      thumbnailImageUrl = await uploadToS3(req.file, req.user.username);
    }
    const summary = content
      .replace(/[#*`>]/g, "") // #, *, `, > 기호 제거
      .replace(/\[.*?\]\(.*?\)/g, "") // [링크](주소) 형태 제거
      .replace(/!\[.*?\]\(.*?\)/g, "") // ![이미지](주소) 형태 제거
      .slice(0, 150); // 앞부분 150자만 추출
    const editedPost = {
      summary,
      updatedAt: new Date(),
      title,
      content,
    };
    await db
      .collection("post")
      .updateOne({ _id: new ObjectId(_id) }, { $set: editedPost });
    res.status(200).send({ message: "글이 수정되었습니다." });
  } catch (error) {
    res.status(500).send({ message: error });
  }
});

module.exports = router;
