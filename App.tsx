import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Share, BackHandler, TextInput } from 'react-native';
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
  '保单年度', '年龄', '期交\n保费', '累计\n保费',
  '身故\n总利益', '主险现价', '增长率',
  '当年分红现价', '累积分红现价',
  '演示生存总利益', '演示\n增长率',
  '预期生存总利益', '预期\n增长率', '预期\n单利'
];

export default function App() {
  const [age, setAge] = useState<string>('40');
  const [premium, setPremium] = useState<string>('100000');
  const [paymentYears, setPaymentYears] = useState<string>('8');
  const [dividendRate, setDividendRate] = useState<string>('1.6');
  const [data, setData] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showInput, setShowInput] = useState(true);

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

  const calculateData = () => {
    const ageNum = parseInt(age) || 40;
    const premiumNum = parseInt(premium) || 100000;
    const years = parseInt(paymentYears) || 8;
    const rate = parseFloat(dividendRate) || 1.6;

    if (ageNum < 18 || ageNum > 65) {
      Alert.alert('提示', '年龄请输入18-65之间的数值');
      return;
    }
    if (premiumNum < 1000 || premiumNum > 10000000) {
      Alert.alert('提示', '保费请输入合理数值');
      return;
    }
    if (years < 1 || years > 30) {
      Alert.alert('提示', '缴费年限请输入1-30之间的数值');
      return;
    }

    setLoading(true);
    setShowInput(false);

    setTimeout(() => {
      const newData: DataRow[] = [];
      const baseRate = 0.03;
      const cashValueRate = 0.025;
      
      for (let year = 1; year <= 30; year++) {
        const isPaid = year <= years;
        const paidPremium = isPaid ? premiumNum * year : premiumNum * years;
        
        const baseCashValue = paidPremium * cashValueRate * Math.pow(1.05, year - 1);
        const demoCashValue = baseCashValue * rate;
        
        const baseAccumDividend = premiumNum * baseRate * year;
        const demoAccumDividend = baseAccumDividend * rate;
        
        const baseCurrentDividend = premiumNum * baseRate * (isPaid ? 1 : 0);
        const demoCurrentDividend = baseCurrentDividend * rate;
        
        const baseDeathBenefit = paidPremium * 1.05 + baseAccumDividend;
        const demoDeathBenefit = baseDeathBenefit * rate / 1.6;
        
        const baseSurvival = paidPremium * 1.02 + baseAccumDividend;
        const demoSurvival = baseSurvival * rate / 1.6;
        
        const expectedSurvival = baseSurvival;
        
        const baseGrowthRate = year > 1 ? ((baseSurvival) / (paidPremium * 1.02 + baseAccumDividend / rate * (year - 1)) - 1) : null;
        const demoRate = year > 1 && year <= 30 ? 0.038 : null;
        
        const expectedRate = year > 1 && year > years ? baseGrowthRate : null;
        
        const simpleRate = year > years && year <= 30 
          ? (expectedSurvival - paidPremium) / (paidPremium * (year - years)) - 1
          : null;

        newData.push({
          policy_year: year,
          age: ageNum + year,
          premium: isPaid ? premiumNum : 0,
          total_premium: paidPremium,
          death_benefit: Math.round(demoDeathBenefit),
          cash_value: Math.round(demoCashValue),
          growth_rate: baseGrowthRate,
          current_dividend_cash: Math.round(demoCurrentDividend),
          accum_dividend_cash: Math.round(demoAccumDividend),
          demo_survival: Math.round(demoSurvival),
          demo_rate: demoRate,
          expected_survival: Math.round(expectedSurvival),
          expected_rate: expectedRate,
          expected_simple_rate: simpleRate,
        });
      }
      setData(newData);
      setLoading(false);
    }, 500);
  };

  const handleReset = () => {
    setShowInput(true);
    setData([]);
  };

  const exportToCSV = () => {
    if (data.length === 0) {
      Alert.alert('提示', '请先生成数据');
      return;
    }
    
    let csvContent = '保单年度,年龄,期交保费,累计保费,身故总利益,主险现价,增长率,当年分红现价,累积分红现价,演示生存总利益,演示增长率,预期生存总利益,预期增长率,预期单利\n';
    
    data.forEach(row => {
      const demoRateStr = row.demo_rate !== null ? (row.demo_rate * 100).toFixed(2) + '%' : '--';
      const expectedRateStr = row.expected_rate !== null ? (row.expected_rate * 100).toFixed(2) + '%' : '--';
      const simpleRateStr = row.expected_simple_rate !== null ? (row.expected_simple_rate * 100).toFixed(2) + '%' : '--';
      const growthRateStr = row.growth_rate !== null ? (row.growth_rate * 100).toFixed(2) + '%' : '--';
      
      csvContent += `${row.policy_year},${row.age},${row.premium},${row.total_premium},${row.death_benefit},${row.cash_value},${growthRateStr},${row.current_dividend_cash},${row.accum_dividend_cash},${row.demo_survival},${demoRateStr},${row.expected_survival},${expectedRateStr},${simpleRateStr}\n`;
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

  const getDemoRate = (year: number): string => {
    return year >= 11 ? '3.80%' : '--';
  };

  const InputField = ({ label, value, onChange, placeholder, keyboardType = 'default' }: any) => (
    <View style={styles.inputRow}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        keyboardType={keyboardType}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>金尊分红司庆版简版建议书</Text>
        <Text style={styles.subtitle}>分红实现率 {dividendRate}x · {paymentYears}年缴 · 年保费 {parseInt(premium).toLocaleString()}元</Text>
      </View>

      {showInput ? (
        <View style={styles.inputPanel}>
          <Text style={styles.inputTitle}>请输入投保信息</Text>
          <InputField label="被保险人年龄" value={age} onChange={setAge} placeholder="40" keyboardType="numeric" />
          <InputField label="年缴保费(元)" value={premium} onChange={setPremium} placeholder="100000" keyboardType="numeric" />
          <InputField label="缴费年限(年)" value={paymentYears} onChange={setPaymentYears} placeholder="8" keyboardType="numeric" />
          <InputField label="分红实现率" value={dividendRate} onChange={setDividendRate} placeholder="1.6" keyboardType="numeric" />
          
          <TouchableOpacity style={styles.btnCalculate} onPress={calculateData}>
            <Text style={styles.btnText}>生成测算表</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.btnOrange} onPress={handleReset}>
              <Text style={styles.btnText}>重新输入</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnBlue} onPress={() => setDividendRate((parseFloat(dividendRate) + 0.1).toFixed(1).replace('.0', ''))}>
              <Text style={styles.btnText}>+0.1x</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnBlue} onPress={() => setDividendRate(Math.max(0.1, parseFloat(dividendRate) - 0.1).toFixed(1).replace('.0', ''))}>
              <Text style={styles.btnText}>-0.1x</Text>
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
                      <Text style={[styles.dataCell, styles.highlight]}>{getDemoRate(row.policy_year)}</Text>
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
          <Text style={styles.btnText}>导出</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnRed} onPress={handleExit}>
          <Text style={styles.btnText}>退出</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>金尊分红司庆版简版建议书 v2.0</Text>
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
    fontSize: 18,
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
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  inputLabel: {
    width: 100,
    fontSize: 14,
    color: '#333',
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingHorizontal: 10,
    fontSize: 16,
  },
  btnCalculate: {
    backgroundColor: '#1a73e8',
    paddingVertical: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 20,
  },
  actionRow: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: 'white',
    alignItems: 'center',
    gap: 8,
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
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 5,
  },
  btnBlue: {
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    paddingHorizontal: 12,
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
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  rateText: {
    color: '#9c27b0',
    fontWeight: 'bold',
    fontSize: 14,
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
    width: 70,
    padding: 6,
    color: 'white',
    fontSize: 9,
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
    width: 70,
    padding: 6,
    fontSize: 9,
    textAlign: 'center',
    color: '#333',
  },
  highlight: {
    color: '#1a73e8',
    fontWeight: 'bold',
  },
  footer: {
    padding: 10,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  footerText: {
    color: '#999',
    fontSize: 12,
  },
});
