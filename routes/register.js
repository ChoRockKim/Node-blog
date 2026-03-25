const router = require("express").Router();
const bcrypt = require("bcrypt"); //비밀번호 해싱

// 회원가입페이지 라우팅
router.get("/", (req, res) => {
  if (req.user) {
    res.redirect("/list");
    return;
  }
  res.render("register.ejs");
});

// 회원가입 요청 처리
router.post("/", async (req, res) => {
  const db = req.db;
  const { email, username, password } = req.body; // 필요한 것만 딱 꺼내기

  try {
    const existingUser = await db.collection("users").findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      return res
        .status(400)
        .json({ message: "이미 존재하는 이메일이나 별명입니다." });
    }

    const verifyStatus = await db
      .collection("unverifiedUsers")
      .findOne({ email });
    if (!verifyStatus || !verifyStatus.verified) {
      return res
        .status(400)
        .json({ message: "이메일 인증이 완료되지 않았습니다." });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = {
      email,
      username,
      password: hashedPassword,
      role: "user",
      createdAt: new Date().toLocaleDateString("kr"),
      emailVerified: true,
      img: "",
    };

    await db.collection("users").insertOne(newUser);
    res.status(200).json({ message: "회원가입에 성공하셨습니다." });
  } catch (error) {
    console.error("회원가입 에러:", error);
    res.status(500).json({ message: "서버 내부 오류가 발생했습니다." });
  }
});

module.exports = router;
