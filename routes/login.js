const router = require('express').Router();

router.get('/login', (req, res) => {
    if (req.user){
        res.redirect('/list')
        return
    }
    console.log(req.user)
    res.render('login.ejs')
})

module.exports = router;