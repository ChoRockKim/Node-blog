const router = require('express').Router();

router.get('/user/:name', (req, res) => {
    console.log(req.params.name)
    res.render('user-profile.ejs')
})


module.exports = router;