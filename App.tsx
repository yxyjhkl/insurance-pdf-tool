import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Share, BackHandler, TextInput, Dimensions, Modal } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { StatusBar } from 'expo-status-bar';

const INSURANCE_DB = require('./insurance_db.js');

// Excel export helper
const createExcelBuffer = (data: DataRow[], gender: string, age: number, premium: number, dividendRate: string): string => {
  const header = ['保单年度', '年龄', '期交保费', '累计保费', '身故总利益', '主险现价', '现价增长率', '当年分红现价', '累计分红现价', '演示生存总利益', '演示增长率', '预期生存总利益', '预期增长率', '预期单利'];
  
  const rows = data.map(row => [
    row.policy_year,
    row.age,
    row.premium,
    row.total_premium,
    row.death_benefit,
    row.cash_value,
    row.growth_rate !== null ? (row.growth_rate * 100).toFixed(2) + '%' : '--',
    row.current_dividend_cash,
    row.accum_dividend_cash,
    row.demo_survival,
    row.demo_rate !== null ? (row.demo_rate * 100).toFixed(2) + '%' : '--',
    row.expected_survival,
    row.expected_rate !== null ? (row.expected_rate * 100).toFixed(2) + '%' : '--',
    row.expected_simple_rate !== null ? (row.expected_simple_rate * 100).toFixed(2) + '%' : '--',
  ]);

  let csv = header.join('\t') + '\n';
  rows.forEach(row => {
    csv += row.join('\t') + '\n';
  });

  // Add summary info
  const infoRow = ['投保信息', gender === 'M' ? '男性' : '女性', age + '岁', premium + '元', '分红' + dividendRate + 'x'];
  csv += '\n' + infoRow.join('\t');

  return csv;
};

const exportToExcel = async (data: DataRow[], gender: string, age: number, premium: number, dividendRate: string) => {
  if (data.length === 0) {
    Alert.alert('提示', '请先计算数据');
    return;
  }

  try {
    const csvContent = createExcelBuffer(data, gender, age, parseFloat(premium), dividendRate);
    const fileName = `金尊海外建议书_${new Date().getTime()}.xls`;
    const filePath = FileSystem.documentDirectory + fileName;

    await FileSystem.writeAsStringAsync(filePath, csvContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    Alert.alert('导出成功', `文件已保存: ${fileName}`, [
      { text: '分享', onPress: () => Share.share({ message: filePath, url: filePath }) },
      { text: '确定' }
    ]);
  } catch (error) {
    Alert.alert('导出失败', '无法保存文件');
  }
};

// Simple text to image (saves as HTML that can be viewed as image)
const exportToImage = async (data: DataRow[], gender: string, age: number, premium: number, dividendRate: string) => {
  if (data.length === 0) {
    Alert.alert('提示', '请先计算数据');
    return;
  }

  try {
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body { font-family: Arial; padding: 10px; }
      h2 { text-align: center; color: #1a73e8; }
      .info { text-align: center; margin-bottom: 10px; color: #666; }
      table { border-collapse: collapse; width: 100%; font-size: 10px; }
      th { background: #1a73e8; color: white; padding: 6px; text-align: center; }
      td { border: 1px solid #ddd; padding: 4px; text-align: right; }
      tr:nth-child(even) { background: #f5f5f5; }
      .highlight { color: #1a73e8; font-weight: bold; }
    </style></head><body>`;
    
    html += `<h2>金尊海外建议书</h2>`;
    html += `<p class="info">${gender === 'M' ? '男性' : '女性'} ${age}岁 | 年交保费 ${parseInt(premium).toLocaleString()}元 | 分红实现率 ${dividendRate}x</p>`;
    html += `<table><tr><th>保单<br>年度</th><th>年龄</th><th>期交<br>保费</th><th>累计<br>保费</th><th>身故<br>总利益</th><th>主险<br>现价</th><th>现价<br>增长率</th><th>当年<br>分红现价</th><th>累计<br>分红现价</th><th>演示<br>生存</th><th>演示<br>增长率</th><th>预期<br>生存</th><th>预期<br>增长率</th><th>预期<br>单利</th></tr>`;
    
    data.forEach(row => {
      const formatNum = (n: number) => Math.round(n).toLocaleString();
      const formatRate = (r: number | null) => r === null ? '--' : (r * 100).toFixed(2) + '%';
      html += `<tr>
        <td>${row.policy_year}</td>
        <td>${row.age}</td>
        <td>${formatNum(row.premium)}</td>
        <td>${formatNum(row.total_premium)}</td>
        <td>${formatNum(row.death_benefit)}</td>
        <td>${formatNum(row.cash_value)}</td>
        <td>${formatRate(row.growth_rate)}</td>
        <td>${formatNum(row.current_dividend_cash)}</td>
        <td>${formatNum(row.accum_dividend_cash)}</td>
        <td>${formatNum(row.demo_survival)}</td>
        <td class="highlight">${formatRate(row.demo_rate)}</td>
        <td>${formatNum(row.expected_survival)}</td>
        <td>${formatRate(row.expected_rate)}</td>
        <td>${formatRate(row.expected_simple_rate)}</td>
      </tr>`;
    });
    
    html += `</table></body></html>`;
    
    const fileName = `金尊海外建议书_${new Date().getTime()}.html`;
    const filePath = FileSystem.documentDirectory + fileName;
    
    await FileSystem.writeAsStringAsync(filePath, html, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    
    Alert.alert('导出成功', `文件已保存: ${fileName}\n可在浏览器中打开查看`, [
      { text: '分享', onPress: () => Share.share({ message: filePath, url: filePath }) },
      { text: '确定' }
    ]);
  } catch (error) {
    Alert.alert('导出失败', '无法保存文件');
  }
};

interface DataRow {
  policy_year: number;
  age: number;
  premium: number;
  total_premium: number;
  death_benefit: number;
  cash_value: number;
  growth_rate: number | null;
  current_dividend_cash: number;
  accum_dividend_cash: number;
  demo_survival: number;
  demo_rate: number | null;
  expected_survival: number;
  expected_rate: number | null;
  expected_simple_rate: number | null;
}

const COLUMNS = [
  '保单\n年度', '年龄', '期交\n保费', '累计\n保费',
  '身故\n总利益', '主险\n现价', '现价\n增长率',
  '当年\n分红现价', '累计\n分红现价',
  '演示生存\n总利益', '演示\n增长率',
  '预期生存\n总利益', '预期\n增长率', '预期\n单利'
];

const screenWidth = Dimensions.get('window').width;
const CELL_WIDTH = Math.floor((screenWidth - 20) / 6);

const AVAILABLE_AGES = INSURANCE_DB.getAvailableAges('F');
const GENDERS = [
  { label: '男性', value: 'M' },
  { label: '女性', value: 'F' },
];

export default function App() {
  const [gender, setGender] = useState('F');
  const [age, setAge] = useState(30);
  const [premium, setPremium] = useState('100000');
  const [dividendRate, setDividendRate] = useState('1.0');
  const [data, setData] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [showAgePicker, setShowAgePicker] = useState(false);

  const interpolateAgeData = (targetAge: number, gender: string, premium: number, dividendRate: number) => {
    const ages = AVAILABLE_AGES.sort((a, b) => a - b);
    if (ages.length < 2) return null;

    let lowerAge = ages[0];
    let upperAge = ages[ages.length - 1];
    for (let i = 0; i < ages.length - 1; i++) {
      if (ages[i] <= targetAge && targetAge <= ages[i + 1]) {
        lowerAge = ages[i];
        upperAge = ages[i + 1];
        break;
      }
    }

    const lowerData = INSURANCE_DB.getInsuranceData(lowerAge, gender, premium, dividendRate);
    const upperData = INSURANCE_DB.getInsuranceData(upperAge, gender, premium, dividendRate);

    if (!lowerData || !upperData) return null;

    if (targetAge === lowerAge) return lowerData;
    if (targetAge === upperAge) return upperData;

    const ratio = (targetAge - lowerAge) / (upperAge - lowerAge);
    
    return lowerData.map((row, idx) => {
      const upperRow = upperData[idx];
      const result: any = { ...row };
      
      const keys: string[] = ['premium', 'total_premium', 'death_benefit', 'cash_value', 'current_dividend_cash', 'accum_dividend_cash', 'demo_survival', 'expected_survival'];
      keys.forEach(key => {
        const lowerVal = row[key as keyof DataRow];
        const upperVal = upperRow[key as keyof DataRow];
        if (typeof lowerVal === 'number' && typeof upperVal === 'number') {
          (result as any)[key] = Math.round(lowerVal + (upperVal - lowerVal) * ratio);
        }
      });
      
      result.age = targetAge + idx;
      return result;
    });
  };

  const formatNumber = (num: number | null | undefined): string => {
    if (num === null || num === undefined) return '--';
    return Math.round(num).toLocaleString();
  };

  const formatRate = (rate: number | null): string => {
    if (rate === null) return '--';
    return (rate * 100).toFixed(2) + '%';
  };

  const formatSimpleRate = (rate: number | null): string => {
    if (rate === null) return '--';
    return (rate * 100).toFixed(2) + '%';
  };

  const handleCalculate = () => {
    const premiumNum = parseFloat(premium);
    if (isNaN(premiumNum) || premiumNum < 25000) {
      Alert.alert('输入错误', '保费最低2.5万元起');
      return;
    }

    const rate = parseFloat(dividendRate) || 1.0;
    const genderCode = gender;

    setLoading(true);
    setTimeout(() => {
      let result: DataRow[] | null = null;
      
      if (AVAILABLE_AGES.includes(age)) {
        result = INSURANCE_DB.getInsuranceData(age, genderCode, premiumNum, rate);
      } else {
        result = interpolateAgeData(age, genderCode, premiumNum, rate);
      }
      
      if (result && result.length > 0) {
        setData(result);
        setShowTable(true);
      } else {
        Alert.alert('数据不存在', '该年龄/性别组合暂无数据');
      }
      setLoading(false);
    }, 300);
  };

  const adjustDividend = (delta: number) => {
    const newRate = Math.max(0, parseFloat(dividendRate) + delta);
    setDividendRate(newRate.toFixed(1));
    const premiumNum = parseFloat(premium);
    if (!isNaN(premiumNum) && premiumNum >= 25000) {
      let result: DataRow[] | null = null;
      if (AVAILABLE_AGES.includes(age)) {
        result = INSURANCE_DB.getInsuranceData(age, gender, premiumNum, newRate);
      } else {
        result = interpolateAgeData(age, gender, premiumNum, newRate);
      }
      if (result) setData(result);
    }
  };

  const handleReset = () => {
    setShowTable(false);
    setData([]);
  };

  const exportToCSV = () => {
    if (data.length === 0) {
      Alert.alert('提示', '请先计算数据');
      return;
    }

    let csvContent = '保单年度,年龄,期交保费,累计保费,身故总利益,主险现价,现价增长率,当年分红现价,累计分红现价,演示生存总利益,演示增长率,预期生存总利益,预期增长率,预期单利\n';

    data.forEach(row => {
      csvContent += `${row.policy_year},${row.age},${row.premium},${row.total_premium},${row.death_benefit},${row.cash_value},${formatRate(row.growth_rate)},${row.current_dividend_cash},${row.accum_dividend_cash},${row.demo_survival},${formatRate(row.demo_rate)},${row.expected_survival},${formatRate(row.expected_rate)},${formatSimpleRate(row.expected_simple_rate)}\n`;
    });

    const fileName = `金尊分红建议书_${new Date().getTime()}.csv`;
    const filePath = FileSystem.documentDirectory + fileName;

    FileSystem.writeAsStringAsync(filePath, csvContent, {
      encoding: FileSystem.EncodingType.UTF8,
    }).then(() => {
      Alert.alert('导出成功', `文件已保存: ${fileName}`, [
        { text: '分享', onPress: () => Share.share({ message: filePath, url: filePath }) },
        { text: '确定' }
      ]);
    }).catch(() => {
      Alert.alert('导出失败', '无法保存文件');
    });
  };

  const handleExit = () => {
    Alert.alert('退出确认', '确定要退出应用吗？', [
      { text: '取消', style: 'cancel' },
      { text: '退出', style: 'destructive', onPress: () => BackHandler.exitApp() }
    ]);
  };

  const getYearText = (year: number) => {
    const yearMap: { [key: number]: string } = {
      0: '0岁',
      5: '5岁',
      10: '10岁',
      20: '20岁',
      30: '30岁',
      40: '40岁',
      50: '50岁',
      60: '60岁',
      62: '62岁',
      65: '65岁',
    };
    return yearMap[year] || `${year}岁`;
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>金尊海外建议书</Text>
        {showTable && (
          <Text style={styles.subtitle}>
            {gender === 'M' ? '男性' : '女性'} {age}岁 · {parseInt(premium).toLocaleString()}元 · 分红{dividendRate}x
          </Text>
        )}
      </View>

      {!showTable ? (
        <View style={styles.inputPanel}>
          <Text style={styles.inputTitle}>输入投保信息</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>性别</Text>
            <View style={styles.genderRow}>
              {GENDERS.map(g => (
                <TouchableOpacity
                  key={g.value}
                  style={[styles.genderBtn, gender === g.value && styles.genderBtnActive]}
                  onPress={() => setGender(g.value)}
                >
                  <Text style={[styles.genderText, gender === g.value && styles.genderTextActive]}>{g.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>投保年龄</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.ageScroll}>
              <View style={styles.ageRow}>
                {AVAILABLE_AGES.map(a => (
                  <TouchableOpacity
                    key={a}
                    style={[styles.ageBtn, age === a && styles.ageBtnActive]}
                    onPress={() => setAge(a)}
                  >
                    <Text style={[styles.ageText, age === a && styles.ageTextActive]}>{getYearText(a)}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.ageBtn, !AVAILABLE_AGES.includes(age) && styles.ageBtnActive]}
                  onPress={() => setShowAgePicker(true)}
                >
                  <Text style={[styles.ageText, !AVAILABLE_AGES.includes(age) && styles.ageTextActive]}>自定义</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>

          <Modal visible={showAgePicker} transparent animationType="slide">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>输入投保年龄 (0-65岁)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={String(age)}
                  onChangeText={(text) => {
                    const num = parseInt(text);
                    if (!isNaN(num) && num >= 0 && num <= 65) {
                      setAge(num);
                    }
                  }}
                  keyboardType="numeric"
                  autoFocus
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowAgePicker(false)}>
                    <Text style={styles.modalBtnText}>取消</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalBtnConfirm} onPress={() => setShowAgePicker(false)}>
                    <Text style={styles.modalBtnText}>确定</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>年交保费 (元)</Text>
            <TextInput
              style={styles.input}
              value={premium}
              onChangeText={setPremium}
              keyboardType="numeric"
              placeholder="最低2.5万元"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>分红实现率</Text>
            <View style={styles.rateRow}>
              <TouchableOpacity style={styles.rateBtn} onPress={() => adjustDividend(-0.1)}>
                <Text style={styles.rateBtnText}>-0.1</Text>
              </TouchableOpacity>
              <Text style={styles.rateValue}>{dividendRate}x</Text>
              <TouchableOpacity style={styles.rateBtn} onPress={() => adjustDividend(0.1)}>
                <Text style={styles.rateBtnText}>+0.1</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.btnOrange} onPress={handleCalculate}>
            <Text style={styles.btnText}>生成建议书</Text>
          </TouchableOpacity>

          <Text style={styles.note}>注: 标准保费10万/年, 8年缴(共80万)</Text>
        </View>
      ) : (
        <>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.btnSmall} onPress={handleReset}>
              <Text style={styles.btnTextSmall}>重算</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSmall} onPress={() => adjustDividend(0.1)}>
              <Text style={styles.btnTextSmall}>+0.1</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSmall} onPress={() => adjustDividend(-0.1)}>
              <Text style={styles.btnTextSmall}>-0.1</Text>
            </TouchableOpacity>
            <Text style={styles.rateText}>{dividendRate}x</Text>
          </View>

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color="#1a73e8" />
              <Text style={styles.loadingText}>正在计算...</Text>
            </View>
          ) : data.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.table}>
                  <View style={styles.headerRow}>
                    {COLUMNS.map((col, idx) => (
                      <Text key={idx} style={styles.headerCell}>{col}</Text>
                    ))}
                  </View>
                  {data.map((row, index) => (
                    <View key={row.policy_year} style={[styles.dataRow, index % 2 === 1 && styles.dataRowAlt]}>
                      <Text style={styles.dataCell}>{row.policy_year}</Text>
                      <Text style={styles.dataCell}>{row.age}</Text>
                      <Text style={styles.dataCell}>{formatNumber(row.premium)}</Text>
                      <Text style={styles.dataCell}>{formatNumber(row.total_premium)}</Text>
                      <Text style={styles.dataCell}>{formatNumber(row.death_benefit)}</Text>
                      <Text style={styles.dataCell}>{formatNumber(row.cash_value)}</Text>
                      <Text style={styles.dataCell}>{formatRate(row.growth_rate)}</Text>
                      <Text style={styles.dataCell}>{formatNumber(row.current_dividend_cash)}</Text>
                      <Text style={styles.dataCell}>{formatNumber(row.accum_dividend_cash)}</Text>
                      <Text style={styles.dataCell}>{formatNumber(row.demo_survival)}</Text>
                      <Text style={[styles.dataCell, styles.highlight]}>{formatRate(row.demo_rate)}</Text>
                      <Text style={styles.dataCell}>{formatNumber(row.expected_survival)}</Text>
                      <Text style={styles.dataCell}>{formatRate(row.expected_rate)}</Text>
                      <Text style={styles.dataCell}>{formatSimpleRate(row.expected_simple_rate)}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </ScrollView>
          ) : null}
        </>
      )}

      <View style={styles.bottomRow}>
        <TouchableOpacity style={styles.btnBlue} onPress={() => exportToExcel(data, gender, age, premium, dividendRate)}>
          <Text style={styles.btnText}>导出Excel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnGreen} onPress={exportToCSV}>
          <Text style={styles.btnText}>CSV</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnPurple} onPress={() => exportToImage(data, gender, age, premium, dividendRate)}>
          <Text style={styles.btnText}>图片</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnRed} onPress={handleExit}>
          <Text style={styles.btnText}>退出</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>金尊海外 v3.2</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#1a73e8',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 15,
    alignItems: 'center',
  },
  title: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#e8f0fe',
    fontSize: 12,
    marginTop: 5,
  },
  inputPanel: {
    flex: 1,
    padding: 20,
    backgroundColor: 'white',
  },
  inputTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 10,
  },
  genderBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  genderBtnActive: {
    backgroundColor: '#e8f0fe',
    borderColor: '#1a73e8',
  },
  genderText: {
    fontSize: 15,
    color: '#666',
  },
  genderTextActive: {
    color: '#1a73e8',
    fontWeight: 'bold',
  },
  ageScroll: {
    flexGrow: 0,
  },
  ageRow: {
    flexDirection: 'row',
    gap: 8,
  },
  ageBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  ageBtnActive: {
    backgroundColor: '#e8f0fe',
    borderColor: '#1a73e8',
  },
  ageText: {
    fontSize: 13,
    color: '#666',
  },
  ageTextActive: {
    color: '#1a73e8',
    fontWeight: 'bold',
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  rateBtn: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  rateBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  rateValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#9c27b0',
    minWidth: 60,
    textAlign: 'center',
  },
  btnOrange: {
    backgroundColor: '#FF6B00',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  btnText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  note: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    marginTop: 15,
  },
  actionRow: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  bottomRow: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  btnSmall: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  btnTextSmall: {
    color: 'white',
    fontSize: 13,
    fontWeight: 'bold',
  },
  btnGreen: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 5,
    flex: 1,
    marginRight: 5,
  },
  btnBlue: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 5,
    flex: 1,
    marginRight: 5,
  },
  btnPurple: {
    backgroundColor: '#9C27B0',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 5,
    flex: 1,
    marginRight: 5,
  },
  btnRed: {
    backgroundColor: '#F44336',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 5,
    flex: 1,
  },
  rateText: {
    color: '#9c27b0',
    fontWeight: 'bold',
    fontSize: 16,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  table: {
    padding: 10,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#1a73e8',
  },
  headerCell: {
    width: CELL_WIDTH,
    padding: 6,
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  dataRow: {
    flexDirection: 'row',
    backgroundColor: 'white',
  },
  dataRowAlt: {
    backgroundColor: '#e8f0fe',
  },
  dataCell: {
    width: CELL_WIDTH,
    padding: 6,
    fontSize: 10,
    textAlign: 'center',
    color: '#333',
  },
  highlight: {
    color: '#1a73e8',
    fontWeight: 'bold',
  },
  footer: {
    padding: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  footerText: {
    color: '#999',
    fontSize: 11,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#1a73e8',
    borderRadius: 8,
    padding: 12,
    fontSize: 24,
    width: '100%',
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 15,
  },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#999',
    alignItems: 'center',
  },
  modalBtnConfirm: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#1a73e8',
    alignItems: 'center',
  },
  modalBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
});