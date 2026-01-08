/**
 * 파일 크기 포맷팅 함수
 * @param bytes - 파일 크기 (bytes)
 * @returns 포맷팅된 파일 크기 문자열
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * 날짜 포맷팅 함수
 * @param timestamp - 타임스탬프
 * @returns 포맷팅된 날짜 문자열 (한국어)
 */
export const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60));
      return minutes <= 1 ? '방금 전' : `${minutes}분 전`;
    }
    return `${hours}시간 전`;
  } else if (days === 1) {
    return '어제';
  } else if (days < 7) {
    return `${days}일 전`;
  } else {
    return date.toLocaleDateString('ko-KR');
  }
};