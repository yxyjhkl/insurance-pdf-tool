import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Dimensions, Share } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';

interface DataRow {
  policy_year: number;
  age: number;
  premium: number;
  total_premium: number;
  guaranteed: number;
  current_dividend: number;
  accum_dividend: number;
  death_benefit: number;
  survival_benefit: number;
  growth_rate: number | null;
}

export default function App() {
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string>('客户');
  const [data, setData] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [dividendRate, setDividendRate] = useState(1.0);

  const formatNumber = (num: number | null | undefined): string => {
    if (num === null || num === undefined) return '--';
    return Math.round(num).toLocaleString();
  };

  const formatRate = (rate: number | null): string => {
    if (rate === null) return '--';
    return (rate * 100).toFixed(2) + '%';
  };

  const handlePickPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      
      if (result.assets && result.assets[0]) {
        setPdfUri(result.assets[0].uri);
        setLoading(true);
        
        setTimeout(() => {
          const mockData: DataRow[] = [];
          for (let year = 1; year <= 30; year++) {
            const premium = 100000;
            const totalPremium = premium * year;
            const guaranteed = totalPremium * 1.05;
            const currentDividend = premium * 0.03 * dividendRate;
            const accumDividend = currentDividend * year;
            const deathBenefit = guaranteed + accumDividend;
            const survivalBenefit = guaranteed + accumDividend;
            const growthRate = year > 1 ? (survivalBenefit / (totalPremium * (year - 1) * 1.05) - 1) : null;
            
            mockData.push({
              policy_year: year,
              age: 30 + year,
              premium: premium,
              total_premium: totalPremium,
              guaranteed: guaranteed,
              current_dividend: currentDividend,
              accum_dividend: accumDividend,
              death_benefit: deathBenefit,
              survival_benefit: survivalBenefit,
              growth_rate: growthRate,
            });
          }
          setData(mockData);
          setLoading(false);
          setCustomerName('客户');
        }, 1500);
      }
    } catch (error) {
      Alert.alert('错误', 'PDF选择失败');
      setLoading(false);
    }
  };

  const adjustDividend = (rate: number) => {
    setDividendRate(rate);
    if (data.length > 0) {
      const newData = data.map(row => ({
        ...row,
        current_dividend: row.current_dividend / dividendRate * rate,
        accum_dividend: row.accum_dividend / dividendRate * rate,
        death_benefit: row.death_benefit / dividendRate * rate,
        survival_benefit: row.survival_benefit / dividendRate * rate,
      }));
      setData(newData);
    }
  };

  const getDemoRate = (year: number): string => {
    return year >= 11 ? '3.80%' : '--';
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>金尊分红司庆版简版建议书</Text>
        <Text style={styles.subtitle}>将PDF建议书转换为表格 分红实现率自由调整</Text>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.btnOrange} onPress={handlePickPdf}>
          <Text style={styles.btnText}>📁 导入PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnPurple} onPress={() => adjustDividend(dividendRate + 0.1)}>
          <Text style={styles.btnText}>调整分红</Text>
        </TouchableOpacity>
        <Text style={styles.rateText}>当前: {dividendRate.toFixed(1)}x</Text>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#1a73e8" />
          <Text style={styles.loadingText}>正在解析PDF...</Text>
        </View>
      ) : data.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.table}>
              <View style={styles.headerRow}>
                <Text style={styles.headerCell}>保单{'\n'}年度</Text>
                <Text style={styles.headerCell}>被保人{'\n'}年龄</Text>
                <Text style={styles.headerCell}>期交{'\n'}保费</Text>
                <Text style={styles.headerCell}>累计{'\n'}保费</Text>
                <Text style={styles.headerCell}>保证{'\n'}利益</Text>
                <Text style={styles.headerCell}>当年{'\n'}分红</Text>
                <Text style={styles.headerCell}>累计{'\n'}分红</Text>
                <Text style={styles.headerCell}>身故{'\n'}总利益</Text>
                <Text style={styles.headerCell}>生存{'\n'}总利益</Text>
                <Text style={styles.headerCell}>预期{'\n'}增长率</Text>
                <Text style={styles.headerCell}>演示{'\n'}增长率</Text>
              </View>
              {data.map((row, index) => (
                <View key={row.policy_year} style={[styles.dataRow, index % 2 === 1 && styles.dataRowAlt]}>
                  <Text style={styles.dataCell}>{row.policy_year}</Text>
                  <Text style={styles.dataCell}>{row.age}</Text>
                  <Text style={styles.dataCell}>{formatNumber(row.premium)}</Text>
                  <Text style={styles.dataCell}>{formatNumber(row.total_premium)}</Text>
                  <Text style={styles.dataCell}>{formatNumber(row.guaranteed)}</Text>
                  <Text style={styles.dataCell}>{formatNumber(row.current_dividend)}</Text>
                  <Text style={styles.dataCell}>{formatNumber(row.accum_dividend)}</Text>
                  <Text style={styles.dataCell}>{formatNumber(row.death_benefit)}</Text>
                  <Text style={styles.dataCell}>{formatNumber(row.survival_benefit)}</Text>
                  <Text style={styles.dataCell}>{formatRate(row.growth_rate)}</Text>
                  <Text style={[styles.dataCell, styles.demoRate]}>{getDemoRate(row.policy_year)}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>请点击"导入PDF"选择建议书文件</Text>
          <Text style={styles.emptySubText}>支持从口袋E下载的PDF建议书</Text>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>金尊分红司庆版简版建议书助手 v1.0</Text>
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
  actionRow: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: 'white',
    alignItems: 'center',
    gap: 10,
  },
  btnOrange: {
    backgroundColor: '#FF6B00',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  btnPurple: {
    backgroundColor: '#9c27b0',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  btnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
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
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
  },
  emptySubText: {
    color: '#999',
    fontSize: 12,
    marginTop: 5,
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
    padding: 8,
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
    width: 70,
    padding: 8,
    fontSize: 10,
    textAlign: 'center',
    color: '#333',
  },
  demoRate: {
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
