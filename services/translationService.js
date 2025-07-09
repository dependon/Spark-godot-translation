const axios = require('axios');
const crypto = require('crypto');

class BaiduTranslationService {
    constructor(appId, secretKey) {
        this.appId = appId;
        this.secretKey = secretKey;
        this.apiUrl = 'https://fanyi-api.baidu.com/api/trans/vip/translate';
        
        // 翻译缓存
        this.translationCache = new Map();
        this.cacheHits = 0;
        this.totalRequests = 0;
        
        // 百度翻译支持的28种语言
        this.supportedLanguages = {
            'auto': '自动检测',
            'en': '英语',
            'zh': '中文',
            'cht': '繁体中文',
            'yue': '粤语',
            'wyw': '文言文',
            'jp': '日语',
            'kor': '韩语',
            'spa': '西班牙语',
            'fra': '法语',
            'th': '泰语',
            'ara': '阿拉伯语',
            'ru': '俄语',
            'pt': '葡萄牙语',
            'de': '德语',
            'it': '意大利语',
            'el': '希腊语',
            'nl': '荷兰语',
            'pl': '波兰语',
            'bul': '保加利亚语',
            'est': '爱沙尼亚语',
            'dan': '丹麦语',
            'fin': '芬兰语',
            'cs': '捷克语',
            'rom': '罗马尼亚语',
            'slo': '斯洛文尼亚语',
            'swe': '瑞典语',
            'hu': '匈牙利语',
            'vie': '越南语'
        };
    }

    // 生成签名
    generateSign(query, salt) {
        const str = this.appId + query + salt + this.secretKey;
        return crypto.createHash('md5').update(str).digest('hex');
    }

    // 生成缓存键
    getCacheKey(text, from, to) {
        return `${from}-${to}-${text.trim()}`;
    }

    // 翻译单个文本（带缓存）
    async translateText(text, from = 'auto', to = 'zh') {
        if (!text || text.trim() === '') {
            return text;
        }

        this.totalRequests++;
        
        // 检查缓存
        const cacheKey = this.getCacheKey(text, from, to);
        if (this.translationCache.has(cacheKey)) {
            this.cacheHits++;
            return this.translationCache.get(cacheKey);
        }

        const salt = Date.now().toString();
        const sign = this.generateSign(text, salt);

        const params = {
            q: text,
            from: from,
            to: to,
            appid: this.appId,
            salt: salt,
            sign: sign
        };

        const response = await axios.get(this.apiUrl, { params });
        
        if (response.data.error_code) {
            //throw new Error(`翻译错误: ${response.data.error_msg}`);
        }

        const result = response.data.trans_result[0].dst;
        
        // 存储到缓存
        this.translationCache.set(cacheKey, result);
        
        return result;
    }

    // 直接翻译（逐个翻译，实时反馈）
    async translateDirect(texts, from = 'auto', to = 'zh', progressCallback = null, controller = null) {
        const results = [];
        const delay = 1; // 1ms延迟，避免API频率限制
        let successCount = 0;
        let errorCount = 0;
        
        console.log(`开始直接翻译${texts.length}个文本，延迟${delay}ms避免API限制`);
        
        for (let i = 0; i < texts.length; i++) {
            // 检查是否需要停止翻译
            if (controller && controller.shouldStop) {
                console.log(`翻译在第${i + 1}/${texts.length}个文本时被停止`);
                break;
            }
            
            let translatedText = texts[i]; // 默认保持原文
            let hasError = false;
            let errorMessage = null;
            
            // 如果文本为空或只有空白字符，直接跳过翻译
            if (!texts[i] || texts[i].trim() === '') {
                translatedText = texts[i];
            } else {
                translatedText = await this.translateText(texts[i], from, to);
                successCount++;
            }
            
            results.push(translatedText);
            
            // 成功时反馈进度
            if (progressCallback) {
                const shouldContinue = progressCallback({
                    index: i,
                    total: texts.length,
                    originalText: texts[i],
                    translatedText: translatedText,
                    progress: ((i + 1) / texts.length * 100).toFixed(1),
                    status: 'success'
                });
                
                // 如果回调函数返回false，停止翻译
                if (shouldContinue === false) {
                    console.log(`翻译在第${i + 1}/${texts.length}个文本时被回调函数停止`);
                    break;
                }
            }
            
            // 添加延迟避免API频率限制
            if (i < texts.length - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        const status = (controller && controller.shouldStop) ? '已停止' : '完成';
        console.log(`翻译${status}: 成功${successCount}个，失败${errorCount}个，总计${texts.length}个`);
        return results;
    }



    // 获取支持的语言列表
    getSupportedLanguages() {
        return this.supportedLanguages;
    }

    // 检查语言代码是否支持
    isLanguageSupported(langCode) {
        return langCode in this.supportedLanguages;
    }

    // 获取缓存统计信息
    getCacheStats() {
        const hitRate = this.totalRequests > 0 ? (this.cacheHits / this.totalRequests * 100).toFixed(2) : 0;
        return {
            totalRequests: this.totalRequests,
            cacheHits: this.cacheHits,
            hitRate: `${hitRate}%`,
            cacheSize: this.translationCache.size
        };
    }

    // 清理缓存
    clearCache() {
        this.translationCache.clear();
        this.cacheHits = 0;
        this.totalRequests = 0;
    }

    // 预热缓存（批量添加常用翻译）
    preloadCache(translations) {
        translations.forEach(({ text, from, to, translation }) => {
            const cacheKey = this.getCacheKey(text, from, to);
            this.translationCache.set(cacheKey, translation);
        });
    }
}

module.exports = BaiduTranslationService;