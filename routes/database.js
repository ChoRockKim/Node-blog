const {MongoClient} = require('mongodb')

// MongoDB 연결

const url = `mongodb+srv://daejincnc2:${process.env.DB_PASSWORD}@nodeblog.jreokmg.mongodb.net/?appName=NodeBlog`
let connectDB = new MongoClient(url).connect();

module.exports = connectDB;