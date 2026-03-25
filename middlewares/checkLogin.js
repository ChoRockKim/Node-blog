const checkLogin = (req, res, next) => {
  if (!req.user) {
    res.status(500).send({ message: "로그인해야 합니다." });
    return;
  } else {
    next();
  }
};

module.exports = checkLogin;
