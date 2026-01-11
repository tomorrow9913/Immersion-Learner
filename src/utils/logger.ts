import alertService from '@/services/AlertService';

// 운영 모드(Production)인지 확인
const IS_PROD = import.meta.env.PROD;

export const Logger = {
  // 개발자만 봐야 하는 로그
  debug: (...args: any[]) => {
    if (!IS_PROD) console.debug('[Debug]', ...args);
  },
  // 개발자에게 중요하지만, 사용자에게 알릴 필요는 없는 경고
  warn: (...args: any[]) => {
    console.warn('[Warn]', ...args);
  },
  // 치명적인 에러 -> 사용자에게도 알림
  error: (message: string, error?: unknown) => {
    console.error('[Error]', message, error);
    // 사용자에게는 친절한 메시지로 변환하여 노출
    alertService.show(message, 'destructive');
  },
  // 사용자에게 성공/정보 알림
  info: (message: string) => {
    console.info('[Info]', message);
    alertService.show(message, 'default');
  }
};
