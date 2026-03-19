const router = require('express').Router();

router.get('/user/:name', async (req, res) => {
    let db = req.db;
    
    try {
        const result = await db.collection('users').findOne({ username : req.params.name });
        // 유저페이지가 본인이면 마이페이지로 리다이렉트
        if (req.user?._id.toString() === result._id.toString()){
            return res.redirect('/my-page');
        }
        // 유저DTO 생성
        const { _id, username, createdAt, img, email} = result;
        const userDTO = {_id, username, createdAt, img, email};
    
        res.render('user-profile.ejs', { userDTO : userDTO})
    } catch (error) {
        // 해당 유저가 없으면 error 페이지
        return res.render('error.ejs');
    }
})


module.exports = router;