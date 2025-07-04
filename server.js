const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const config = require('./config');
const TranslationService = require('./services/translationService');
const CsvService = require('./services/csvService');

const app = express();
const PORT = config.server.port;

// 初始化服务
const translationService = new TranslationService();

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.server.uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: config.file.maxFileSize
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (config.file.allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传CSV文件'));
    }
  }
});

// 确保上传和下载目录存在
CsvService.ensureDirectoryExists(config.server.uploadDir);
CsvService.ensureDirectoryExists(config.server.downloadDir);

// API路由

// 获取支持的语言列表
app.get('/api/languages', (req, res) => {
  res.json(translationService.getSupportedLanguages());
});

// 上传文件
app.post('/api/upload', upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择CSV文件' });
    }
    
    // 验证CSV文件格式
    const filePath = req.file.path;
    const isValid = await CsvService.validateCsvFile(filePath);
    
    if (!isValid) {
      // 删除无效文件
      CsvService.cleanupTempFiles([filePath]);
      return res.status(400).json({ error: 'CSV文件格式无效' });
    }
    
    // 分析CSV文件结构
    const structure = await CsvService.analyzeCsvStructure(filePath);
    
    res.json({ 
      message: '文件上传成功',
      filename: req.file.filename,
      originalName: req.file.originalname,
      structure: structure
    });
  } catch (error) {
    console.error('文件上传处理错误:', error);
    res.status(500).json({ error: '文件处理失败: ' + error.message });
  }
});

// 翻译CSV文件
app.post('/api/translate', async (req, res) => {
  try {
    const { filename, sourceLanguage, targetLanguage, columnIndex } = req.body;
    
    if (!filename || !targetLanguage || columnIndex === undefined) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    const inputPath = path.join(config.server.uploadDir, filename);
    const outputFilename = CsvService.generateOutputFilename(filename);
    const outputPath = path.join(config.server.downloadDir, outputFilename);
    
    // 读取CSV文件，跳过第一行数据
    const { headers, data } = await CsvService.readCsvFile(inputPath, true);
    
    if (columnIndex >= headers.length) {
      return res.status(400).json({ error: '列索引超出范围' });
    }
    
    const columnName = headers[columnIndex];
    const textsToTranslate = data.map(row => row[columnName]).filter(text => text && text.trim() !== '');
    
    if (textsToTranslate.length === 0) {
      return res.status(400).json({ error: '没有找到需要翻译的文本' });
    }
    
    // 批量翻译
    let translatedCount = 0;
    const translatedTexts = await translationService.translateBatch(
      textsToTranslate,
      sourceLanguage,
      targetLanguage,
      (progress) => {
        translatedCount = progress.completed;
        console.log(`翻译进度: ${progress.completed}/${progress.total} (${progress.percentage.toFixed(1)}%)`);
      }
    );
    
    // 更新数据
    let textIndex = 0;
    for (let i = 0; i < data.length; i++) {
      const originalText = data[i][columnName];
      if (originalText && originalText.trim() !== '') {
        data[i][columnName] = translatedTexts[textIndex];
        textIndex++;
      }
    }
    
    // 写入翻译后的CSV文件
    await CsvService.writeCsvFile(outputPath, headers, data);
    
    res.json({
      message: '翻译完成',
      downloadFilename: outputFilename,
      totalRows: data.length,
      translatedCount: translatedCount
    });
    
  } catch (error) {
    console.error('翻译过程中出错:', error);
    res.status(500).json({ error: '翻译失败: ' + error.message });
  }
});

// 下载翻译后的文件
app.get('/api/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(config.server.downloadDir, filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: '文件不存在' });
  }
  
  res.download(filePath, filename, (err) => {
    if (err) {
      console.error('文件下载失败:', err);
      res.status(500).json({ error: '文件下载失败' });
    } else {
      // 下载完成后清理临时文件
      setTimeout(() => {
        CsvService.cleanupTempFiles([filePath]);
      }, 60000); // 1分钟后删除
    }
  });
});

// 清理临时文件的API
app.post('/api/cleanup', (req, res) => {
  try {
    const { files } = req.body;
    if (files && Array.isArray(files)) {
      const filePaths = files.map(f => path.join(config.server.uploadDir, f));
      CsvService.cleanupTempFiles(filePaths);
    }
    res.json({ message: '清理完成' });
  } catch (error) {
    console.error('清理文件失败:', error);
    res.status(500).json({ error: '清理失败' });
  }
});

// 获取文件信息
app.get('/api/file-info/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(config.server.uploadDir, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '文件不存在' });
    }
    
    const fileSize = await CsvService.getFileSize(filePath);
    const structure = await CsvService.analyzeCsvStructure(filePath);
    
    res.json({
      filename,
      fileSize,
      structure
    });
  } catch (error) {
    console.error('获取文件信息失败:', error);
    res.status(500).json({ error: '获取文件信息失败' });
  }
});

// 启动服务器
app.listen(config.server.port, () => {
  console.log(`服务器运行在 http://localhost:${config.server.port}`);
  console.log('请确保已在.env文件中配置腾讯云翻译API密钥');
  console.log(`上传目录: ${config.server.uploadDir}`);
  console.log(`下载目录: ${config.server.downloadDir}`);
  console.log(`支持的语言数量: ${Object.keys(config.supportedLanguages).length}`);
});

module.exports = app;