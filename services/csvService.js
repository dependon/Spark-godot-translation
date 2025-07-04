const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const path = require('path');

class CSVService {
    constructor() {
        this.uploadDir = path.join(__dirname, '../uploads');
        this.outputDir = path.join(__dirname, '../outputs');
        
        // 确保目录存在
        this.ensureDirectoryExists(this.uploadDir);
        this.ensureDirectoryExists(this.outputDir);
    }

    ensureDirectoryExists(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }

    // 解析CSV文件
    async parseCSV(filePath) {
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
                .on('error', (error) => {
                    reject(error);
                });
        });
    }

    // 生成CSV文件
    async generateCSV(data, headers, outputFileName) {
        const outputPath = path.join(this.outputDir, outputFileName);
        
        // 创建CSV写入器
        const csvWriter = createCsvWriter({
            path: outputPath,
            header: headers.map(header => ({ id: header, title: header }))
        });

        try {
            await csvWriter.writeRecords(data);
            return outputPath;
        } catch (error) {
            throw new Error(`生成CSV文件失败: ${error.message}`);
        }
    }

    // 添加缺失的语言列
    addMissingLanguageColumns(data, headers, targetLanguages) {
        const missingLanguages = targetLanguages.filter(lang => !headers.includes(lang));
        
        if (missingLanguages.length === 0) {
            return { data, headers };
        }

        // 添加新的语言列到headers
        const newHeaders = [...headers, ...missingLanguages];
        
        // 为每行数据添加空的语言列
        const newData = data.map(row => {
            const newRow = { ...row };
            missingLanguages.forEach(lang => {
                newRow[lang] = ''; // 初始化为空字符串
            });
            return newRow;
        });

        return { data: newData, headers: newHeaders };
    }

    // 检查是否需要翻译（如果已有翻译且不强制重新翻译）
    needsTranslation(existingText, forceRetranslate) {
        if (forceRetranslate) {
            return true;
        }
        return !existingText || existingText.trim() === '';
    }

    // 获取源列的文本数据
    getSourceTexts(data, sourceColumn) {
        return data.map(row => row[sourceColumn] || '');
    }

    // 更新翻译结果到数据中
    updateTranslations(data, targetColumn, translations) {
        return data.map((row, index) => {
            return {
                ...row,
                [targetColumn]: translations[index] || row[targetColumn] || ''
            };
        });
    }

    // 清理临时文件
    cleanupFile(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (error) {
            console.error('清理文件失败:', error.message);
        }
    }

    // 获取文件统计信息
    getFileStats(filePath) {
        try {
            const stats = fs.statSync(filePath);
            return {
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime
            };
        } catch (error) {
            return null;
        }
    }
}

module.exports = CSVService;