const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const path = require('path');
const config = require('../config');

class CsvService {
  /**
   * 读取CSV文件
   * @param {string} filePath - 文件路径
   * @param {boolean} skipFirstDataRow - 是否跳过第一行数据
   * @returns {Promise<Object>} 包含headers和data的对象
   */
  static readCsvFile(filePath, skipFirstDataRow = false) {
    return new Promise((resolve, reject) => {
      const results = [];
      let headers = [];
      let isFirstDataRow = true;
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('headers', (headerList) => {
          headers = headerList;
        })
        .on('data', (data) => {
          if (skipFirstDataRow && isFirstDataRow) {
            isFirstDataRow = false;
            return;
          }
          results.push(data);
        })
        .on('end', () => {
          resolve({ headers, data: results });
        })
        .on('error', reject);
    });
  }

  /**
   * 写入CSV文件
   * @param {string} filePath - 文件路径
   * @param {Array} headers - 表头数组
   * @param {Array} data - 数据数组
   * @returns {Promise}
   */
  static writeCsvFile(filePath, headers, data) {
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

  /**
   * 分析CSV文件结构
   * @param {Object} csvData - CSV数据对象
   * @returns {Object} 分析结果
   */
  static analyzeCsvStructure(csvData) {
    const existingLanguages = csvData.headers.filter(h => h !== 'keys');
    const missingLanguages = Object.keys(config.supportedLanguages)
      .filter(lang => !existingLanguages.includes(lang));
    
    return {
      headers: csvData.headers,
      existingLanguages,
      missingLanguages,
      rowCount: csvData.data.length,
      preview: csvData.data.slice(0, config.file.previewRows)
    };
  }

  /**
   * 验证CSV文件格式
   * @param {Object} csvData - CSV数据对象
   * @returns {Object} 验证结果
   */
  static validateCsvFormat(csvData) {
    const errors = [];
    const warnings = [];
    
    // 检查是否有headers
    if (!csvData.headers || csvData.headers.length === 0) {
      errors.push('CSV文件缺少表头');
    }
    
    // 检查是否有keys列
    if (!csvData.headers.includes('keys')) {
      errors.push('CSV文件必须包含keys列');
    }
    
    // 检查是否有数据
    if (!csvData.data || csvData.data.length === 0) {
      warnings.push('CSV文件没有数据行');
    }
    
    // 检查数据完整性
    if (csvData.data) {
      csvData.data.forEach((row, index) => {
        if (!row.keys || row.keys.trim() === '') {
          warnings.push(`第${index + 1}行缺少keys值`);
        }
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 生成输出文件名
   * @param {string} originalFileName - 原始文件名
   * @param {string} prefix - 前缀
   * @returns {string} 新文件名
   */
  static generateOutputFileName(originalFileName, prefix = 'translated') {
    const timestamp = Date.now();
    return `${prefix}_${timestamp}_${originalFileName}`;
  }

  /**
   * 确保目录存在
   * @param {string} dirPath - 目录路径
   */
  static ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * 清理临时文件
   * @param {string} filePath - 文件路径
   */
  static cleanupFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error('清理文件失败:', error.message);
    }
  }

  /**
   * 获取文件大小
   * @param {string} filePath - 文件路径
   * @returns {number} 文件大小（字节）
   */
  static getFileSize(filePath) {
    try {
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }
}

module.exports = CsvService;