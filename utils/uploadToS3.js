const sharp = require("sharp"); // 이미지 압축
const { s3Client } = require("../models/s3Client");
const { PutObjectCommand } = require("@aws-sdk/client-s3");

// S3 업로드를 담당하는 공통 함수
async function uploadToS3(file, username) {
  const optimizedBuffer = await sharp(file.buffer)
    .resize(1200, null, { withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  const fileName = `posts/${Date.now()}-${username}.webp`;
  const params = {
    Bucket: "nodeblogforum0530",
    Key: fileName,
    Body: optimizedBuffer,
    ContentType: "image/webp",
  };

  await s3Client.send(new PutObjectCommand(params));
  // 시드니 리전 주소로 반환
  return `https://nodeblogforum0530.s3.ap-southeast-2.amazonaws.com/${fileName}`;
}

module.exports = { uploadToS3 };
