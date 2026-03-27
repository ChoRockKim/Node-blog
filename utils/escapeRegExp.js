// 정규표현식 전처리
function escapeRegExp(string) {
  // $ & * + . ? [ ] ( ) | { } / 등 특수문자를 전부 \와 함께 치환
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = escapeRegExp;
