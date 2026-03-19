const { ObjectId } = require('mongodb');

const router = require('express').Router();

// 댓글 작성 처리
router.post('/detail/comment', async (req, res)=>{
    if (!req.user){
        res.status(400).json({message : '로그인하셔야 합니다.'})
    }
    let db = req.db;
    try {
        data = req.body;
        data.parent = new ObjectId(data.parent);
        data.commentor.id = new ObjectId(data.commentor.id)
        await db.collection('comments').insertOne(req.body); 
        res.status(200).json({message : '댓글이 게시되었습니다.'})
    } catch (error) {
        res.status(500).json({message : '댓글 등록에 실패하였습니다.'})
    }  
})

//댓글 수정 처리
router.patch('/detail/comment', async (req, res) => {
    let db = req.db;
    console.log(req.body);
    // 사용자 로그인 정보부터 확인
    if (!req.user){
        return res.status(400).json({message : '로그인하셔야 합니다.'})
    }
    // 사용자의 댓글인지도 확인
    try {
        const result = await db.collection('comments').findOne({_id : new ObjectId(req.body._id)});
        if (result?.commentor.id.toString() !== req.body.userId.toString()){
            return res.status(400).json({message : '권한이 없습니다.'});    
        } 
    } catch (error) {
        res.status(500).json({message : '네트워크 오류'})
    }

    try {
        const result = await db.collection('comments').updateOne({_id : new ObjectId(req.body._id)}, { $set : { content : req.body.content}});
        res.status(200).json({message : '수정이 완료되었습니다.'})    
    } catch (error) {
        res.status(500).json({message : '네트워크 오류'})
    }
    
});

//댓글 삭제 처리
router.delete('/detail/comment', async (req, res) => {
    let db = req.db;
    if (!req.user){
        res.status(400).json({message : '로그인하셔야 합니다.'})
    }
    try {
        const result = await db.collection('comments').findOne({ _id : new ObjectId(req.query.commentId)})
        if (result.commentor.id.toString() != req.user._id.toString()){
            return res.status(400).json({message : "권한이 없습니다."})
        }
        const deleted = await db.collection('comments').deleteOne({ _id : new ObjectId(req.query.commentId) })
        return res.status(200).json({message:'댓글이 삭제되었습니다.'})
    } catch (error) {
        return res.status(500).json({message:'네트워크 오류'})
    }

});


module.exports = router;