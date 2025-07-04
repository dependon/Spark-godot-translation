const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// 确保上传和下载目录存在
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}
if (!fs.existsSync('downloads')) {
  fs.mkdirSync('downloads');
}

// 支持的语言映射
const SUPPORTED_LANGUAGES = {
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
};

// 腾讯翻译API配置
const TENCENT_CONFIG = {
  secretId: process.env.TENCENT_SECRET_ID || 'YOUR_SECRET_ID',
  secretKey: process.env.TENCENT_SECRET_KEY || 'YOUR_SECRET_KEY',
  region: process.env.TENCENT_REGION || 'ap-beijing',
  endpoint: 'tmt.tencentcloudapi.com'
};

// 生成腾讯云API签名
function generateSignature(params, secretKey) {
  const sortedParams = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join('&');
  const stringToSign = `POST\n${TENCENT_CONFIG.endpoint}\n/\n${sortedParams}`;
  return crypto.createHmac('sha1', secretKey).update(stringToSign).digest('base64');
}

// 调用腾讯翻译API
async function translateText(text, sourceLanguage, targetLanguage) {
  if (!text || text.trim() === '') return text;
  
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = Math.floor(Math.random() * 1000000);
    
    const params = {
      Action: 'TextTranslate',
      Version: '2018-03-21',
      Region: TENCENT_CONFIG.region,
      Timestamp: timestamp,
      Nonce: nonce,
      SecretId: TENCENT_CONFIG.secretId,
      SourceText: text,
      Source: sourceLanguage,
      Target: targetLanguage,
      ProjectId: 0
    };
    
    const signature = generateSignature(params, TENCENT_CONFIG.secretKey);
    params.Signature = signature;
    
    const response = await axios.post(`https://${TENCENT_CONFIG.endpoint}`, null, {
      params: params,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    if (response.data && response.data.Response && response.data.Response.TargetText) {
      return response.data.Response.TargetText;
    } else {
      console.error('翻译API返回异常:', response.data);
      return text; // 翻译失败时返回原文
    }
  } catch (error) {
    console.error('翻译失败:', error.message);
    return text; // 翻译失败时返回原文
  }
}

// 读取CSV文件
function readCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    let headers = [];
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('headers', (headerList) => {
        headers = headerList;
      })
      .on('data', (data) => {
        results.push(data);
      })
      .on('end', () => {
        resolve({ headers, data: results });
      })
      .on('error', reject);
  });
}

// 写入CSV文件
function writeCsvFile(filePath, headers, data) {
  return new Promise((resolve, reject) => {
    const csvWriter = createCsvWriter({
      path: filePath,
      header: headers.map(h => ({ id: h, title: h }))
    });
    
    csvWriter.writeRecords(data)
      .then(() => resolve())
      .catch(reject);
  });
}

// API路由

// 获取支持的语言列表
app.get('/api/languages', (req, res) => {
  res.json(SUPPORTED_LANGUAGES);
});

// 上传并分析CSV文件
app.post('/api/upload', upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择CSV文件' });
    }
    
    const csvData = await readCsvFile(req.file.path);
    
    // 分析现有的语言列
    const existingLanguages = csvData.headers.filter(h => h !== 'keys');
    const missingLanguages = Object.keys(SUPPORTED_LANGUAGES).filter(lang => !existingLanguages.includes(lang));
    
    res.json({
      success: true,
      fileName: req.file.filename,
      headers: csvData.headers,
      existingLanguages,
      missingLanguages,
      rowCount: csvData.data.length,
      preview: csvData.data.slice(0, 5) // 预览前5行
    });
  } catch (error) {
    console.error('文件上传处理失败:', error);
    res.status(500).json({ error: '文件处理失败: ' + error.message });
  }
});

// 执行翻译
app.post('/api/translate', async (req, res) => {
  try {
    const { fileName, sourceLanguage, targetLanguages } = req.body;
    
    if (!fileName || !sourceLanguage || !targetLanguages || !Array.isArray(targetLanguages)) {
      return res.status(400).json({ error: '参数不完整' });
    }
    
    const filePath = path.join('uploads', fileName);
    const csvData = await readCsvFile(filePath);
    
    // 检查源语言列是否存在
    if (!csvData.headers.includes(sourceLanguage)) {
      return res.status(400).json({ error: `源语言列 '${sourceLanguage}' 不存在` });
    }
    
    // 添加缺失的语言列到headers
    const newHeaders = [...csvData.headers];
    targetLanguages.forEach(lang => {
      if (!newHeaders.includes(lang)) {
        newHeaders.push(lang);
      }
    });
    
    // 执行翻译
    const translatedData = [];
    const totalRows = csvData.data.length;
    
    for (let i = 0; i < csvData.data.length; i++) {
      const row = csvData.data[i];
      const newRow = { ...row };
      
      const sourceText = row[sourceLanguage];
      if (sourceText && sourceText.trim() !== '') {
        for (const targetLang of targetLanguages) {
          if (targetLang !== sourceLanguage && (!row[targetLang] || row[targetLang].trim() === '')) {
            console.log(`翻译第${i+1}行: ${sourceLanguage} -> ${targetLang}`);
            const translatedText = await translateText(sourceText, sourceLanguage, targetLang);
            newRow[targetLang] = translatedText;
            
            // 添加小延迟避免API限流
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      }
      
      translatedData.push(newRow);
      
      // 发送进度更新（这里简化处理，实际项目中可以使用WebSocket）
      if (i % 10 === 0) {
        console.log(`翻译进度: ${i + 1}/${totalRows}`);
      }
    }
    
    // 保存翻译后的文件
    const outputFileName = `translated_${Date.now()}_${fileName}`;
    const outputPath = path.join('downloads', outputFileName);
    
    await writeCsvFile(outputPath, newHeaders, translatedData);
    
    res.json({
      success: true,
      message: '翻译完成',
      downloadFileName: outputFileName,
      translatedRows: totalRows
    });
    
  } catch (error) {
    console.error('翻译处理失败:', error);
    res.status(500).json({ error: '翻译失败: ' + error.message });
  }
});

// 下载翻译后的文件
app.get('/api/download/:fileName', (req, res) => {
  const fileName = req.params.fileName;
  const filePath = path.join('downloads', fileName);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: '文件不存在' });
  }
  
  res.download(filePath, fileName, (err) => {
    if (err) {
      console.error('文件下载失败:', err);
      res.status(500).json({ error: '文件下载失败' });
    }
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`CSV翻译服务器运行在 http://localhost:${PORT}`);
  console.log('请确保已配置腾讯云翻译API密钥');
});

module.exports = app;