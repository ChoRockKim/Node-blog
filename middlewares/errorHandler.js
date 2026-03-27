// 404 에어 페이지 미들웨어
function errorHandler(req, res, next) {
  res.status(404).render("error.ejs", {
    message: "요청하신 페이지를 찾을 수 없습니다.",
  });
}

module.exports = errorHandler;
