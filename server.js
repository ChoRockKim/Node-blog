const express = require('express')
const app = express()
require('dotenv').config(); // .env파일
const { MongoClient, ObjectId } = require('mongodb')
const bcrypt = require('bcrypt'); //비밀번호 해싱
const nodemailer = require('nodemailer'); //메일 인증

app.use(express.static(__dirname + '/public'))
app.set('view engine', 'ejs')
app.use(express.json()) // json 통신
app.use(express.urlencoded({extended:true}))

const session = require('express-session') // 로그인 세션
const passport = require('passport')
const LocalStrategy = require('passport-local')
const MongoStore = require('connect-mongo').default;

app.use(session({
  secret: process.env.SESSION_KEY, // 세션용 비밀번호
  resave : false,
  saveUninitialized : false,
  cookie : { maxAge : 60 * 60 * 1000 },
  store : MongoStore.create({ // mongodb와 세션 연결
    mongoUrl : `mongodb+srv://daejincnc2:${process.env.DB_PASSWORD}@nodeblog.jreokmg.mongodb.net/?appName=NodeBlog`,
    dbName : 'forum'
  })
}))
app.use(passport.initialize())

app.use(passport.session())

// S3 연결 설정
const { S3Client } = require('@aws-sdk/client-s3')
const multer = require('multer')
const multerS3 = require('multer-s3');
const connectDB = require('./routes/database');
const s3 = new S3Client({
  region : 'ap-southeast-2',
  credentials : {
      accessKeyId : process.env.S3_ACCESS_KEY,
      secretAccessKey : process.env.S3_ACCESS_SECRET_KEY
  }
})
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: 'nodeblogforum0530',
    key: function (req, file, cb) {
      cb(null, Date.now().toString()) //업로드시 파일명 변경가능
    }
  })
})
// MongoDB 연결
let db;
connectDB.then((client)=>{
  console.log('DB연결성공')
  db = client.db('forum')

  app.listen(process.env.PORT, () => {
    console.log('http://localhost:8080 에서 서버 실행중')
  })
}).catch((err)=>{
  console.log(err)
})
//모든 라우터에 db를 쓸 수 있게 담아줌
app.use((req, res, next) => {
    req.db = db;
    next();
})
// 모든 ejs 파일에 유저 로그인 정보 바인딩
app.use((req, res, next) => {
    res.locals.user = req.user; 
    next();
});
// 로그인 요청 처리 로직
passport.use(new LocalStrategy({
        usernameField: 'email', 
        passwordField: 'password'  
    } ,async (userInputEmail, userInputPassword, cb) => {
    
    let result = await db.collection('users').findOne({email : userInputEmail})
    console.log(result)
    if (!result) {
        return cb(null, false, {message : '존재하지 않는 이메일입니다.'})
    }
    const isMatch = await bcrypt.compare(userInputPassword, result.password)
    if (isMatch) {
        return cb(null, result)
    } else {
        return cb(null, false, {message : '비밀번호가 일치하지 않습니다.'})
    }
}))
// 세션 발행 <- req.login() 쓰면 실행
passport.serializeUser((user, done) => {
    process.nextTick(() => {
        done(null, {email : user.email, username : user.username, id : user._id, createdAt : user.createdAt, updatedAt : user.updatedAt})
    })
})
// 쿠키를 분해하는 코드(세션 쿠기를 가지고 있는 유저가 요청 날릴 때 마다 실행됨)
passport.deserializeUser(async (user, done) => {
    // 최신 유저 정보를 조회
    let result = await db.collection('users').findOne({_id : new ObjectId(user.id)})
    delete result.password;
    process.nextTick(() => {
        done(null, result)
    })
})
// 로그인 확인하는 미들웨어 정의
const checkLogin = (req, res, next) => {
    if (!req.user){
        res.status(500).send({message : "로그인해야 합니다."})
        return
    } else {
        next()
    }
}
//메인페이지 라우팅
app.use('/', require('./routes/list'));
// 글 작성 페이지
app.get('/write', (req, res) => {
    // 로그인되어있지 않다면 로그인 페이지로 리다이렉팅
    if (!req.user){
        res.redirect('/login')
        return
    }
    res.render('write.ejs')
})
//글 작성 로직
app.post('/newpost', checkLogin, async (req, res) => {    
    upload.single('img1')(req, res, async (err) => {
        // 이미지 업로드 에러 처리
        if (err) return res.status(500).send({message : '이미지 업로드에 실패하였습니다.'})
            try {
                let post = req.body;
                post.img = req.file?.location
                // 임베딩 시킬 작성자 객체 생성
                let author = {
                    username : req.user.username,
                    email : req.user.email,
                    img : req.user.img
                }
                post.createdAt = new Date();
                post.author = author;
                //유효성 검사
                if (!post.title.trim() || !post.content.trim()){
                    res.status(400).send({ message : '모든 칸을 채워주세요!' })
                    return
                }
                const result = await db.collection('post').insertOne(post)
            } 
            catch (error) {
                res.status(500).send({ message : error })
            }
            res.status(200).send({ message : '글을 작성하였습니다.' })        
    })
})
// 글 세부사항 페이지 렌더링
app.get('/detail/:id', async (req, res) => {
    try {
        const id = req.params;
        const result = await db.collection('post').findOne({ _id : new ObjectId(id)})
        const comments = await db.collection('comments').find({ parent : new ObjectId(id)}).toArray();
        // db에서 null 값 왔을 경우 리다이렉트
        if (result === null) {
            return res.redirect('/list')
        }
        res.render('detail.ejs', { post : result, comment : comments}); 
        // 이상한 값을 입력했을 경우 리다이렉트
    } catch (error) {
        return res.redirect('/list')
    }
})
// 글 수정 페이지 렌더링
app.get('/edit/:id', async (req, res) => {
    // 로그인 확인
    if (!req.user){
        return res.redirect('/list')
    }
    const id = req.params.id;
    const result = await db.collection('post').findOne({ _id : new ObjectId(id)})
    // 작성자 확인
    if (result.author.email != req.user.email){
        return res.redirect('/list')
    }
    res.render('edit.ejs', {post : result})
})
// 글 수정 요청 처리
app.patch('/edit', (req, res) => {
    const data = req.body;
    data._id = new ObjectId(data._id)
    try {
        if (!data.content.trim() || !data.title.trim()){
            res.status(400).send({message : '모든 항목을 채워야 합니다.'})
            return
        }
        db.collection('post').updateOne({ _id : data._id }, { $set :{ title : data.title, content : data.content}});
        res.status(200).send({message : '글이 수정되었습니다.'})

    } catch (error) {
        res.status(500).send({message : error})
    }
})
// 글 삭제 요청 처리
app.delete('/detail', checkLogin, async (req, res) => {
    if (!req.user){
        return res.status(400).send({message:'로그인하셔야 합니다.'})
    }
    const result = await db.collection('post').findOne({ _id : new ObjectId(req.body._id)})
    if (result.author.email != req.user.email){
        return res.status(400).send({message:'권한이 없습니다.'})
    }
    try {
        db.collection('post').deleteOne({_id : new ObjectId(req.body._id),})
        res.status(200).send({message : '게시글이 삭제되었습니다.'})
    } catch (error) {
        res.status(500).send({message : '네트워크 오류'})
    }
})
// 회원가입 페이지
app.get('/register', (req, res) => {
    if (req.user){
        res.redirect('/list')
        return
    }
    res.render('register.ejs')
})
// 회원가입 요청 처리
app.post('/register', async (req, res) => {
    const user_data = req.body
    //이미 가입된 정보가 있는지 확인
    try {
        if (await db.collection('users').findOne({ email : user_data.email })){
            return res.status(400).send({message:'이미 존재하는 이메일입니다.'})
            
        } else if (await db.collection('users').findOne({ username : user_data.username})){
            return res.status(400).send({message:'이미 존재하는 별명입니다.'})
        }
    } catch (error) {
        res.status(500).send({message:'네트워크 오류', error : error})
    }
    // 이메일 인증되지 않았다면 거부 / 인젝션 방어
    const isVerified = await db.collection('unverifiedUsers').findOne({email : user_data.email})
    if (isVerified.verified === false) {
        console.log('사용자 이메일 인증 상태', isVerified)
        res.status(400).json({message : '잘못된 요청입니다.'})
        return
    }
    //해싱 소금치기
    const saltRounds = 10;
    //유저 정보 전처리
    user_data.password = await bcrypt.hash(user_data.password, saltRounds); // 비밀번호 해싱
    user_data.role = 'user' // 유저 역할 
    user_data.createdAt = new Date().toLocaleDateString('kr'); // 가입 날짜
    user_data.updatedAt = ''; // 본인 정보 수정 날짜
    user_data.emailVerifed = true; // 이메일 인증 정보
    user_data.img = "";
    // 유저 정보 DB에 저장
    try {
        db.collection('users').insertOne(user_data)
        res.status(200).json({message : '회원가입에 성공하셨습니다.'})
    } catch (error) {
        res.status(500).json({message : '회원가입에 실패하였습니다.', error : error})
    }
})
// 이메일 인증 용 메일발송 객체 생성
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'daejincnc2@gmail.com', // 인증 메일 발송 용 이메일
    pass: process.env.EMAIL_PASSWORD // 구글 앱 비밀번호
  }
});
// 이메일 인증용 6자리 랜덤코드 생성 함수
const generateRandomCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};
// 이메일로 인증코드 전송 + db에 유저 인증정보 저장 로직
app.post('/api/send-auth-email', async (req, res) => {
    try {
        const { email } = req.body;
        // 이미 존재하는 회원인지 확인
        if (await db.collection('users').findOne({email : email})){
            res.status(409).json({message : "이미 가입된 이메일입니다."})
            return
        }
        // 이메일 인증용 6자리 랜덤 코드 생성
        const authCode = generateRandomCode();
        // 이미 요청된 이메일인지 확인
        await db.collection('auth_codes').deleteOne({email : email})
        await db.collection('unverifiedUsers').deleteOne({email : email})
        // 유저 이메일과 생성된 코드를 db에 저장
        await db.collection('auth_codes').insertOne({ 
            email: email, 
            code: authCode,
            createdAt: new Date()
        });
        await db.collection('unverifiedUsers').insertOne({ email : email, verified : false})

        // 이메일 객체 생성
        const mailOptions = {
        from: 'daejincnc2@gmail.com', // 발송하는 이메일
        to: email, // 사용자의 이메일
        subject: '[초록 블로그] 회원가입 이메일 인증 번호입니다.',
        html: `
            <div style="font-family: sans-serif; text-align: center; padding: 20px;">
            <h2>회원가입 인증 번호</h2>
            <p>아래 6자리 번호를 회원가입 창에 입력해주세요.</p>
            <div style="background-color: #f4f4f4; padding: 15px; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #333;">
                ${authCode}
            </div>
            </div>
        `};
        // 생성된 객체 전송
        await transporter.sendMail(mailOptions);
        res.status(200).send({message:"인증 메일이 발송되었습니다."})
                
    } catch (error) {
        console.log(error)
        res.status(500).send({message : "인증 메일 발송이 실패하였습니다. 잠시후 다시 시도해주세요."})
    }
})
// 유저가 제출한 인증코드 비교 로직
app.post('/api/verify-code', async (req, res) => {
    try {
        const {code, email} = req.body;
        
        const savedData = await db.collection('auth_codes').findOne({email : email})
        // 인증번호 요청이 없었을 경우 방어 처리
        if (!savedData) {
            return res.status(400).json({ message: '인증번호를 먼저 요청해주세요.' });
        }
        // 코드가 일치할 경우
        if (savedData.code === code) {
            // db에 저장된 정보 삭제
            await db.collection('auth_codes').deleteOne({ email: email });
            await db.collection('unverifiedUsers').updateOne({email : email}, { $set :{ verified : true}})
            res.status(200).json({ message: '이메일 인증이 완료되었습니다!' });
        } else {
            res.status(400).json({ message: '인증번호가 틀렸습니다. 다시 확인해주세요.' });
        }
    } catch (error) {
        res.status(500).json({message : '네트워크 에러', error : error})
    }
})
// 로그인 페이지 렌더링
app.use('/', require('./routes/login'))
// 유저 로그인 요청 로직
app.post('/login', async (req, res, next) => {
    passport.authenticate('local', (error, user, info) => {
        // 에러 시
        if (error) return res.status(500).json(error);
        // 유저 정보가 틀렸을 시
        if (!user) return res.status(401).json({message : info.message});
        // 로그인 요청
        req.logIn(user, (err) => {
            if (err) return next(err);
            console.log(user);
            res.status(200).json({ message: '로그인을 성공했습니다.' });
        });
    })(req, res, next);
});
// 유저 로그아웃 요청 로직
app.get('/logout', (req, res) => {
    // 로그아웃 에러 처리
    req.logout((err) => {
        if (err) {
            console.log('로그아웃 실패')
            return next(err)
        }
    // 세션 없애기
    req.session.destroy(() => {
        // 세션 없앤 후 메인페이지로 리다이렉트
        res.redirect('/')
    })
    })
})
// 마이 페이지 라우팅
app.get('/my-page', (req, res) => {
    if (!req.user){
        return res.redirect('/')
    }
    res.render('my-page.ejs')
})
// 마이 페이지 프로필 사진 업로드 로직
app.post('/my-page/img', async (req, res) => {    
    upload.single('profileImg')(req, res, async (err) => {
        // 이미지 업로드 에러 처리
        if (err) return res.status(500).send({message : '이미지 업로드에 실패하였습니다.'})
            try {
                // 현재 로그인한 유저를 찾아서
                const user = await db.collection('users').findOne({ _id : new ObjectId(req.user._id) })
                // S3 이미지 위치를 추가한 후 
                user.img = req.file?.location;
                // 유저 인스턴스를 업데이트
                await db.collection('users').updateOne({_id : new ObjectId(user._id)}, { $set : { img : user.img}})
                return res.status(200).json({message : '사진 업로드 성공', url : user.img})
            } catch (error) {
                return res.status(500).json({message : '사진 업로드 실패'})
            }
    })
})
app.use('/', require('./routes/comment'))
// 채팅방 라우터
app.use('/', require('./routes/chat'))
// 다른 유저 정보 페이지
app.use('/', require('./routes/user'))

// 400 에러처리 미들웨어
app.use((req, res, next) => {
    res.status(404).render('error.ejs', { 
        message: '요청하신 페이지를 찾을 수 없습니다.' 
    });
});