const axios = require('axios');
const crypto = require('crypto');
const config = require('../config');

class TranslationService {
  constructor() {
    this.config = config.tencent;
    this.apiConfig = config.api;
  }

  /**
   * 生成腾讯云API v3签名
   * @param {string} payload - 请求体
   * @param {number} timestamp - 时间戳
   * @returns {string} 授权头
   */
  generateTencentSignature(payload, timestamp) {
    const date = new Date(timestamp * 1000).toISOString().substr(0, 10);
    const service = 'tmt';
    const algorithm = 'TC3-HMAC-SHA256';
    const credentialScope = `${date}/${service}/tc3_request`;
    
    // 步骤1：拼接规范请求串
    const httpRequestMethod = 'POST';
    const canonicalUri = '/';
    const canonicalQueryString = '';
    const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${this.config.endpoint}\nx-tc-action:texttranslate\n`;
    const signedHeaders = 'content-type;host;x-tc-action';
    const hashedRequestPayload = crypto.createHash('sha256').update(payload).digest('hex');
    const canonicalRequest = `${httpRequestMethod}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${hashedRequestPayload}`;
    
    // 步骤2：拼接待签名字符串
    const hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
    const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`;
    
    // 步骤3：计算签名
    const secretDate = crypto.createHmac('sha256', `TC3${this.config.secretKey}`).update(date).digest();
    const secretService = crypto.createHmac('sha256', secretDate).update(service).digest();
    const secretSigning = crypto.createHmac('sha256', secretService).update('tc3_request').digest();
    const signature = crypto.createHmac('sha256', secretSigning).update(stringToSign).digest('hex');
    
    return `${algorithm} Credential=${this.config.secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  }

  /**
   * 翻译单个文本
   * @param {string} text - 要翻译的文本
   * @param {string} sourceLanguage - 源语言
   * @param {string} targetLanguage - 目标语言
   * @param {number} retryCount - 重试次数
   * @returns {Promise<string>} 翻译结果
   */
  async translateText(text, sourceLanguage, targetLanguage, retryCount = 0) {
    if (!text || text.trim() === '') return text;
    
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      
      const payload = JSON.stringify({
        SourceText: text,
        Source: sourceLanguage,
        Target: targetLanguage,
        ProjectId: 0
      });
      
      const authorization = this.generateTencentSignature(payload, timestamp);
      
      const response = await axios.post(`https://${this.config.endpoint}`, payload, {
        headers: {
          'Authorization': authorization,
          'Content-Type': 'application/json; charset=utf-8',
          'Host': this.config.endpoint,
          'X-TC-Action': 'TextTranslate',
          'X-TC-Timestamp': timestamp.toString(),
          'X-TC-Version': '2018-03-21',
          'X-TC-Region': this.config.region
        },
        timeout: this.apiConfig.timeout
      });
      
      if (response.data && response.data.Response && response.data.Response.TargetText) {
        return response.data.Response.TargetText;
      } else {
        throw new Error(`API返回异常: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      console.error(`翻译失败 (${sourceLanguage}->${targetLanguage}):`, error.response?.data || error.message);
      
      // 重试逻辑
      if (retryCount < this.apiConfig.maxRetries) {
        console.log(`重试翻译 (${retryCount + 1}/${this.apiConfig.maxRetries})...`);
        await this.delay(1000 * (retryCount + 1)); // 递增延迟
        return this.translateText(text, sourceLanguage, targetLanguage, retryCount + 1);
      }
      
      return text; // 翻译失败时返回原文
    }
  }

  /**
   * 批量翻译
   * @param {Array} texts - 文本数组
   * @param {string} sourceLanguage - 源语言
   * @param {string} targetLanguage - 目标语言
   * @param {Function} progressCallback - 进度回调函数
   * @returns {Promise<Array>} 翻译结果数组
   */
  async translateBatch(texts, sourceLanguage, targetLanguage, progressCallback) {
    const results = [];
    
    for (let i = 0; i < texts.length; i++) {
      const translatedText = await this.translateText(texts[i], sourceLanguage, targetLanguage);
      results.push(translatedText);
      
      // 调用进度回调
      if (progressCallback) {
        const progress = {
          completed: i + 1,
          total: texts.length,
          percentage: ((i + 1) / texts.length) * 100
        };
        progressCallback(progress);
      }
      
      // 添加延迟避免API限流
      if (i < texts.length - 1) {
        await this.delay(this.apiConfig.requestDelay);
      }
    }
    
    return results;
  }

  /**
   * 延迟函数
   * @param {number} ms - 延迟毫秒数
   * @returns {Promise}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 验证API配置
   * @returns {boolean} 配置是否有效
   */
  validateConfig() {
    return this.config.secretId !== 'YOUR_SECRET_ID' && 
           this.config.secretKey !== 'YOUR_SECRET_KEY' &&
           this.config.secretId && 
           this.config.secretKey;
  }

  /**
   * 获取支持的语言列表
   * @returns {Object} 支持的语言映射
   */
  getSupportedLanguages() {
    return config.supportedLanguages;
  }
}

module.exports = TranslationService;