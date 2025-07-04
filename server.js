const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const BaiduTranslationService = require('./services/translationService');
const CSVService = require('./services/csvService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 文件上传配置
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (path.extname(file.originalname).toLowerCase() === '.csv') {
            cb(null, true);
        } else {
            cb(new Error('只支持CSV文件格式'));
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB限制
    }
});

// 初始化服务
const csvService = new CSVService();
let translationService = null;

// API路由

// 获取支持的语言列表
app.get('/api/languages', (req, res) => {
    const tempService = new BaiduTranslationService('', '');
    res.json({
        success: true,
        languages: tempService.getSupportedLanguages()
    });
});

// 配置百度翻译API
app.post('/api/config', (req, res) => {
    const { appId, secretKey } = req.body;
    
    if (!appId || !secretKey) {
        return res.status(400).json({
            success: false,
            message: '请提供百度翻译API的AppID和SecretKey'
        });
    }
    
    translationService = new BaiduTranslationService(appId, secretKey);
    
    res.json({
        success: true,
        message: '百度翻译API配置成功'
    });
});

// 上传CSV文件
app.post('/api/upload', upload.single('csvFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: '请选择CSV文件'
            });
        }

        const filePath = req.file.path;
        const { headers, data } = await csvService.parseCSV(filePath);
        
        // 清理上传的临时文件
        csvService.cleanupFile(filePath);
        
        res.json({
            success: true,
            message: '文件上传成功',
            data: {
                headers,
                rowCount: data.length,
                preview: data.slice(0, 5), // 返回前5行预览
                fileName: req.file.originalname
            }
        });
    } catch (error) {
        console.error('文件上传错误:', error);
        res.status(500).json({
            success: false,
            message: `文件处理失败: ${error.message}`
        });
    }
});

// 翻译CSV文件
app.post('/api/translate', upload.single('csvFile'), async (req, res) => {
    try {
        if (!translationService) {
            return res.status(400).json({
                success: false,
                message: '请先配置百度翻译API'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: '请选择CSV文件'
            });
        }

        const {
            sourceColumn,
            targetLanguages,
            forceRetranslate = false
        } = req.body;

        if (!sourceColumn) {
            return res.status(400).json({
                success: false,
                message: '请指定源语言列'
            });
        }

        const targetLangs = JSON.parse(targetLanguages || '[]');
        if (targetLangs.length === 0) {
            return res.status(400).json({
                success: false,
                message: '请选择目标翻译语言'
            });
        }

        const filePath = req.file.path;
        let { headers, data } = await csvService.parseCSV(filePath);
        
        // 添加缺失的语言列
        const result = csvService.addMissingLanguageColumns(data, headers, targetLangs);
        data = result.data;
        headers = result.headers;

        // 获取源文本
        const sourceTexts = csvService.getSourceTexts(data, sourceColumn);
        
        // 翻译进度跟踪
        let completedTranslations = 0;
        const totalTranslations = targetLangs.length * sourceTexts.length;
        
        // 为每种目标语言进行翻译
        for (const targetLang of targetLangs) {
            if (targetLang === sourceColumn) {
                continue; // 跳过源语言列
            }

            console.log(`开始翻译到 ${targetLang}...`);
            
            // 筛选需要翻译的文本
            const textsToTranslate = [];
            const indices = [];
            
            sourceTexts.forEach((text, index) => {
                const existingTranslation = data[index][targetLang];
                if (csvService.needsTranslation(existingTranslation, forceRetranslate === 'true')) {
                    textsToTranslate.push(text);
                    indices.push(index);
                }
            });

            if (textsToTranslate.length > 0) {
                // 批量翻译
                const translations = await translationService.translateBatch(
                    textsToTranslate,
                    'auto',
                    targetLang,
                    1200 // 1.2秒延迟避免频率限制
                );

                // 更新翻译结果
                translations.forEach((translation, i) => {
                    const dataIndex = indices[i];
                    const originalText = textsToTranslate[i];
                    data[dataIndex][targetLang] = translation;
                    completedTranslations++;
                    
                    // 发送实时翻译日志
                    io.emit('translationLog', {
                        originalText,
                        translatedText: translation,
                        targetLanguage: targetLang,
                        status: 'success',
                        progress: Math.round((completedTranslations / totalTranslations) * 100)
                    });
                });
            }
            
            console.log(`${targetLang} 翻译完成`);
        }

        // 生成输出文件
        const outputFileName = `translated_${Date.now()}.csv`;
        const outputPath = await csvService.generateCSV(data, headers, outputFileName);
        
        // 清理上传的临时文件
        csvService.cleanupFile(filePath);
        
        res.json({
            success: true,
            message: '翻译完成',
            data: {
                fileName: outputFileName,
                downloadUrl: `/api/download/${outputFileName}`,
                translatedRows: data.length,
                translatedLanguages: targetLangs.length,
                totalTranslations: completedTranslations
            }
        });
        
    } catch (error) {
        console.error('翻译错误:', error);
        res.status(500).json({
            success: false,
            message: `翻译失败: ${error.message}`
        });
    }
});

// 下载翻译后的文件
app.get('/api/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'outputs', filename);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({
            success: false,
            message: '文件不存在'
        });
    }
    
    res.download(filePath, filename, (err) => {
        if (err) {
            console.error('下载错误:', err);
            res.status(500).json({
                success: false,
                message: '下载失败'
            });
        }
    });
});

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'CSV翻译服务运行正常',
        timestamp: new Date().toISOString()
    });
});

// 错误处理中间件
app.use((error, req, res, next) => {
    console.error('服务器错误:', error);
    res.status(500).json({
        success: false,
        message: '服务器内部错误'
    });
});

// Socket.IO连接处理
io.on('connection', (socket) => {
    console.log('客户端已连接:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('客户端已断开连接:', socket.id);
    });
});

// 启动服务器
server.listen(PORT, () => {
    console.log(`CSV翻译服务器运行在 http://localhost:${PORT}`);
    console.log('支持的功能:');
    console.log('- CSV文件上传和解析');
    console.log('- 百度翻译API集成');
    console.log('- 28种语言翻译支持');
    console.log('- 翻译结果下载');
    console.log('- 实时翻译日志推送');
});

module.exports = app;