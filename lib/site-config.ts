// GitHub Pages 站点路径前缀（与 next.config.js 中 basePath 保持一致）
export const BASE_PATH = '/ttfhw-report'

/** 为内部链接添加 basePath 前缀 */
export function sitePath(path: string): string {
  return `${BASE_PATH}${path}`
}
