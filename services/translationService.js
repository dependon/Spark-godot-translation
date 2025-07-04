const axios = require('axios');
const crypto = require('crypto');

class BaiduTranslationService {
    constructor(appId, secretKey) {
        this.appId = appId;
        this.secretKey = secretKey;
        this.apiUrl = 'https://fanyi-api.baidu.com/api/trans/vip/translate';
        
        // 百度翻译支持的28种语言
        this.supportedLanguages = {
            'auto': '自动检测',
            'zh': '中文',
            'en': '英语',
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

    // 翻译单个文本
    async translateText(text, from = 'auto', to = 'zh') {
        if (!text || text.trim() === '') {
            return text;
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

            return response.data.trans_result[0].dst;
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

    // 获取支持的语言列表
    getSupportedLanguages() {
        return this.supportedLanguages;
    }

    // 检查语言代码是否支持
    isLanguageSupported(langCode) {
        return langCode in this.supportedLanguages;
    }
}

module.exports = BaiduTranslationService;