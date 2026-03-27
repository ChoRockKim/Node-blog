const { ObjectId } = require("mongodb");

const router = require("express").Router();
const escapeRegExp = require("../utils/escapeRegExp");

// 메인페이지 라우팅 -> 기본 list 페이지로 리다이렉트
router.get("/", (req, res) => {
  res.redirect("/list");
});

// 리스트 페이지 라우팅
router.get("/list", async (req, res) => {
  let db = req.db;
  const result = await db.collection("post").find().toArray();
  res.redirect("/list/1");
});

// 리스트 검색 라우팅
router.get("/list/search", (req, res) => {
  if (!req.query.title.trim()) {
    return res.redirect("/list");
  }
  res.redirect("/list/search/1?title=" + req.query.title);
});
// 리스트 검색 페이지네이션
router.get("/list/search/:id", async (req, res) => {
  let db = req.db;
  let query = req.query;
  let keyword = req.query.title || "";
  let safeKeyword = escapeRegExp(keyword);
  const limit = parseInt(6);
  const id = parseInt(req.params.id);

  // 전체 검색결과 개수 가져오기
  const metaResult = await db
    .collection("post")
    .aggregate([
      {
        $search: {
          index: "title_index",
          text: { query: safeKeyword, path: "title" },
        },
      },
      {
        // $$SEARCH_META를 사용하여 검색 조건에 맞는 전체 개수 뽑기
        $count: "total",
      },
    ])
    .toArray();
  const totalPost = metaResult.length > 0 ? metaResult[0].total : 0;
  const totalPages = Math.ceil(totalPost / limit);
  // 실제 페이징 된 데이터 가져오기
  const result = await db
    .collection("post")
    .aggregate([
      {
        $search: {
          index: "title_index",
          text: { query: safeKeyword, path: "title" },
        },
      },
      { $sort: { createdAt: -1 } }, // 최신순 정렬
      { $skip: (id - 1) * limit }, // 건너뛰기
      { $limit: limit }, // 가져오기
    ])
    .toArray();

  result.totalPage = totalPages;
  result.curPage = id;
  result.keyword = keyword; // 검색어 유지용

  res.render("search.ejs", { post: result, query });
});

// 글 목록 페이지네이션
router.get("/list/:id", async (req, res) => {
  let db = req.db;
  const limit = 6;
  const id = parseInt(req.params.id);
  const categoryList = await db.collection("category").find().toArray();
  // aggregate 파이프라인 시작
  const result = await db
    .collection("post")
    .aggregate([
      { $sort: { createdAt: -1 } }, // 최신순 정렬
      { $skip: (id - 1) * limit }, // 페이지네이션 스킵
      { $limit: limit }, // 6개만 가져오기
      {
        $lookup: {
          from: "category", // 조인할 대상 컬렉션 이름
          localField: "category", // post 도큐먼트의 카테고리 ID 필드
          foreignField: "_id", // category 도큐먼트의 _id 필드
          as: "categoryDetail", // 합쳐진 결과가 들어갈 필드명
        },
      },
      {
        $unwind: "$categoryDetail", // 배열 형태인 categoryDetail을 객체로 풀기
      },
    ])
    .toArray();
  console.log(result);

  const totalPost = await db.collection("post").countDocuments();
  const totalPages = Math.ceil(totalPost / limit);

  // 기존 방식처럼 배열 객체에 데이터 추가
  result.totalPost = totalPost;
  result.totalPage = totalPages;
  result.curPage = id;

  res.render("list.ejs", { post: result, categoryList });
});

// 카테고리 별 페이지네이션
router.get("/list/:category/:id", async (req, res) => {
  try {
    let db = req.db;
    let category = req.params.category;
    const limit = 6;
    const id = parseInt(req.params.id);
    const categoryData = await db
      .collection("category")
      .findOne({ name: category });

    if (!categoryData) {
      return res.redirect("/list/1"); // 카테고리가 없으면 리다이렉트
    }

    const categoryId = categoryData._id;
    const categoryList = await db.collection("category").find().toArray();

    const result = await db
      .collection("post")
      .aggregate([
        { $match: { category: categoryId } },
        { $sort: { createdAt: -1 } },
        { $skip: (id - 1) * limit },
        { $limit: limit },
        {
          $lookup: {
            from: "category",
            localField: "category",
            foreignField: "_id",
            as: "categoryDetail",
          },
        },
        {
          $unwind: "$categoryDetail",
        },
      ])
      .toArray();

    const totalPost = await db.collection("post").countDocuments();
    const totalPostCategory = await db
      .collection("post")
      .countDocuments({ category: categoryId });
    const totalPages = Math.ceil(totalPostCategory / limit);
    result.totalPost = totalPost;
    result.totalPostCategory = totalPostCategory;
    result.totalPage = totalPages;
    result.curPage = id;

    res.render("category-list.ejs", { post: result, category, categoryList });
  } catch (error) {
    console.log("못 불러옴");
    res.redirect("/list");
  }
});

module.exports = router;
