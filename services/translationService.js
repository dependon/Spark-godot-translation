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

        try {
            const response = await axios.get(this.apiUrl, { params });
            
            if (response.data.error_code) {
                throw new Error(`翻译错误: ${response.data.error_msg}`);
            }

            const result = response.data.trans_result[0].dst;
            
            // 存储到缓存
            this.translationCache.set(cacheKey, result);
            
            return result;
        } catch (error) {
            console.error('翻译失败:', error.message);
            throw error;
        }
    }

    // 批量翻译（带延迟避免频率限制）
    async translateBatch(texts, from = 'auto', to = 'zh', delay = 1000) {
        const results = [];
        
        for (let i = 0; i < texts.length; i++) {
            try {
                const result = await this.translateText(texts[i], from, to);
                results.push(result);
                
                // 添加延迟避免API频率限制
                if (i < texts.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            } catch (error) {
                console.error(`翻译第${i+1}项失败:`, error.message);
                results.push(texts[i]); // 失败时保持原文
            }
        }
        
        return results;
    }

    // 并发批量翻译（优化版本）
    async translateBatchConcurrent(texts, from = 'auto', to = 'zh', concurrency = 3, delay = 500) {
        const results = new Array(texts.length);
        const chunks = [];
        
        // 将文本分组以控制并发数
        for (let i = 0; i < texts.length; i += concurrency) {
            chunks.push(texts.slice(i, i + concurrency));
        }
        
        let processedCount = 0;
        
        for (const chunk of chunks) {
            // 并发处理当前块
            const promises = chunk.map(async (text, index) => {
                const globalIndex = processedCount + index;
                try {
                    const result = await this.translateText(text, from, to);
                    results[globalIndex] = result;
                    return result;
                } catch (error) {
                    console.error(`翻译第${globalIndex + 1}项失败:`, error.message);
                    results[globalIndex] = text; // 失败时保持原文
                    return text;
                }
            });
            
            await Promise.all(promises);
            processedCount += chunk.length;
            
            // 在处理下一个块之前添加延迟
            if (processedCount < texts.length) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        return results;
    }

    // 智能批量翻译（根据文本长度和数量选择策略）
    async translateBatchSmart(texts, from = 'auto', to = 'zh', progressCallback = null) {
        const totalTexts = texts.length;
        const avgLength = texts.reduce((sum, text) => sum + text.length, 0) / totalTexts;
        
        // 根据文本数量和平均长度选择策略
        let strategy, concurrency, delay;
        
        if (totalTexts <= 10) {
            // 少量文本：串行处理，较短延迟
            strategy = 'serial';
            delay = 300;
        } else if (totalTexts <= 50 && avgLength <= 100) {
            // 中等数量短文本：中等并发
            strategy = 'concurrent';
            concurrency = 3;
            delay = 400;
        } else if (totalTexts <= 100) {
            // 较多文本：低并发
            strategy = 'concurrent';
            concurrency = 2;
            delay = 600;
        } else {
            // 大量文本：最低并发，较长延迟
            strategy = 'concurrent';
            concurrency = 2;
            delay = 800;
        }
        
        console.log(`使用${strategy}策略翻译${totalTexts}个文本，平均长度：${avgLength.toFixed(1)}字符`);
        
        if (strategy === 'serial') {
            return await this.translateBatch(texts, from, to, delay);
        } else {
            return await this.translateBatchConcurrent(texts, from, to, concurrency, delay);
        }
    }

    // 实时反馈翻译（每翻译一个文本立即反馈）
    async translateWithRealTimeFeedback(texts, from = 'auto', to = 'zh', progressCallback = null) {
        const results = [];
        const delay = 50; // 100ms延迟，避免API频率限制
        
        console.log(`开始实时翻译${texts.length}个文本，延迟${delay}ms避免API限制`);
        
        for (let i = 0; i < texts.length; i++) {
            try {
                const result = await this.translateText(texts[i], from, to);
                results.push(result);
                
                // 立即反馈进度
                if (progressCallback) {
                    progressCallback({
                        index: i,
                        total: texts.length,
                        originalText: texts[i],
                        translatedText: result,
                        progress: ((i + 1) / texts.length * 100).toFixed(1)
                    });
                }
                
                // 添加延迟避免API频率限制
                if (i < texts.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            } catch (error) {
                console.error(`翻译第${i+1}项失败:`, error.message);
                results.push(texts[i]); // 失败时保持原文
                
                // 即使失败也要反馈进度
                if (progressCallback) {
                    progressCallback({
                        index: i,
                        total: texts.length,
                        originalText: texts[i],
                        translatedText: texts[i],
                        progress: ((i + 1) / texts.length * 100).toFixed(1),
                        error: error.message
                    });
                }
                
                // 失败时也要延迟，避免连续错误
                if (i < texts.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
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