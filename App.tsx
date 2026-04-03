import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Share, BackHandler, TextInput, Dimensions } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { useSharedValue } from 'react-native-reanimated';

const BAIDU_API_KEY = "0GiWBxWFOYl3BFxWyGeXVMzF";
const BAIDU_SECRET_KEY = "6HvFmcFenH83ZhxXDrLOa7Os80zjq6uv";

let baiduAccessToken = "";

async function getBaiduToken() {
  if (baiduAccessToken) return baiduAccessToken;
  try {
    const response = await fetch("https://aip.baidubce.com/oauth/2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=client_credentials&client_id=${BAIDU_API_KEY}&client_secret=${BAIDU_SECRET_KEY}`
    });
    const data = await response.json();
    if (data.access_token) {
      baiduAccessToken = data.access_token;
      return baiduAccessToken;
    }
  } catch (e) { console.error(e); }
  return "";
}

async function recognizeImageWithBaidu(imageUri) {
  const token = await getBaiduToken();
  if (!token) return null;
  try {
    const base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: FileSystem.EncodingType.Base64 });
    const response = await fetch(`https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `image=${encodeURIComponent(base64)}`
    });
    return await response.json();
  } catch (e) { return null; }
}

function extractCashValuesFromOCR(ocrText) {
  const lines = ocrText.split("\n");
  const cashValues = [];
  for (const line of lines) {
    const cleaned = line.replace(/[^\d,，.]/g, "");
    const nums = cleaned.match(/\d+/g);
    if (nums && nums.length >= 2) {
      for (const num of nums) {
        const val = parseInt(num);
        if (val >= 1000 && val <= 100000000) {
          cashValues.push(val);
          if (cashValues.length >= 5) break;
        }
      }
    }
    if (cashValues.length >= 5) break;
  }
  if (cashValues.length >= 5) {
    return [cashValues[0], cashValues[1] || cashValues[0]*5, cashValues[2] || cashValues[0]*10, cashValues[3] || cashValues[0]*20, cashValues[4] || cashValues[0]*30];
  }
  return null;
}

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
const DIVIDEND_RATE_BASE = 0.03;

function interpolateCashValue(cashValues: number[], year: number): number {
  const years = [1, 5, 10, 20, 30];
  
  if (year <= 1) return cashValues[0];
  if (year >= 30) return cashValues[4];
  
  for (let i = 0; i < years.length - 1; i++) {
    if (year >= years[i] && year <= years[i+1]) {
      const t = (year - years[i]) / (years[i+1] - years[i]);
      return cashValues[i] + t * (cashValues[i+1] - cashValues[i]);
    }
  }
  
  return cashValues[4];
}

export default function App() {
  const [age, setAge] = useState<string>('40');
  const [premium, setPremium] = useState<string>('100000');
  const [paymentYears, setPaymentYears] = useState<string>('8');
  const [dividendRate, setDividendRate] = useState<string>('1.6');
  
  const [cash1, setCash1] = useState<string>('');
  const [cash5, setCash5] = useState<string>('');
  const [cash10, setCash10] = useState<string>('');
  const [cash20, setCash20] = useState<string>('');
  const [cash30, setCash30] = useState<string>('');
  
  const [data, setData] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showInput, setShowInput] = useState(true);
  const [inputMode, setInputMode] = useState<'params' | 'cash'>('params');

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

  const generateData = (rate: number, cashValues: number[]) => {
    const ageNum = parseInt(age) || 40;
    const premiumNum = parseInt(premium) || 100000;
    const years = parseInt(paymentYears) || 8;
    
    const newData: DataRow[] = [];
    let prevCashValue = 0;
    let prevExpectedSurvival = 0;
    let prevDemoSurvival = 0;
    
    for (let year = 1; year <= 30; year++) {
      const isPaid = year <= years;
      const totalPremium = isPaid ? premiumNum * year : premiumNum * years;
      
      const cashValue = interpolateCashValue(cashValues, year);
      
      const baseDividend = premiumNum * DIVIDEND_RATE_BASE;
      const currentDivRaw = baseDividend * (isPaid ? 1 : 0);
      const accumDivRaw = baseDividend * year;
      
      const currentDivDemo = currentDivRaw * rate;
      const accumDivDemo = accumDivRaw * rate;
      
      const currentDividendCash = currentDivDemo;
      const accumDividendCash = accumDivDemo;
      
      const demoSurvival = cashValue + accumDivDemo;
      const expectedSurvival = cashValue + accumDividendCash;
      
      let growthRate = null;
      if (prevCashValue > 0) {
        growthRate = (cashValue / prevCashValue) - 1;
      }
      
      let demoRate = null;
      if (prevDemoSurvival > 0) {
        demoRate = (demoSurvival / prevDemoSurvival) - 1;
      }
      
      let expectedRate = null;
      if (prevExpectedSurvival > 0) {
        expectedRate = (expectedSurvival / prevExpectedSurvival) - 1;
      }
      
      let expectedSimpleRate = null;
      if (year > years && totalPremium > 0 && expectedSurvival > totalPremium) {
        const yearsFactor = (year + years) / 2;
        expectedSimpleRate = (expectedSurvival - totalPremium) / totalPremium / yearsFactor;
      }
      
      prevCashValue = cashValue;
      prevExpectedSurvival = expectedSurvival;
      prevDemoSurvival = demoSurvival;
      
      newData.push({
        policy_year: year,
        age: ageNum + year,
        premium: isPaid ? premiumNum : 0,
        total_premium: totalPremium,
        death_benefit: Math.round(cashValue * 1.05 + accumDivDemo),
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

  const handleCalculate = () => {
    if (inputMode === 'params') {
      setLoading(true);
      setTimeout(() => {
        const rate = parseFloat(dividendRate) || 1.6;
        const cashValues = [105000, 171223, 774885, 2000000, 4000000];
        setData(generateData(rate, cashValues));
        setLoading(false);
        setShowInput(false);
      }, 500);
    } else {
      if (!cash1 || !cash5 || !cash10 || !cash20 || !cash30) {
        Alert.alert('提示', '请输入5个年份的现金价值');
        return;
      }
      
      setLoading(true);
      setTimeout(() => {
        const cashValues = [
          parseInt(cash1) || 0,
          parseInt(cash5) || 0,
          parseInt(cash10) || 0,
          parseInt(cash20) || 0,
          parseInt(cash30) || 0
        ];
        
        if (cashValues.some(v => v <= 0)) {
          Alert.alert('提示', '请输入有效的现金价值数字');
          setLoading(false);
          return;
        }
        
        const rate = parseFloat(dividendRate) || 1.6;
        setData(generateData(rate, cashValues));
        setLoading(false);
        setShowInput(false);
      }, 500);
    }
  };

  const handlePickPdf = async () => {
    Alert.alert('选择方式', '请选择如何获取PDF数据', [
      { 
        text: '拍照识别', 
        onPress: async () => {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) {
            Alert.alert('需要权限', '请允许相机权限');
            return;
          }
          
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
          });
          
          if (!result.canceled && result.assets[0]) {
            setLoading(true);
            Alert.alert('提示', '正在识别，请稍候...');
            
            const ocrResult = await recognizeImageWithBaidu(result.assets[0].uri);
            setLoading(false);
            
            if (ocrResult && ocrResult.words_result) {
              const text = ocrResult.words_result.map((w: any) => w.words).join('\n');
              const values = extractCashValuesFromOCR(text);
              
              if (values) {
                setCash1(values[0].toString());
                setCash5(values[1].toString());
                setCash10(values[2].toString());
                setCash20(values[3].toString());
                setCash30(values[4].toString());
                setInputMode('cash');
                Alert.alert('识别成功', '已自动填充现金价值数据：\n第1年: ' + values[0] + '\n第5年: ' + values[1] + '\n第10年: ' + values[2] + '\n第20年: ' + values[3] + '\n第30年: ' + values[4]);
              } else {
                Alert.alert('识别失败', '未能从图片中提取到有效数据，请手动输入');
              }
            } else {
              Alert.alert('识别失败', '请重试或手动输入');
            }
          }
        }
      },
      { 
        text: '相册选择', 
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
          });
          
          if (!result.canceled && result.assets[0]) {
            setLoading(true);
            Alert.alert('提示', '正在识别，请稍候...');
            
            const ocrResult = await recognizeImageWithBaidu(result.assets[0].uri);
            setLoading(false);
            
            if (ocrResult && ocrResult.words_result) {
              const text = ocrResult.words_result.map((w: any) => w.words).join('\n');
              const values = extractCashValuesFromOCR(text);
              
              if (values) {
                setCash1(values[0].toString());
                setCash5(values[1].toString());
                setCash10(values[2].toString());
                setCash20(values[3].toString());
                setCash30(values[4].toString());
                setInputMode('cash');
                Alert.alert('识别成功', '已自动填充现金价值数据：\n第1年: ' + values[0] + '\n第5年: ' + values[1] + '\n第10年: ' + values[2] + '\n第20年: ' + values[3] + '\n第30年: ' + values[4]);
              } else {
                Alert.alert('识别失败', '未能从图片中提取到有效数据，请手动输入');
              }
            } else {
              Alert.alert('识别失败', '请重试或手动输入');
            }
          }
        }
      },
      { text: '取消', style: 'cancel' }
    ]);
  };

  const adjustDividend = (delta: number) => {
    if (data.length === 0) return;
    
    const newRate = Math.max(0.1, parseFloat(dividendRate) + delta);
    setDividendRate(newRate.toFixed(1));
    
    const cashValues = inputMode === 'params' 
      ? [105000, 171223, 774885, 2000000, 4000000]
      : [
          parseInt(cash1) || 0,
          parseInt(cash5) || 0,
          parseInt(cash10) || 0,
          parseInt(cash20) || 0,
          parseInt(cash30) || 0
        ];
    
    setData(generateData(newRate, cashValues));
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

  const handleViewPdf = async () => {
    Alert.alert(
      'PDF演示',
      '选择演示文档',
      [
        { 
          text: '产品计划书', 
          onPress: () => {
            Alert.alert('提示', 'PDF演示功能开发中...

可以显示产品计划书PDF文件');
          }
        },
        { text: '取消', style: 'cancel' }
      ]
    );
  };

  const handleTutorial = () => {
    Alert.alert(
      '使用教程',
      '本APP用于保险利益演示

' +
      '【快速开始】
' +
      '1. 点击"参数输入"或"精确输入"
' +
      '2. 输入投保信息或现金价值
' +
      '3. 点击"生成测算表"
' +
      '4. 调整分红实现率查看不同 scenarios

' +
      '【拍照识别】(精确输入模式)
' +
      '1. 在精确输入页面点击"📷 拍照识别"
' +
      '2. 选择拍照或从相册选择
' +
      '3. 对准PDF建议书的"主险现价"表格拍照
' +
      '4. 系统自动识别并填充数据

' +
      '【数据来源】
' +
      '从PDF建议书"主险现价"列，抄录以下5个年份的数值：
' +
      '第1年、第5年、第10年、第20年、第30年

' +
      '【导出CSV】
' +
      '计算完成后可导出CSV文件分享给客户

' +
      '【百度OCR】
' +
      '免费额度：1000次/天
' +
      '如需更多识别次数需付费',
      [{ text: '知道了' }]
    );
  };

  const handleExit = () => {
    Alert.alert('退出确认', '确定要退出应用吗？', [
      { text: '取消', style: 'cancel' },
      { text: '退出', style: 'destructive', onPress: () => BackHandler.exitApp() }
    ]);
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
        {data.length > 0 && (
          <Text style={styles.subtitle}>分红实现率 {dividendRate}x</Text>
        )}
      </View>

      {showInput ? (
        <ScrollView style={styles.inputPanel}>
          <View style={styles.tabRow}>
            <TouchableOpacity 
              style={[styles.tab, inputMode === 'params' && styles.tabActive]} 
              onPress={() => setInputMode('params')}
            >
              <Text style={[styles.tabText, inputMode === 'params' && styles.tabTextActive]}>参数输入</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, inputMode === 'cash' && styles.tabActive]} 
              onPress={() => setInputMode('cash')}
            >
              <Text style={[styles.tabText, inputMode === 'cash' && styles.tabTextActive]}>精确输入</Text>
            </TouchableOpacity>
          </View>
          
          {inputMode === 'params' ? (
            <>
              <Text style={styles.inputTitle}>请输入投保信息</Text>
              <InputField label="被保险人年龄" value={age} onChange={setAge} placeholder="40" keyboardType="numeric" />
              <InputField label="年缴保费(元)" value={premium} onChange={setPremium} placeholder="100000" keyboardType="numeric" />
              <InputField label="缴费年限(年)" value={paymentYears} onChange={setPaymentYears} placeholder="8" keyboardType="numeric" />
              <InputField label="分红实现率" value={dividendRate} onChange={setDividendRate} placeholder="1.6" keyboardType="numeric" />
              <Text style={styles.tipText}>* 使用估算公式计算，数据可能有误差</Text>
            </>
          ) : (
            <>
              <Text style={styles.inputTitle}>请从PDF表格抄录现金价值</Text>
              <Text style={styles.tipText}>从PDF建议书的"主险现价"列，抄录以下5个年份的数值：</Text>
              <TouchableOpacity style={styles.btnBlue} onPress={handlePickPdf}>
                <Text style={styles.btnText}>📷 拍照识别</Text>
              </TouchableOpacity>
              <InputField label="第1年" value={cash1} onChange={setCash1} placeholder="例：15000" keyboardType="numeric" />
              <InputField label="第5年" value={cash5} onChange={setCash5} placeholder="例：170000" keyboardType="numeric" />
              <InputField label="第10年" value={cash10} onChange={setCash10} placeholder="例：770000" keyboardType="numeric" />
              <InputField label="第20年" value={cash20} onChange={setCash20} placeholder="例：2000000" keyboardType="numeric" />
              <InputField label="第30年" value={cash30} onChange={setCash30} placeholder="例：4000000" keyboardType="numeric" />
              <InputField label="分红实现率" value={dividendRate} onChange={setDividendRate} placeholder="1.6" keyboardType="numeric" />
              <Text style={styles.tipText}>* 输入真实数据，计算更准确</Text>
            </>
          )}
          
          <TouchableOpacity style={styles.btnOrange} onPress={handleCalculate}>
            <Text style={styles.btnText}>生成测算表</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.btnSmall} onPress={handleReset}>
              <Text style={styles.btnTextSmall}>重置</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSmall} onPress={() => adjustDividend(0.1)}>
              <Text style={styles.btnTextSmall}>+0.1x</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSmall} onPress={() => adjustDividend(-0.1)}>
              <Text style={styles.btnTextSmall}>-0.1x</Text>
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
        <TouchableOpacity style={styles.btnBlue} onPress={handleViewPdf}>
          <Text style={styles.btnText}>PDF演示</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnBlue} onPress={handleTutorial}>
          <Text style={styles.btnText}>使用教程</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnGreen} onPress={exportToCSV}>
          <Text style={styles.btnText}>导出CSV</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnRed} onPress={handleExit}>
          <Text style={styles.btnText}>退出</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>金尊分红司庆版 v4.0</Text>
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
  tabRow: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: '#1a73e8',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: 'bold',
  },
  tabTextActive: {
    color: 'white',
  },
  inputTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  tipText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  inputLabel: {
    width: 90,
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
  btnOrange: {
    backgroundColor: '#FF6B00',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
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
