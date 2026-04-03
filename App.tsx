import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Share, BackHandler, TextInput, Dimensions, Modal } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { StatusBar } from 'expo-status-bar';
import * as XLSX from 'xlsx';
import ViewShot from 'react-native-view-shot';

const INSURANCE_DB = require('./insurance_db.js');

const exportToExcel = async (data: DataRow[], gender: string, age: number, premium: number, dividendRate: number) => {
  if (data.length === 0) {
    Alert.alert('提示', '请先计算数据');
    return;
  }

  try {
    const wsData = [
      ['金尊海外建议书'],
      [`${gender === 'M' ? '男性' : '女性'} ${age}岁 | 年交保费 ${parseInt(premium).toLocaleString()}元 | 分红实现率 ${dividendRate}x`],
      [],
      ['保单年度', '年龄', '期交保费', '累计保费', '身故总利益', '主险现价', '现价增长率', '当年分红现价', '累计分红现价', '演示生存总利益', '演示增长率', '预期生存总利益', '预期增长率', '预期单利'],
    ];

    data.forEach(row => {
      wsData.push([
        row.policy_year,
        row.age,
        row.premium,
        row.total_premium,
        row.death_benefit,
        row.cash_value,
        row.growth_rate !== null ? row.growth_rate : null,
        row.current_dividend_cash,
        row.accum_dividend_cash,
        row.demo_survival,
        row.demo_rate !== null ? row.demo_rate : null,
        row.expected_survival,
        row.expected_rate !== null ? row.expected_rate : null,
        row.expected_simple_rate !== null ? row.expected_simple_rate : null,
      ]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws['!cols'] = [
      { wch: 10 }, { wch: 8 }, { wch: 12 }, { wch: 12 },
      { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
      { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 16 },
      { wch: 12 }, { wch: 12 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, '建议书');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });

    const fileName = `金尊海外建议书_${new Date().getTime()}.xlsx`;
    const filePath = FileSystem.documentDirectory + fileName;

    await FileSystem.writeAsStringAsync(filePath, wbout, {
      encoding: FileSystem.EncodingType.Base64,
    });

    Alert.alert('导出成功', `文件已保存: ${fileName}`, [
      { text: '分享', onPress: () => Share.share({ message: filePath, url: filePath }) },
      { text: '确定' }
    ]);
  } catch (error) {
    Alert.alert('导出失败', '无法保存文件');
  }
};

const captureRef = useRef<ViewShot>(null);
const [capturing, setCapturing] = useState(false);

  const exportToImage = async () => {
    if (data.length === 0) {
      Alert.alert('提示', '请先计算数据');
      return;
    }
    if (!captureRef.current) {
      Alert.alert('错误', '截图组件未就绪');
      return;
    }

    try {
      setCapturing(true);
      const uri = await captureRef.current.capture?.({
        format: 'jpg',
        quality: 0.92,
        result: 'tmpfile',
      });

      if (!uri) {
        Alert.alert('导出失败', '截图失败');
        return;
      }

      const fileName = `金尊海外建议书_${new Date().getTime()}.jpg`;
      const destPath = FileSystem.documentDirectory + fileName;
      await FileSystem.copyAsync({ from: uri, to: destPath });

      Alert.alert('导出成功', `图片已保存: ${fileName}`, [
        { text: '分享', onPress: () => Share.share({ message: destPath, url: destPath }) },
        { text: '确定' }
      ]);
    } catch (error) {
      Alert.alert('导出失败', '无法保存图片');
    } finally {
      setCapturing(false);
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
  { name: '保单\n年度', width: 38 },
  { name: '年龄', width: 35 },
  { name: '身故\n总利益', width: 55 },
  { name: '主险\n现价', width: 52 },
  { name: '现价\n增长率', width: 48 },
  { name: '当年\n分红', width: 50 },
  { name: '累计\n分红', width: 50 },
  { name: '演示\n生存', width: 55 },
  { name: '演示\n增长率', width: 48 },
  { name: '预期\n生存', width: 55 },
  { name: '预期\n增长率', width: 48 },
  { name: '预期\n单利', width: 42 },
];

const screenWidth = Dimensions.get('window').width;
const CELL_WIDTH = 70;
const NARROW_CELL_WIDTH = 50;

const ALL_AGES_F: number[] = INSURANCE_DB.getAvailableAges('F');
const ALL_AGES_M: number[] = INSURANCE_DB.getAvailableAges('M');
const GENDERS = [
  { label: '男性', value: 'M' },
  { label: '女性', value: 'F' },
];

export default function App() {
  const [gender, setGender] = useState('F');
  const [age, setAge] = useState(30);
  const [premium, setPremium] = useState('100000');
  const [dividendRate, setDividendRate] = useState(1.0);
  const [data, setData] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [showAgePicker, setShowAgePicker] = useState(false);
  const [tempAge, setTempAge] = useState('30');

  const [showRatePicker, setShowRatePicker] = useState(false);
  const [tempRate, setTempRate] = useState('1.00');
  const [showHelp, setShowHelp] = useState(false);

  const getMaxAge = () => gender === 'M' ? 62 : 65;

  const getAvailableAges = (): number[] => {
    return gender === 'M' ? ALL_AGES_M : ALL_AGES_F;
  };

  const getFilteredAges = (): number[] => {
    const maxAge = getMaxAge();
    return getAvailableAges().filter((a: number) => a <= maxAge);
  };

  const interpolateAgeData = (targetAge: number, genderCode: string, premium: number, dividendRate: number): DataRow[] | null => {
    try {
      const ages = getAvailableAges();
      if (!ages || ages.length < 2) return null;

      const sortedAges = [...ages].sort((a, b) => a - b);
      
      let lowerAge = sortedAges[0];
      let upperAge = sortedAges[sortedAges.length - 1];
      for (let i = 0; i < sortedAges.length - 1; i++) {
        if (sortedAges[i] <= targetAge && targetAge <= sortedAges[i + 1]) {
          lowerAge = sortedAges[i];
          upperAge = sortedAges[i + 1];
          break;
        }
      }

      const lowerData = INSURANCE_DB.getInsuranceData(lowerAge, genderCode, premium, dividendRate);
      const upperData = INSURANCE_DB.getInsuranceData(upperAge, genderCode, premium, dividendRate);

      if (!lowerData || !upperData || !lowerData.length || !upperData.length) {
        return null;
      }

      if (targetAge === lowerAge) return lowerData;
      if (targetAge === upperAge) return upperData;

      const ratio = (targetAge - lowerAge) / (upperAge - lowerAge);
      if (isNaN(ratio) || !isFinite(ratio)) return lowerData;
      
      return lowerData.map((row, idx) => {
        if (!upperData[idx]) return row;
        const upperRow = upperData[idx];
        const result: DataRow = { ...row };
        
        const keys: (keyof DataRow)[] = ['premium', 'total_premium', 'death_benefit', 'cash_value', 'current_dividend_cash', 'accum_dividend_cash', 'demo_survival', 'expected_survival'];
        for (const key of keys) {
          const lowerVal = row[key];
          const upperVal = upperRow[key];
          if (typeof lowerVal === 'number' && typeof upperVal === 'number' && isFinite(lowerVal) && isFinite(upperVal)) {
            result[key] = Math.round(lowerVal + (upperVal - lowerVal) * ratio);
          }
        }
        
        result.age = targetAge + idx;
        return result;
      });
    } catch (error) {
      console.error('Interpolate error:', error);
      return null;
    }
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

    const rate = isNaN(dividendRate) ? 1.0 : dividendRate;
    const genderCode = gender;

    setLoading(true);
    setTimeout(() => {
      let result: DataRow[] | null = null;
      
      if (getAvailableAges().includes(age)) {
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
    const newRate = Math.max(0, dividendRate + delta);
    setDividendRate(parseFloat(newRate.toFixed(2)));
    const premiumNum = parseFloat(premium);
    if (!isNaN(premiumNum) && premiumNum >= 25000) {
      let result: DataRow[] | null = null;
      if (getAvailableAges().includes(age)) {
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
            {gender === 'M' ? '男性' : '女性'} {age}岁 | 期交{parseInt(premium).toLocaleString()}元 | 累计{(parseInt(premium)*8).toLocaleString()}元 | 分红{dividendRate}x
          </Text>
        )}
        <TouchableOpacity style={styles.helpBtn} onPress={() => setShowHelp(true)}>
          <Text style={styles.helpBtnText}>?</Text>
        </TouchableOpacity>
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
            <View style={styles.ageGridContainer}>
              <View style={styles.ageRow}>
                {getFilteredAges().slice(0, 5).map(a => (
                  <TouchableOpacity
                    key={a}
                    style={[styles.ageBtn, age === a && styles.ageBtnActive]}
                    onPress={() => setAge(a)}
                  >
                    <Text style={[styles.ageText, age === a && styles.ageTextActive]}>{getYearText(a)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.ageRow}>
                {getFilteredAges().slice(5).map(a => (
                  <TouchableOpacity
                    key={a}
                    style={[styles.ageBtn, age === a && styles.ageBtnActive]}
                    onPress={() => setAge(a)}
                  >
                    <Text style={[styles.ageText, age === a && styles.ageTextActive]}>{getYearText(a)}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.ageBtn, !getFilteredAges().includes(age) && styles.ageBtnActive]}
                  onPress={() => {
                    setTempAge(String(age));
                    setShowAgePicker(true);
                  }}
                >
                  <Text style={[styles.ageText, !getFilteredAges().includes(age) && styles.ageTextActive]}>自定义</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <Modal visible={showAgePicker} transparent animationType="slide">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>输入投保年龄</Text>
                <View style={styles.ageInputRow}>
                  <TouchableOpacity style={styles.ageStepBtn} onPress={() => {
                    const newVal = Math.max(0, age - 1);
                    setAge(newVal);
                    setTempAge(String(newVal));
                  }}>
                    <Text style={styles.ageStepText}>-</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.ageInput}
                    value={tempAge}
                    onChangeText={setTempAge}
                    keyboardType="numeric"
                    maxLength={3}
                  />
                  <TouchableOpacity style={styles.ageStepBtn} onPress={() => {
                    const maxAge = gender === 'M' ? 62 : 65;
                    const newVal = Math.min(maxAge, age + 1);
                    setAge(newVal);
                    setTempAge(String(newVal));
                  }}>
                    <Text style={styles.ageStepText}>+</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.ageRangeText}>
                  {gender === 'M' ? '男性可输入 0-62岁' : '女性可输入 0-65岁'}
                </Text>
                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.modalBtnCancel} onPress={() => {
                    setTempAge(String(age));
                    setShowAgePicker(false);
                  }}>
                    <Text style={styles.modalBtnText}>取消</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalBtnConfirm} onPress={() => {
                    const num = parseInt(tempAge);
                    const maxAge = gender === 'M' ? 62 : 65;
                    if (!isNaN(num) && num >= 0 && num <= maxAge) {
                      setAge(num);
                    } else {
                      Alert.alert('输入错误', gender === 'M' ? '男性年龄需在0-62岁之间' : '女性年龄需在0-65岁之间');
                      return;
                    }
                    setShowAgePicker(false);
                  }}>
                    <Text style={styles.modalBtnText}>确定</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          <Modal visible={showRatePicker} transparent animationType="slide">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>输入分红实现率</Text>
                <View style={styles.ageInputRow}>
                  <TouchableOpacity style={styles.ageStepBtn} onPress={() => {
                    const newVal = Math.max(0, parseFloat(tempRate) - 0.01);
                    setTempRate(newVal.toFixed(2));
                  }}>
                    <Text style={styles.ageStepText}>-</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.ageInput}
                    value={tempRate}
                    onChangeText={setTempRate}
                    keyboardType="decimal-pad"
                    maxLength={5}
                  />
                  <TouchableOpacity style={styles.ageStepBtn} onPress={() => {
                    const newVal = parseFloat(tempRate) + 0.01;
                    setTempRate(newVal.toFixed(2));
                  }}>
                    <Text style={styles.ageStepText}>+</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.ageRangeText}>
                  建议范围 0.50x - 2.00x
                </Text>
                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.modalBtnCancel} onPress={() => {
                    setTempRate(dividendRate.toFixed(2));
                    setShowRatePicker(false);
                  }}>
                    <Text style={styles.modalBtnText}>取消</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalBtnConfirm} onPress={() => {
                    const num = parseFloat(tempRate);
                    if (!isNaN(num) && num >= 0 && num <= 5) {
                      setDividendRate(parseFloat(num.toFixed(2)));
                      const pNum = parseFloat(premium);
                      if (!isNaN(pNum) && pNum >= 25000) {
                        let result: DataRow[] | null = null;
                        if (getAvailableAges().includes(age)) {
                          result = INSURANCE_DB.getInsuranceData(age, gender, pNum, num);
                        } else {
                          result = interpolateAgeData(age, gender, pNum, num);
                        }
                        if (result) setData(result);
                      }
                    } else {
                      Alert.alert('输入错误', '分红实现率需在0-5之间');
                      return;
                    }
                    setShowRatePicker(false);
                  }}>
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
              <TouchableOpacity style={styles.rateBtn} onPress={() => adjustDividend(-0.01)}>
                <Text style={styles.rateBtnText}>-1%</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rateBtnCustom} onPress={() => {
                setTempRate(dividendRate.toFixed(2));
                setShowRatePicker(true);
              }}>
                <Text style={styles.rateBtnCustomText}>{dividendRate.toFixed(2)}x</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rateBtn} onPress={() => adjustDividend(0.01)}>
                <Text style={styles.rateBtnText}>+1%</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.btnOrange} onPress={handleCalculate}>
            <Text style={styles.btnText}>生成建议书</Text>
          </TouchableOpacity>

          <Text style={styles.note}>注: 参考保费10万/年, 8年缴(共80万)</Text>
        </View>
      ) : (
        <>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.btnSmall} onPress={handleReset}>
              <Text style={styles.btnTextSmall}>重算</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSmall} onPress={() => adjustDividend(0.01)}>
              <Text style={styles.btnTextSmall}>+1%</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnSmall, styles.btnSmallCustom]} onPress={() => {
              setTempRate(dividendRate.toFixed(2));
              setShowRatePicker(true);
            }}>
              <Text style={styles.btnTextSmall}>{dividendRate.toFixed(2)}x</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSmall} onPress={() => adjustDividend(-0.01)}>
              <Text style={styles.btnTextSmall}>-1%</Text>
            </TouchableOpacity>
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
                      <Text key={idx} style={[styles.headerCell, { width: col.width }]}>{col.name}</Text>
                    ))}
                  </View>
                  {data.map((row, index) => (
                    <View key={row.policy_year} style={[styles.dataRow, index % 2 === 1 && styles.dataRowAlt]}>
                      <Text style={[styles.dataCell, { width: COLUMNS[0].width }]}>{row.policy_year}</Text>
                      <Text style={[styles.dataCell, { width: COLUMNS[1].width }]}>{row.age}</Text>
                      <Text style={[styles.dataCell, { width: COLUMNS[2].width }]}>{formatNumber(row.death_benefit)}</Text>
                      <Text style={[styles.dataCell, { width: COLUMNS[3].width }]}>{formatNumber(row.cash_value)}</Text>
                      <Text style={[styles.dataCell, { width: COLUMNS[4].width }]}>{formatRate(row.growth_rate)}</Text>
                      <Text style={[styles.dataCell, { width: COLUMNS[5].width }]}>{formatNumber(row.current_dividend_cash)}</Text>
                      <Text style={[styles.dataCell, { width: COLUMNS[6].width }]}>{formatNumber(row.accum_dividend_cash)}</Text>
                      <Text style={[styles.dataCell, { width: COLUMNS[7].width }]}>{formatNumber(row.demo_survival)}</Text>
                      <Text style={[styles.dataCell, styles.highlight, { width: COLUMNS[8].width }]}>{formatRate(row.demo_rate)}</Text>
                      <Text style={[styles.dataCell, { width: COLUMNS[9].width }]}>{formatNumber(row.expected_survival)}</Text>
                      <Text style={[styles.dataCell, { width: COLUMNS[10].width }]}>{formatRate(row.expected_rate)}</Text>
                      <Text style={[styles.dataCell, { width: COLUMNS[11].width }]}>{formatSimpleRate(row.expected_simple_rate)}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </ScrollView>
          ) : null}

          <View style={styles.captureContainer}>
            <ViewShot ref={captureRef} options={{ format: 'jpg', quality: 0.92, result: 'tmpfile' }}>
              <View style={styles.captureContent}>
                <Text style={styles.captureTitle}>金尊海外建议书</Text>
                <Text style={styles.captureInfo}>
                  {gender === 'M' ? '男性' : '女性'} {age}岁 | 年交保费 {parseInt(premium).toLocaleString()}元 | 分红实现率 {dividendRate}x
                </Text>
                <View style={styles.captureTable}>
                  <View style={styles.captureHeaderRow}>
                    {COLUMNS.map((col, idx) => (
                      <Text key={idx} style={[styles.captureHeaderCell, { width: col.width }]}>{col.name}</Text>
                    ))}
                  </View>
                  {data.map((row, index) => (
                    <View key={row.policy_year} style={[styles.captureDataRow, index % 2 === 1 && styles.captureDataRowAlt]}>
                      <Text style={[styles.captureDataCell, { width: COLUMNS[0].width }]}>{row.policy_year}</Text>
                      <Text style={[styles.captureDataCell, { width: COLUMNS[1].width }]}>{row.age}</Text>
                      <Text style={[styles.captureDataCell, { width: COLUMNS[2].width }]}>{formatNumber(row.death_benefit)}</Text>
                      <Text style={[styles.captureDataCell, { width: COLUMNS[3].width }]}>{formatNumber(row.cash_value)}</Text>
                      <Text style={[styles.captureDataCell, { width: COLUMNS[4].width }]}>{formatRate(row.growth_rate)}</Text>
                      <Text style={[styles.captureDataCell, { width: COLUMNS[5].width }]}>{formatNumber(row.current_dividend_cash)}</Text>
                      <Text style={[styles.captureDataCell, { width: COLUMNS[6].width }]}>{formatNumber(row.accum_dividend_cash)}</Text>
                      <Text style={[styles.captureDataCell, { width: COLUMNS[7].width }]}>{formatNumber(row.demo_survival)}</Text>
                      <Text style={[styles.captureDataCell, styles.captureHighlight, { width: COLUMNS[8].width }]}>{formatRate(row.demo_rate)}</Text>
                      <Text style={[styles.captureDataCell, { width: COLUMNS[9].width }]}>{formatNumber(row.expected_survival)}</Text>
                      <Text style={[styles.captureDataCell, { width: COLUMNS[10].width }]}>{formatRate(row.expected_rate)}</Text>
                      <Text style={[styles.captureDataCell, { width: COLUMNS[11].width }]}>{formatSimpleRate(row.expected_simple_rate)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </ViewShot>
          </View>
        </>
      )}

      <View style={styles.bottomRow}>
        <TouchableOpacity style={[styles.bottomBtn, styles.bottomBtn1]} onPress={() => exportToExcel(data, gender, age, premium, dividendRate)}>
          <Text style={styles.bottomBtnText}>导出表格</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.bottomBtn, styles.bottomBtn2]} onPress={exportToCSV}>
          <Text style={styles.bottomBtnText}>导出CSV</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.bottomBtn, styles.bottomBtn3]} onPress={exportToImage} disabled={capturing}>
          <Text style={styles.bottomBtnText}>{capturing ? '导出中...' : '导出图片'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.bottomBtn, styles.bottomBtn4]} onPress={handleExit}>
          <Text style={styles.bottomBtnText}>退出程序</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>金尊海外 v3.2</Text>
      </View>

      <Modal visible={showHelp} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.helpModal]}>
            <Text style={styles.helpModalTitle}>使用指南</Text>
            <ScrollView style={styles.helpScroll}>
              <Text style={styles.helpSection}>投保信息</Text>
              <Text style={styles.helpText}>本产品投保年龄：男性0-62岁，女性0-65岁。年交保费最低2.5万元起，标准保费为10万/年缴8年（共80万）。</Text>

              <Text style={styles.helpSection}>分红实现率</Text>
              <Text style={styles.helpText}>分红实现率反映实际分红与演示水平的比例。1.0x表示按演示水平分红，+1%/-1%可微调，点击中间数值可自定义输入（范围0-5x）。</Text>

              <Text style={styles.helpSection}>数据说明</Text>
              <Text style={styles.helpText}>• 身故总利益：被保人身故时受益人可获得的总金额{'\n'}• 主险现价：保单现金价值（保证部分）{'\n'}• 演示生存总利益：按演示分红水平的生存利益{'\n'}• 预期生存总利益：根据设定分红实现率计算的预期利益{'\n'}• 演示/预期增长率：当年相对上一年的增长率{'\n'}• 预期单利：缴费期满后的年化单利</Text>

              <Text style={styles.helpSection}>导出功能</Text>
              <Text style={styles.helpText}>• 导出表格：生成.xlsx文件，可用Excel打开{'\n'}• 导出CSV：生成逗号分隔文本文件{'\n'}• 导出图片：将建议书截图保存为JPG图片</Text>

              <Text style={styles.helpSection}>关于</Text>
              <Text style={styles.helpText}>金尊海外建议书 v3.2{'\n'}基于平安保险金尊分红司庆海外版产品数据开发{'\n'}本工具仅供参考，不构成任何保险建议{'\n'}实际保单利益以保险公司正式出具的保单为准{'\n'}{'\n'}⚠️ 本应用程序仅为学习编程和研究产品使用，不得用于展业，如有违规后果自负！{'\n'}{'\n'}作者：野生程序猿老何{'\n'}福建龙岩</Text>
            </ScrollView>
            <TouchableOpacity style={styles.modalBtnConfirm} onPress={() => setShowHelp(false)}>
              <Text style={styles.modalBtnText}>我知道了</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    position: 'relative',
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
  helpBtn: {
    position: 'absolute',
    right: 15,
    top: 55,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  helpBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
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
  ageGridContainer: {
    flexDirection: 'column',
    gap: 8,
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
  rateBtnCustom: {
    backgroundColor: '#e8f0fe',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#1a73e8',
  },
  rateBtnCustomText: {
    color: '#1a73e8',
    fontWeight: 'bold',
    fontSize: 16,
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
  bottomBtn: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
    minHeight: 50,
    justifyContent: 'center',
  },
  bottomBtn1: {
    backgroundColor: '#4CAF50',
  },
  bottomBtn2: {
    backgroundColor: '#2196F3',
  },
  bottomBtn3: {
    backgroundColor: '#9C27B0',
  },
  bottomBtn4: {
    backgroundColor: '#F44336',
  },
  bottomBtnText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  btnSmall: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  btnSmallCustom: {
    backgroundColor: '#e8f0fe',
    borderWidth: 2,
    borderColor: '#1a73e8',
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
  headerCellNarrow: {
    width: NARROW_CELL_WIDTH,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#1a73e8',
  },
  headerCell: {
    padding: 4,
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  headerCellNarrow: {
    width: NARROW_CELL_WIDTH,
  },
  dataRow: {
    flexDirection: 'row',
    height: 22,
    backgroundColor: 'white',
  },
  dataRowAlt: {
    backgroundColor: '#e8f0fe',
  },
  dataCell: {
    padding: 2,
    fontSize: 9,
    textAlign: 'center',
    color: '#333',
    textAlignVertical: 'center',
  },
  narrowCell: {
    width: NARROW_CELL_WIDTH,
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
  ageInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 15,
    gap: 15,
  },
  ageStepBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1a73e8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ageStepText: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
  },
  ageInput: {
    width: 80,
    height: 60,
    borderWidth: 2,
    borderColor: '#1a73e8',
    borderRadius: 10,
    fontSize: 32,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  ageRangeText: {
    color: '#666',
    fontSize: 12,
    marginBottom: 15,
  },
  helpModal: {
    width: '90%',
    maxHeight: '80%',
  },
  helpModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a73e8',
    marginBottom: 15,
    textAlign: 'center',
  },
  helpScroll: {
    maxHeight: 400,
    marginBottom: 15,
  },
  helpSection: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
    marginBottom: 4,
  },
  helpText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
  },
  captureContainer: {
    position: 'absolute',
    left: -9999,
    top: 0,
    width: 600,
  },
  captureContent: {
    backgroundColor: 'white',
    padding: 15,
  },
  captureTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a73e8',
    textAlign: 'center',
    marginBottom: 5,
  },
  captureInfo: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  captureTable: {
    borderWidth: 1,
    borderColor: '#dadce0',
  },
  captureHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#1a73e8',
  },
  captureHeaderCell: {
    padding: 4,
    color: 'white',
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  captureDataRow: {
    flexDirection: 'row',
    height: 22,
    backgroundColor: 'white',
  },
  captureDataRowAlt: {
    backgroundColor: '#e8f0fe',
  },
  captureDataCell: {
    padding: 3,
    fontSize: 9,
    textAlign: 'center',
    color: '#333',
    borderWidth: 0.5,
    borderColor: '#dadce0',
  },
  captureHighlight: {
    color: '#1a73e8',
    fontWeight: 'bold',
  },
});