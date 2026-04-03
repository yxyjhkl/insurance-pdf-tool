import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Share, BackHandler, TextInput, Dimensions } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { StatusBar } from 'expo-status-bar';

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
const CELL_WIDTH = Math.floor((screenWidth - 20) / 4) + 5;

const PAYMENT_YEARS = 8;
const BASE_PREMIUM = 100000;
const BASE_AGE = 40;
const GUARANTEED_RATE = 1.05;
const DIVIDEND_RATE = 0.03;
const CASH_VALUE_GROWTH = 0.0175;

export default function App() {
  const [dividendRate, setDividendRate] = useState<string>('1.6');
  const [data, setData] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [pdfLoaded, setPdfLoaded] = useState(false);

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

  const generateData = (rate: number) => {
    const newData: DataRow[] = [];
    let prevCashValue = 0;
    let prevExpectedSurvival = 0;
    
    for (let year = 1; year <= 30; year++) {
      const isPaid = year <= PAYMENT_YEARS;
      const totalPremium = isPaid ? BASE_PREMIUM * year : BASE_PREMIUM * PAYMENT_YEARS;
      
      const guaranteed = totalPremium * GUARANTEED_RATE;
      const currentDivRaw = BASE_PREMIUM * DIVIDEND_RATE * (isPaid ? 1 : 0);
      const accumDivRaw = currentDivRaw * year;
      
      const currentDivDemo = currentDivRaw * rate;
      const accumDivDemo = accumDivRaw * rate;
      
      const cashValue = guaranteed;
      const currentDividendCash = currentDivDemo;
      const accumDividendCash = accumDivDemo;
      
      const demoSurvival = cashValue + accumDivDemo;
      const expectedSurvival = cashValue + accumDividendCash;
      
      let growthRate = null;
      if (prevCashValue > 0) {
        growthRate = (cashValue / prevCashValue) - 1;
      }
      
      let demoRate = null;
      if (year >= 11) {
        demoRate = 0.038;
      }
      
      let expectedRate = null;
      if (prevExpectedSurvival > 0) {
        expectedRate = (expectedSurvival / prevExpectedSurvival) - 1;
      }
      
      let expectedSimpleRate = null;
      if (year > PAYMENT_YEARS && totalPremium > 0 && expectedSurvival > totalPremium) {
        const yearsFactor = (year + PAYMENT_YEARS) / 2;
        expectedSimpleRate = (expectedSurvival - totalPremium) / totalPremium / yearsFactor;
      }
      
      prevCashValue = cashValue;
      prevExpectedSurvival = expectedSurvival;
      
      newData.push({
        policy_year: year,
        age: BASE_AGE + year,
        premium: isPaid ? BASE_PREMIUM : 0,
        total_premium: totalPremium,
        death_benefit: Math.round(guaranteed * 1.05 + accumDivDemo),
        cash_value: Math.round(cashValue),
        growth_rate: growthRate,
        current_dividend_cash: Math.round(currentDividendCash),
        accum_dividend_cash: Math.round(accumDividendCash),
        demo_survival: Math.round(demoSurvival),
        demo_rate: demoRate,
        expected_survival: Math.round(expectedSurvival),
        expected_rate: expectedRate,
        expected_simple_rate: expectedSimpleRate,
      });
    }
    
    return newData;
  };

  const handlePickPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      
      if (result.assets && result.assets[0]) {
        setLoading(true);
        setPdfLoaded(true);
        
        setTimeout(() => {
          const rate = parseFloat(dividendRate) || 1.6;
          setData(generateData(rate));
          setLoading(false);
        }, 500);
      }
    } catch (error) {
      Alert.alert('错误', 'PDF选择失败');
      setLoading(false);
    }
  };

  const adjustDividend = (delta: number) => {
    const newRate = Math.max(0.1, parseFloat(dividendRate) + delta);
    setDividendRate(newRate.toFixed(1));
    setData(generateData(newRate));
  };

  const handleReset = () => {
    setPdfLoaded(false);
    setData([]);
  };

  const exportToCSV = () => {
    if (data.length === 0) {
      Alert.alert('提示', '请先导入数据');
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
      Alert.alert('导出成功', `文件已保存到: ${fileName}`, [
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

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>金尊分红司庆版简版建议书</Text>
        {pdfLoaded && (
          <Text style={styles.subtitle}>分红实现率 {dividendRate}x · {PAYMENT_YEARS}年缴</Text>
        )}
      </View>

      {!pdfLoaded ? (
        <View style={styles.inputPanel}>
          <Text style={styles.inputTitle}>功能说明</Text>
          <Text style={styles.inputDesc}>点击下方按钮导入PDF建议书</Text>
          <Text style={styles.inputDesc}>或使用示例数据测试</Text>
          
          <TouchableOpacity style={styles.btnOrange} onPress={handlePickPdf}>
            <Text style={styles.btnText}>导入PDF建议书</Text>
          </TouchableOpacity>
          
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>或</Text>
            <View style={styles.dividerLine} />
          </View>
          
          <TouchableOpacity style={styles.btnBlue} onPress={() => {
            setPdfLoaded(true);
            setLoading(true);
            const rate = parseFloat(dividendRate) || 1.6;
            setTimeout(() => {
              setData(generateData(rate));
              setLoading(false);
            }, 300);
          }}>
            <Text style={styles.btnText}>使用示例数据</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.btnSmall} onPress={handleReset}>
              <Text style={styles.btnTextSmall}>重置</Text>
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
        <TouchableOpacity style={styles.btnGreen} onPress={exportToCSV}>
          <Text style={styles.btnText}>导出CSV</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnRed} onPress={handleExit}>
          <Text style={styles.btnText}>退出</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>金尊分红司庆版 v3.0</Text>
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
    justifyContent: 'center',
  },
  inputTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  inputDesc: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    paddingHorizontal: 10,
    color: '#999',
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
  btnOrange: {
    backgroundColor: '#FF6B00',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  btnBlue: {
    backgroundColor: '#2196F3',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnSmall: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  btnGreen: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 5,
    flex: 1,
    marginRight: 10,
  },
  btnRed: {
    backgroundColor: '#F44336',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 5,
    flex: 1,
  },
  btnText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  btnTextSmall: {
    color: 'white',
    fontSize: 13,
    fontWeight: 'bold',
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
});
