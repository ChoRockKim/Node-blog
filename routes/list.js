const router = require('express').Router();

// 메인페이지 라우팅 -> 기본 list 페이지로 리다이렉트
router.get('/', (req, res) => {
    res.redirect('/list')
})
// 리스트 페이지 라우팅
router.get('/list', async (req, res) => {
    let db = req.db;
    const result = await db.collection('post').find().toArray();
    res.redirect('/list/1')
})
// 정규표현식 전처리
function escapeRegExp(string) {
    // $ & * + . ? [ ] ( ) | { } / 등 특수문자를 전부 \와 함께 치환합니다.
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
}
// 리스트 검색 라우팅
router.get('/list/search', (req, res)=>{
    if (!req.query.title.trim()){
        return res.redirect('/list');
    }
    res.redirect('/list/search/1?title=' + req.query.title)
})
// 리스트 검색 페이지네이션
router.get('/list/search/:id', async (req, res) => {
    let db = req.db;
    let query = req.query;
    let keyword = req.query.title || '';
    let safeKeyword = escapeRegExp(keyword);
    const limit = parseInt(6);
    const id = parseInt(req.params.id);
    
    // search 인덱스를 이용해 검색
    const searchFilter = [{$search : { 
        index : 'title_index',
        text : {query : safeKeyword, path : 'title'}
    }}];
    // 전체 검색결과 개수 가져오기
    const metaResult = await db.collection('post').aggregate([
                {
                    $search: {
                        index: 'title_index',
                        text: { query: safeKeyword, path: 'title' }
                    }
                },
                {
                    // $$SEARCH_META를 사용하여 검색 조건에 맞는 전체 개수를 뽑아냅니다.
                    $count: "total" 
                }
            ]).toArray();
    const totalPost = metaResult.length > 0 ? metaResult[0].total : 0;  
    const totalPages = Math.ceil(totalPost / limit);
    // 실제 페이징 된 데이터 가져오기
    const result = await db.collection('post').aggregate([
            {
                $search: {
                    index: 'title_index',
                    text: { query: safeKeyword, path: 'title' }
                }
            },
            { $sort: { createdAt: -1 } }, // 최신순 정렬
            { $skip: (id - 1) * limit },  // 건너뛰기
            { $limit: limit }             // 가져오기
        ]).toArray();

    result.totalPage = totalPages;
    result.curPage = id;
    result.keyword = keyword; // 검색어 유지용

    res.render('search.ejs', {post : result, query})
})
// 글 목록 페이지네이션
router.get('/list/:id', async (req, res) => {
    let db = req.db;
    const limit = parseInt(6);
    const id = parseInt(req.params.id);
    const result = await db.collection('post').find().sort({createdAt : -1}).skip((id-1)*limit).limit(limit).toArray();
    
    const totalPost = await db.collection('post').countDocuments();
    const totalPages = Math.ceil(totalPost/limit);
    result.totalPage = totalPages;
    result.curPage = id;
    res.render('list.ejs', { post : result })
})

module.exports = router;