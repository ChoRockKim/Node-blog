const router = require('express').Router();

router.get('/chat', (req, res) => {
    res.render('chat-list.ejs')
})

module.exports = router