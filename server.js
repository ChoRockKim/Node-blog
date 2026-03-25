const express = require("express");
const app = express();
require("dotenv").config(); // .env파일
const { ObjectId } = require("mongodb");
const bcrypt = require("bcrypt"); //비밀번호 해싱
const nodemailer = require("nodemailer"); //메일 인증

app.use(express.static(__dirname + "/public"));
app.set("view engine", "ejs");
app.use(express.json()); // json 통신
app.use(express.urlencoded({ extended: true }));
const md = require("markdown-it")({
  highlight: function (str, lang) {
    return '<pre class="hljs"><code>' + str + "</code></pre>";
  },
});

const session = require("express-session"); // 로그인 세션
const passport = require("passport");
const LocalStrategy = require("passport-local");
const MongoStore = require("connect-mongo").default;
const checkLogin = require("./middlewares/checkLogin");
const generateRandomCode = require("./utils/generateRandomCode");

// socket.io 설정
const { createServer } = require("http");
const { Server } = require("socket.io");
const server = createServer(app);
const io = new Server(server);

// 세션 미들웨어
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET, // 세션용 비밀번호
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 12 * 60 * 60 * 1000 },
  store: MongoStore.create({
    // mongodb와 세션 연결
    mongoUrl: `mongodb+srv://daejincnc2:${process.env.DB_PASSWORD}@nodeblog.jreokmg.mongodb.net/?appName=NodeBlog`,
    dbName: "forum",
  }),
});
app.use(sessionMiddleware);
io.engine.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

// S3 연결 설정
const connectDB = require("./routes/database");
const console = require("console");

const PORT = process.env.PORT || 8080;
// MongoDB 연결
let db;
connectDB
  .then((client) => {
    console.log("DB연결성공");
    db = client.db("forum");

    server.listen(PORT, () => {
      console.log("http://localhost:8080 에서 서버 실행중");
    });
  })
  .catch((err) => {
    console.log(err);
  });
//모든 라우터에 db를 쓸 수 있게 담아줌
app.use((req, res, next) => {
  req.db = db;
  next();
});
// 모든 ejs 파일에 유저 로그인 정보 바인딩
app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});
// 로그인 요청 처리 로직
passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (userInputEmail, userInputPassword, cb) => {
      let result = await db
        .collection("users")
        .findOne({ email: userInputEmail });
      console.log(result);
      if (!result) {
        return cb(null, false, { message: "존재하지 않는 이메일입니다." });
      }
      const isMatch = await bcrypt.compare(userInputPassword, result.password);
      if (isMatch) {
        return cb(null, result);
      } else {
        return cb(null, false, { message: "비밀번호가 일치하지 않습니다." });
      }
    },
  ),
);
// 세션 발행 <- req.login() 쓰면 실행
passport.serializeUser((user, done) => {
  process.nextTick(() => {
    done(null, {
      email: user.email,
      username: user.username,
      id: user._id,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  });
});
// 쿠키를 분해하는 코드(세션 쿠기를 가지고 있는 유저가 요청 날릴 때 마다 실행됨)
passport.deserializeUser(async (user, done) => {
  // 최신 유저 정보를 조회
  let result = await db
    .collection("users")
    .findOne({ _id: new ObjectId(user.id) });
  delete result?.password;
  process.nextTick(() => {
    done(null, result);
  });
});
//메인페이지 라우팅
app.use("/", require("./routes/list"));
// 글 작성 페이지
app.get("/write", (req, res) => {
  // 로그인되어있지 않다면 로그인 페이지로 리다이렉팅
  if (!req.user) {
    res.redirect("/login");
    return;
  }
  if (req.user.role !== "admin") {
    return res.redirect("/");
  }

  res.render("write.ejs");
});

// 이미지 선제 업로드
app.use("/", require("./routes/img"));

//글 작성 로직
app.use("/", require("./routes/newpost"));

// 글 세부사항 페이지 렌더링
app.use("/", require("./routes/detail"));

// 글 수정 페이지 렌더링/로직
app.use("/", require("./routes/edit"));

// 회원가입 페이지
app.use("/register", require("./routes/register"));

// 회원가입 요청 처리
// app.post("/register", async (req, res) => {
//   const user_data = req.body;
//   //이미 가입된 정보가 있는지 확인
//   try {
//     if (await db.collection("users").findOne({ email: user_data.email })) {
//       return res.status(400).send({ message: "이미 존재하는 이메일입니다." });
//     } else if (
//       await db.collection("users").findOne({ username: user_data.username })
//     ) {
//       return res.status(400).send({ message: "이미 존재하는 별명입니다." });
//     }
//   } catch (error) {
//     res.status(500).send({ message: "네트워크 오류", error: error });
//   }
//   // 이메일 인증되지 않았다면 거부 / 인젝션 방어
//   const isVerified = await db
//     .collection("unverifiedUsers")
//     .findOne({ email: user_data.email });
//   if (isVerified.verified === false) {
//     // console.log('사용자 이메일 인증 상태', isVerified)
//     res.status(400).json({ message: "잘못된 요청입니다." });
//     return;
//   }
//   //해싱 소금치기
//   const saltRounds = 10;
//   //유저 정보 전처리
//   user_data.password = await bcrypt.hash(user_data.password, saltRounds); // 비밀번호 해싱
//   user_data.role = "user"; // 유저 역할
//   user_data.createdAt = new Date().toLocaleDateString("kr"); // 가입 날짜
//   user_data.updatedAt = ""; // 본인 정보 수정 날짜
//   user_data.emailVerifed = true; // 이메일 인증 정보
//   user_data.img = "";
//   // 유저 정보 DB에 저장
//   try {
//     db.collection("users").insertOne(user_data);
//     res.status(200).json({ message: "회원가입에 성공하셨습니다." });
//   } catch (error) {
//     res
//       .status(500)
//       .json({ message: "회원가입에 실패하였습니다.", error: error });
//   }
// });

// 이메일 인증 용 메일발송 객체 생성
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "daejincnc2@gmail.com", // 인증 메일 발송 용 이메일
    pass: process.env.EMAIL_PASSWORD, // 구글 앱 비밀번호
  },
});

// 이메일로 인증코드 전송 + db에 유저 인증정보 저장 로직
app.post("/api/send-auth-email", async (req, res) => {
  try {
    const { email } = req.body;
    // 이미 존재하는 회원인지 확인
    if (await db.collection("users").findOne({ email: email })) {
      res.status(409).json({ message: "이미 가입된 이메일입니다." });
      return;
    }
    // 이메일 인증용 6자리 랜덤 코드 생성
    const authCode = generateRandomCode();
    // 이미 요청된 이메일인지 확인
    await db.collection("auth_codes").deleteOne({ email: email });
    await db.collection("unverifiedUsers").deleteOne({ email: email });
    // 유저 이메일과 생성된 코드를 db에 저장
    await db.collection("auth_codes").insertOne({
      email: email,
      code: authCode,
      createdAt: new Date(),
    });
    await db
      .collection("unverifiedUsers")
      .insertOne({ email: email, verified: false });

    // 이메일 객체 생성
    const mailOptions = {
      from: "daejincnc2@gmail.com", // 발송하는 이메일
      to: email, // 사용자의 이메일
      subject: "[초록 블로그] 회원가입 이메일 인증 번호입니다.",
      html: `
            <div style="font-family: sans-serif; text-align: center; padding: 20px;">
            <h2>회원가입 인증 번호</h2>
            <p>아래 6자리 번호를 회원가입 창에 입력해주세요.</p>
            <div style="background-color: #f4f4f4; padding: 15px; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #333;">
                ${authCode}
            </div>
            </div>
        `,
    };
    // 생성된 객체 전송
    await transporter.sendMail(mailOptions);
    res.status(200).send({ message: "인증 메일이 발송되었습니다." });
  } catch (error) {
    // console.log(error)
    res.status(500).send({
      message: "인증 메일 발송이 실패하였습니다. 잠시후 다시 시도해주세요.",
    });
  }
});
// 유저가 제출한 인증코드 비교 로직
app.post("/api/verify-code", async (req, res) => {
  try {
    const { code, email } = req.body;

    const savedData = await db
      .collection("auth_codes")
      .findOne({ email: email });
    // 인증번호 요청이 없었을 경우 방어 처리
    if (!savedData) {
      return res.status(400).json({ message: "인증번호를 먼저 요청해주세요." });
    }
    // 코드가 일치할 경우
    if (savedData.code === code) {
      // db에 저장된 정보 삭제
      await db.collection("auth_codes").deleteOne({ email: email });
      await db
        .collection("unverifiedUsers")
        .updateOne({ email: email }, { $set: { verified: true } });
      res.status(200).json({ message: "이메일 인증이 완료되었습니다!" });
    } else {
      res
        .status(400)
        .json({ message: "인증번호가 틀렸습니다. 다시 확인해주세요." });
    }
  } catch (error) {
    res.status(500).json({ message: "네트워크 에러", error: error });
  }
});
// 로그인 페이지 렌더링
app.use("/", require("./routes/login"));
// 유저 로그인 요청 로직
app.post("/login", async (req, res, next) => {
  passport.authenticate("local", (error, user, info) => {
    // 에러 시
    if (error) return res.status(500).json(error);
    // 유저 정보가 틀렸을 시
    if (!user) return res.status(401).json({ message: info.message });
    // 로그인 요청
    req.logIn(user, (err) => {
      if (err) return next(err);
      console.log(user);
      res.status(200).json({ message: "로그인을 성공했습니다." });
    });
  })(req, res, next);
});
// 유저 로그아웃 요청 로직
app.get("/logout", (req, res) => {
  // 로그아웃 에러 처리
  req.logout((err) => {
    if (err) {
      // console.log('로그아웃 실패')
      return next(err);
    }
    // 세션 없애기
    req.session.destroy(() => {
      // 세션 없앤 후 메인페이지로 리다이렉트
      res.redirect("/");
    });
  });
});
// 마이 페이지 라우팅
app.use("/my-page", require("./routes/my-page"));

// 댓글 라우팅
app.use("/", require("./routes/comment"));

// 채팅방 라우터
app.use("/", require("./routes/chat"));

// 다른 유저 정보 페이지
app.use("/", require("./routes/user"));

// 웹소켓 설정
io.on("connection", (socket) => {
  // 룸 개설 요청
  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    io.emit("roomOk", `${roomId} 룸 생성 완료`);
  });
  // 메세지 수신 + db 저장
  socket.on("message", async (data) => {
    try {
      messageDTO = {
        roomId: new ObjectId(data.room),
        senderId: new ObjectId(data.sender),
        content: data.msg,
        isRead: false,
        createdAt: new Date(),
      };
      const result = await db.collection("messages").insertOne(messageDTO);
      await db
        .collection("conversations")
        .updateOne(
          { _id: new ObjectId(data.room) },
          { $set: { lastMessage: data.msg, updatedAt: new Date() } },
        );
      const broadcastMsg = {
        ...messageDTO,
        messageId: result.insertedId,
      };
      console.log(broadcastMsg);
      io.to(data.room).emit("sentMessage", broadcastMsg);
      console.log("저장 함");
    } catch (error) {
      console.log("저장 실패함", error);
    }
  });
});

// 만드는 과정 정리
// 1. 채팅방에 들어갈 시 룸 생성(conversations id)
// 2. 채팅을 입력(해당 유저 정보 + 메시지 -> 룸으로 전달)
// 3. DB에 저장(부모ID = RoomId, 유저객체, 메시지 내용, 보낸날짜), session = socket.request.session 에 세션 정보 들어있음
// 4. DB에 저장한 메시지를 날려주기

// 400 에러처리 미들웨어
app.use((req, res, next) => {
  res.status(404).render("error.ejs", {
    message: "요청하신 페이지를 찾을 수 없습니다.",
  });
});
