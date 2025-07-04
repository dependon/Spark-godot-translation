// 应用配置文件
require('dotenv').config();

module.exports = {
  // 服务器配置
  server: {
    port: process.env.PORT || 3000,
    uploadDir: 'uploads',
    downloadDir: 'downloads'
  },

  // 腾讯云翻译API配置
  tencent: {
    secretId: process.env.TENCENT_SECRET_ID || 'YOUR_SECRET_ID',
    secretKey: process.env.TENCENT_SECRET_KEY || 'YOUR_SECRET_KEY',
    region: process.env.TENCENT_REGION || 'ap-beijing',
    endpoint: 'tmt.tencentcloudapi.com'
  },

  // 支持的语言映射
  supportedLanguages: {
    'zh': '简体中文',
    'zh-TW': '繁体中文',
    'en': '英语',
    'ar': '阿拉伯语',
    'de': '德语',
    'es': '西班牙语',
    'fr': '法语',
    'it': '意大利语',
    'ja': '日语',
    'pt': '葡萄牙语',
    'ru': '俄语',
    'ko': '韩语',
    'tr': '土耳其语',
    'vi': '越南语',
    'th': '泰语'
  },

  // API限制配置
  api: {
    requestDelay: 100, // 请求间隔（毫秒）
    maxRetries: 3,     // 最大重试次数
    timeout: 30000     // 请求超时时间（毫秒）
  },

  // 文件处理配置
  file: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedExtensions: ['.csv'],
    previewRows: 5
  }
};