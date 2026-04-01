const { ObjectId } = require("mongodb");
const md = require("markdown-it")({
  langPrefix: "language-",
});
const router = require("express").Router();
const checkLogin = require("../middlewares/checkLogin");

// 글 세부사항 페이지 렌더링
router.get("/detail/:id", async (req, res) => {
  const db = req.db;
  res.set("Cache-Control", "no-store");
  try {
    const id = req.params;
    const result = await db
      .collection("post")
      .findOne({ _id: new ObjectId(id) });
    // db에서 null 값 왔을 경우 리다이렉트
    if (result === null) {
      return res.redirect("/list");
    }
    const category = await db
      .collection("category")
      .findOne({ _id: new ObjectId(result.category) });

    if (category) {
      result.category = category.name;
    }

    const comments = await db
      .collection("comments")
      .find({ parent: new ObjectId(id) })
      .toArray();

    const contentHtml = md.render(result.content);

    res.render("detail.ejs", {
      post: result,
      comment: comments,
      contentHtml: contentHtml,
    });
    // 이상한 값을 입력했을 경우 리다이렉트
  } catch (error) {
    return res.redirect("/list");
  }
});

// 글 삭제 요청 처리
router.delete("/detail", checkLogin, async (req, res) => {
  let db = req.db;
  if (!req.user) {
    return res.status(400).send({ message: "로그인하셔야 합니다." });
  }
  const result = await db
    .collection("post")
    .findOne({ _id: new ObjectId(req.body._id) });
  if (req.user.role !== "admin") {
    if (result.author.email != req.user.email) {
      return res.status(400).send({ message: "권한이 없습니다." });
    }
  }
  try {
    db.collection("post").deleteOne({ _id: new ObjectId(req.body._id) });
    res.status(200).send({ message: "게시글이 삭제되었습니다." });
  } catch (error) {
    res.status(500).send({ message: "네트워크 오류" });
  }
});

module.exports = router;
