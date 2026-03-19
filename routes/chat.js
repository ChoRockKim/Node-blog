const { ObjectId } = require('mongodb');

const router = require('express').Router();

// 채팅방 개설 로직
router.post('/message', async (req, res) => {
    if (!req.user){
        return res.status(400).json({message:'로그인하셔야 합니다.'});
    }
    let db = req.db;
    // console.log(req.body);
    const room = {
        participants : [new ObjectId(req.body.receiver), new ObjectId(req.body.sender)],
        createdAt : new Date(),
        updatedAt : new Date(),
        lastMessage : ""
    }
    // 둘 다 참여하는 채팅방이 있는지 먼저 확인

    const existingRoom = await db.collection('conversations').findOne({participants : { $all : [new ObjectId(req.body.receiver), new ObjectId(req.body.sender)]}});
    if (existingRoom){
        return res.status(200).json({ url : `/message/room/${existingRoom._id}`});
    }
    const newRoom = await db.collection('conversations').insertOne(room);
    res.status(200).json({ url : `/message/room/${newRoom.insertedId}`});
})

// 채팅방 렌더링 로직
router.get('/message/room/:roomId', async (req, res) => {
    if (!req.user){
        return res.redirect('/list');
    }
    let db = req.db;
    const isExist = await db.collection('conversations').findOne({_id : new ObjectId(req.params.roomId)});
    if (!isExist){
        return res.redirect('/list')
    }
    const result = await db.collection('conversations').aggregate([
        { $match : { _id : new ObjectId(req.params.roomId) }},
        {
            $lookup : {
                from : 'users',
                localField : 'participants',
                foreignField : '_id',
                as : 'participantInfo'
            }
        }
    ]).toArray();
    const chatLog = await db.collection('messages').find({ roomId : new ObjectId(req.params.roomId)}).sort({createdAt : 1}).toArray();
    res.render('chat-room.ejs', {roomInfo : result[0], chatLog : chatLog})
})

// 채팅방 목록 로직
router.get('/message/list', async (req, res) => {
    let db = req.db;
    if (!req.user){
        return res.redirect('/list')
    }
    const room = await db.collection('conversations').aggregate([
        { $match : { participants : req.user._id }},
        {
            $lookup : {
                from : 'users',
                localField : 'participants',
                foreignField : '_id',
                as : 'participantInfo'
            }
        },
        { $sort : { updatedAt : -1 }}
    ]).toArray();
    res.render('chat-list.ejs', { room : room})
})

module.exports = router