const { S3Client } = require("@aws-sdk/client-s3");
// S3 사용을 위한 클라이언트 연결
const s3Client = new S3Client({
  region: "ap-southeast-2",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_ACCESS_SECRET_KEY,
  },
});

module.exports = { s3Client };
