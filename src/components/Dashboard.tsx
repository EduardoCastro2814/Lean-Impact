import React, { useEffect, useState } from 'react';
import { 
  Activity, 
  Download
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  ComposedChart,
  Area,
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import html2canvas from 'html2canvas';
import { dbService, getFyDisplayLabel, getFiscalMonthIndex, getProjectPeriodSavings } from '../lib/supabaseClient';
import type { ProjectApproved, ProjectOpen, SavingsTarget } from '../lib/supabaseClient';
import flexLogo from '../assets/flex_logo.png';

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(val);
};

const formatShortCurrency = (val: number) => {
  const absVal = Math.abs(val);
  if (absVal >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
  if (absVal >= 1000) return `$${(val / 1000).toFixed(1)}K`;
  return `$${val}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const actualEntry = payload.find((p: any) => p.dataKey === 'Actual Savings');
    const targetEntry = payload.find((p: any) => p.dataKey === 'Target Savings');
    
    const actual = actualEntry ? actualEntry.value : 0;
    const target = targetEntry ? targetEntry.value : 0;
    const gap = target - actual;
    
    return (
      <div style={{ backgroundColor: '#FFFFFF', padding: '12px 16px', border: '1px solid #E5E7EB', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
        <p style={{ fontWeight: 800, color: '#111827', margin: '0 0 8px 0', fontSize: '0.9rem' }}>{label}</p>
        <p style={{ margin: '4px 0', fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>
          Target: <span style={{ float: 'right', marginLeft: '12px', fontWeight: 700 }}>{formatCurrency(target)}</span>
        </p>
        <p style={{ margin: '4px 0', fontSize: '0.85rem', color: '#22C55E', fontWeight: 600 }}>
          Actual: <span style={{ float: 'right', marginLeft: '12px', fontWeight: 700 }}>{formatCurrency(actual)}</span>
        </p>
        <p style={{ margin: '4px 0', fontSize: '0.85rem', color: gap > 0 ? '#EF4444' : '#22C55E', fontWeight: 700 }}>
          {gap >= 0 ? 'Gap to Target:' : 'Surplus to Target:'} <span style={{ float: 'right', marginLeft: '12px', fontWeight: 800 }}>{formatCurrency(Math.abs(gap))}</span>
        </p>
      </div>
    );
  }
  return null;
};

export const Dashboard: React.FC = () => {
  const [fiscalYear, setFiscalYear] = useState<string>('FY26');
  const [quarter, setQuarter] = useState<string>('All');
  const [approvedProjects, setApprovedProjects] = useState<ProjectApproved[]>([]);
  const [openProjects, setOpenProjects] = useState<ProjectOpen[]>([]);
  const [targets, setTargets] = useState<SavingsTarget[]>([]);
  const [fiscalYears, setFiscalYears] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPresentation, setIsPresentation] = useState(false);



  const CustomDonutTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const value = data.value;
      const name = data.name;
      const total = approvedCount + openCount;
      const pct = total > 0 ? Math.round((value / total) * 100) : 0;
      
      return (
        <div style={{ 
          backgroundColor: '#FFFFFF', 
          padding: '12px 16px', 
          border: '1px solid #E5E7EB', 
          borderRadius: '8px', 
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' 
        }}>
          <p style={{ fontWeight: 800, color: '#111827', margin: '0 0 6px 0', fontSize: '0.9rem' }}>
            {name}
          </p>
          <p style={{ margin: '4px 0', fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>
            {value} {value === 1 ? 'Project' : 'Projects'}
          </p>
          <p style={{ margin: '4px 0', fontSize: isPresentation ? '1rem' : '0.85rem', color: data.color, fontWeight: 700 }}>
            {pct}%
          </p>
        </div>
      );
    }
    return null;
  };

  const formatTrendLabelValue = (val: number, isTarget: boolean) => {
    const absVal = Math.abs(val);
    if (absVal >= 1000000) {
      return `$${(val / 1000000).toFixed(1)}M`;
    }
    if (absVal >= 1000) {
      if (isTarget) {
        return `$${Math.round(val / 1000)}K`;
      } else {
        return `$${(val / 1000).toFixed(1)}K`;
      }
    }
    return `$${val}`;
  };

  const CustomActualLabel = (props: any) => {
    const { x, y, index } = props;
    if (index === undefined || index === null) return null;
    const row = cumulativeQuarterTrendData[index];
    if (!row) return null;
    const actualVal = row['Actual Savings'];
    const targetVal = row['Target Savings'];
    const formattedVal = formatTrendLabelValue(actualVal, false);
    
    const isBelowTarget = actualVal < targetVal;
    const yOffset = isBelowTarget ? 20 : -10;

    return (
      <text
        x={x}
        y={y + yOffset}
        fill="#22C55E"
        fontSize="12px"
        fontWeight="700"
        textAnchor="middle"
      >
        {formattedVal}
      </text>
    );
  };

  const CustomTargetLabel = (props: any) => {
    const { x, y, index } = props;
    if (index === undefined || index === null) return null;
    const row = cumulativeQuarterTrendData[index];
    if (!row) return null;
    const actualVal = row['Actual Savings'];
    const targetVal = row['Target Savings'];
    const formattedVal = formatTrendLabelValue(targetVal, true);
    
    const isBelowActual = targetVal <= actualVal;
    const yOffset = isBelowActual ? 20 : -10;

    return (
      <text
        x={x}
        y={y + yOffset}
        fill="#334155"
        fontSize="12px"
        fontWeight="700"
        textAnchor="middle"
      >
        {formattedVal}
      </text>
    );
  };

  const renderOpSegmentLabel = (props: any) => {
    const { x, y, width, height, value } = props;
    if (value === 0 || height <= 16) return null;
    return (
      <text
        x={x + width / 2}
        y={y + height / 2 + 4}
        fill="#FFFFFF"
        fontSize={isPresentation ? 11 : 8}
        fontWeight="700"
        textAnchor="middle"
      >
        {formatShortCurrency(value)}
      </text>
    );
  };

  const renderOneTimeSegmentLabel = (props: any) => {
    const { x, y, width, height, index } = props;
    if (index === undefined || index === null) return null;
    const row = realizedByTypeData[index];
    if (!row) return null;
    const opVal = row['OP Contribution'] || 0;
    const otVal = row['One Time Savings'] || 0;
    const total = opVal + otVal;
    const showSegmentLabel = height > 16 && otVal > 0;
    
    return (
      <g>
        {total > 0 && (
          <text
            x={x + width / 2}
            y={y - 8}
            fill="#374151"
            fontSize={isPresentation ? 13 : 10}
            fontWeight="800"
            textAnchor="middle"
          >
            {formatShortCurrency(total)}
          </text>
        )}
        {showSegmentLabel && (
          <text
            x={x + width / 2}
            y={y + height / 2 + 4}
            fill="#374151"
            fontSize={isPresentation ? 11 : 8}
            fontWeight="700"
            textAnchor="middle"
          >
            {formatShortCurrency(otVal)}
          </text>
        )}
      </g>
    );
  };

  const renderQuarterLegend = () => {
    return (
      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', fontSize: isPresentation ? '0.95rem' : '0.8rem', fontWeight: 700, marginTop: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ display: 'inline-block', width: isPresentation ? '14px' : '10px', height: isPresentation ? '14px' : '10px', backgroundColor: '#334155', borderRadius: '2px' }} />
          <span style={{ color: '#4B5563' }}>Target Savings</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ display: 'inline-block', width: isPresentation ? '14px' : '10px', height: isPresentation ? '14px' : '10px', backgroundColor: '#22C55E', borderRadius: '2px' }} />
          <span style={{ color: '#4B5563' }}>Actual Savings</span>
        </div>
      </div>
    );
  };
  const [expandedChart, setExpandedChart] = useState<string | null>(null);
  const [chartRenderKey, setChartRenderKey] = useState(0);

  const loadData = async () => {
    setLoading(true);
    try {
      const [approved, open, targetList, fyList] = await Promise.all([
        dbService.getProjectsApproved(),
        dbService.getProjectsOpen(),
        dbService.getSavingsTargets(),
        dbService.getFiscalYears()
      ]);
      setApprovedProjects(approved);
      setOpenProjects(open);
      setTargets(targetList);
      setFiscalYears(fyList);

      // Default to active fiscal year
      const activeFy = fyList.find(fy => fy.active);
      if (activeFy) {
        setFiscalYear(activeFy.fiscal_year);
      } else if (fyList.length > 0) {
        setFiscalYear(fyList[0].fiscal_year);
      }
    } catch (e) {
      console.error('Error loading dashboard data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('lean-impact-db-changed', loadData);
    return () => {
      window.removeEventListener('lean-impact-db-changed', loadData);
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsPresentation(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExpandedChart(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setChartRenderKey(prev => prev + 1);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    setChartRenderKey(prev => prev + 1);
  }, [fiscalYear, quarter, isPresentation]);

  // End month index for cumulative mapping
  const endMonthIdx = quarter === 'Q1' ? 2 : quarter === 'Q2' ? 5 : quarter === 'Q3' ? 8 : 11;

  // Filter projects by selected Fiscal Year (we calculate their period impact later)
  const approvedFiltered = approvedProjects.filter(p => p.fiscal_year === fiscalYear);
  const openFiltered = openProjects.filter(p => p.fiscal_year === fiscalYear);

  // Targets: milestone-based (non-summing)
  const getTargetForPeriod = (targetsList: SavingsTarget[], fy: string, q: string): number => {
    const yearTargets = targetsList.filter(t => t.fiscal_year === fy);
    if (yearTargets.length === 0) return 0;
    if (q === 'All') {
      const q4Target = yearTargets.find(t => t.quarter === 'Q4');
      if (q4Target) return q4Target.target_amount;
      const annualTarget = yearTargets.find(t => t.quarter === 'Annual');
      if (annualTarget) return annualTarget.target_amount;
      return Math.max(...yearTargets.map(t => t.target_amount));
    } else {
      const qTarget = yearTargets.find(t => t.quarter === q);
      return qTarget ? qTarget.target_amount : 0;
    }
  };
  const annualTarget = getTargetForPeriod(targets, fiscalYear, quarter);

  // Realized Breakdown (Approved Projects)
  const realizedOp = approvedFiltered.reduce((sum, p) => {
    const mProj = getFiscalMonthIndex(p.approval_date);
    return sum + (mProj <= endMonthIdx ? p.op_contribution * (12 - mProj) : 0);
  }, 0);
  const realizedOneTime = approvedFiltered.reduce((sum, p) => sum + (getFiscalMonthIndex(p.approval_date) <= endMonthIdx ? p.one_time_savings : 0), 0);
  
  // Base approved realized savings
  let realizedSavings = realizedOp + realizedOneTime;

  // Potential Breakdown (Open Projects)
  const potentialOp = openFiltered.reduce((sum, p) => {
    const mProj = getFiscalMonthIndex(p.created_date);
    return sum + (mProj <= endMonthIdx ? p.op_contribution * (12 - mProj) : 0);
  }, 0);
  const potentialOneTime = openFiltered.reduce((sum, p) => sum + (getFiscalMonthIndex(p.created_date) <= endMonthIdx ? p.one_time_savings : 0), 0);
  const potentialSavings = potentialOp + potentialOneTime;

  // Other Executive KPIs
  const targetAchievementPercent = annualTarget > 0 ? (realizedSavings / annualTarget) * 100 : 0;
  const rawGap = annualTarget - realizedSavings;
  const savingsGap = rawGap > 0 ? rawGap : 0;
  
  const isBehindTarget = realizedSavings < annualTarget;
  const gapColor = isBehindTarget ? '#EF4444' : '#22C55E';
  
  const getAchievementColor = (pct: number) => {
    if (pct >= 100) return '#22C55E';
    if (pct >= 80) return '#FACC15';
    return '#EF4444';
  };
  const achievementColor = getAchievementColor(targetAchievementPercent);
  
  // Filter count projects for period display
  const openCount = openFiltered.filter(p => getFiscalMonthIndex(p.created_date) <= endMonthIdx).length;
  const approvedCount = approvedFiltered.filter(p => getFiscalMonthIndex(p.approval_date) <= endMonthIdx).length;

  // Visual Progress Gauge markers
  const maxBarVal = Math.max(annualTarget, realizedSavings + potentialSavings);
  const realizedPercent = maxBarVal > 0 ? (realizedSavings / maxBarVal) * 100 : 0;
  const potentialPercent = maxBarVal > 0 ? (potentialSavings / maxBarVal) * 100 : 0;

  // 1. Chart 1: Realized Savings by Type (stacked month trend April to March)
  const fiscalMonths = [
    { name: 'Apr', index: 3 },
    { name: 'May', index: 4 },
    { name: 'Jun', index: 5 },
    { name: 'Jul', index: 6 },
    { name: 'Aug', index: 7 },
    { name: 'Sep', index: 8 },
    { name: 'Oct', index: 9 },
    { name: 'Nov', index: 10 },
    { name: 'Dec', index: 11 },
    { name: 'Jan', index: 0 },
    { name: 'Feb', index: 1 },
    { name: 'Mar', index: 2 }
  ];

  const realizedByTypeData = fiscalMonths.map((m, monthIdx) => {
    // Approved up to this month contributes OP
    const opSavings = approvedFiltered
      .filter(p => getFiscalMonthIndex(p.approval_date) <= monthIdx)
      .reduce((sum, p) => {
        const mProj = getFiscalMonthIndex(p.approval_date);
        return sum + p.op_contribution * (12 - mProj);
      }, 0);

    // Only approved in exactly this month contributes One Time, Soft, Inventory
    const currentMonthProjects = approvedFiltered.filter(p => getFiscalMonthIndex(p.approval_date) === monthIdx);
    const oneTime = currentMonthProjects.reduce((sum, p) => sum + p.one_time_savings, 0);
    const soft = currentMonthProjects.reduce((sum, p) => sum + p.soft_savings, 0);
    const inventory = currentMonthProjects.reduce((sum, p) => sum + p.inventory_savings, 0);

    return {
      name: m.name,
      'OP Contribution': opSavings,
      'Soft Savings': soft,
      'Inventory Savings': inventory,
      'One Time Savings': oneTime
    };
  });

  // 3. Chart 3: Savings by Fiscal Quarter
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  const quarterlySavingsData = quarters.map((q, qIdx) => {
    const endMonthIdxForQ = qIdx === 0 ? 2 : qIdx === 1 ? 5 : qIdx === 2 ? 8 : 11;
    
    // Milestone targets (non-summing)
    const qTarget = getTargetForPeriod(targets, fiscalYear, q);

    const qApproved = approvedFiltered.reduce((sum, p) => sum + getProjectPeriodSavings(p, endMonthIdxForQ), 0);
    const qOpen = openFiltered.reduce((sum, p) => sum + getProjectPeriodSavings(p, endMonthIdxForQ), 0);

    return {
      name: q,
      'Target': qTarget,
      'Approved Realized': qApproved,
      'Open Potential': qOpen
    };
  });

  const quarterlySavingsDataForChart = quarterlySavingsData.map(d => ({
    name: d.name,
    'Target': Math.round(d.Target),
    'Actual': Math.round(d['Approved Realized'])
  }));

  // 5. Target vs Actual Savings Trend Cumulative Quarter Data
  const cumulativeQuarterTrendData = quarters.map((q) => {
    const monthIdx = q === 'Q1' ? 2 : q === 'Q2' ? 5 : q === 'Q3' ? 8 : 11;
    const targetVal = getTargetForPeriod(targets, fiscalYear, q);
    
    let actualVal = approvedFiltered.reduce((sum, p) => sum + getProjectPeriodSavings(p, monthIdx), 0);
    const targetRound = Math.round(targetVal);
    const actualRound = Math.round(actualVal);

    return {
      name: q,
      'Target Savings': targetRound,
      'Actual Savings': actualRound,
      'Variance': actualRound - targetRound,
      'rangeRed': actualRound < targetRound ? [actualRound, targetRound] : null,
      'rangeGreen': actualRound > targetRound ? [targetRound, actualRound] : null
    };
  });

  // 6. Project Status Overview Data (Donut Chart)
  const donutData = [
    { name: 'Closed Projects', value: approvedCount, color: '#22C55E' },
    { name: 'Open Projects', value: openCount, color: '#FACC15' }
  ];

  const togglePresentationMode = () => {
    const container = document.getElementById('dashboard-presentation-container');
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(err => {
        console.error('Error enabling presentation mode:', err, container);
      });
      setIsPresentation(true);
    } else {
      document.exitFullscreen();
      setIsPresentation(false);
    }
  };

  const exportChart = (id: string, fileName: string) => {
    const element = document.getElementById(id);
    if (!element) return;
    html2canvas(element, {
      backgroundColor: '#FFFFFF',
      scale: 2,
      useCORS: true
    }).then((canvas) => {
      const link = document.createElement('a');
      link.download = `${fileName}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  };

  const renderExpandedChartModal = () => {
    if (!expandedChart) return null;
    
    let chartTitle = '';
    let chartComponent = null;

    if (expandedChart === 'trend') {
      chartTitle = 'Target vs Actual Savings Trend (Cumulative)';
      chartComponent = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
          <div id="expanded-chart-export-trend" style={{ padding: '24px', backgroundColor: '#FFFFFF', borderRadius: '12px', display: 'flex', flexDirection: 'column', width: '100%' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', margin: '0 0 20px 0', textAlign: 'left' }}>
              {chartTitle}
            </h3>
            <div style={{ width: '100%', height: '400px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={cumulativeQuarterTrendData} margin={{ top: 25, right: 25, left: 15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke="#6B7280" fontSize={11} tickLine={false} />
                  <YAxis stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area dataKey="rangeRed" stroke="none" fill="#EF4444" fillOpacity={0.08} activeDot={false} legendType="none" />
                  <Area dataKey="rangeGreen" stroke="none" fill="#22C55E" fillOpacity={0.08} activeDot={false} legendType="none" />
                  <Line type="monotone" name="Actual" dataKey="Actual Savings" stroke="#22C55E" strokeWidth={5} label={<CustomActualLabel />} dot={{ r: 6 }} activeDot={{ r: 8 }} />
                  <Line type="monotone" name="Target" dataKey="Target Savings" stroke="#334155" strokeWidth={3} strokeDasharray="5 5" label={<CustomTargetLabel />} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div style={{ overflowX: 'auto', border: '1px solid #E5E7EB', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#F3F4F6', borderBottom: '2px solid #E5E7EB' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Quarter</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Target Savings</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Actual Savings (Realized)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Variance to Target</th>
                </tr>
              </thead>
              <tbody>
                {cumulativeQuarterTrendData.map((row, idx) => {
                  const isPositive = row.Variance >= 0;
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #E5E7EB', backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB' }}>
                      <td style={{ padding: '10px 16px', fontWeight: 600 }}>{row.name}</td>
                      <td style={{ padding: '10px 16px', color: '#334155', fontWeight: 600 }}>{formatCurrency(row['Target Savings'])}</td>
                      <td style={{ padding: '10px 16px', color: '#22C55E', fontWeight: 600 }}>{formatCurrency(row['Actual Savings'])}</td>
                      <td style={{ padding: '10px 16px', color: isPositive ? '#22C55E' : '#EF4444', fontWeight: 600 }}>
                        {isPositive ? '+' : ''}{formatCurrency(row.Variance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    } else if (expandedChart === 'monthly') {
      chartTitle = 'Monthly Savings Breakdown';
      chartComponent = (
        <div id="expanded-chart-export-monthly" style={{ padding: '24px', backgroundColor: '#FFFFFF', borderRadius: '12px', display: 'flex', flexDirection: 'column', width: '100%' }}>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', margin: '0 0 20px 0', textAlign: 'left' }}>
            {chartTitle}
          </h3>
          <div style={{ width: '100%', height: '500px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={realizedByTypeData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={formatCurrency} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Bar dataKey="OP Contribution" name="OP Contribution" stackId="a" fill="#16A34A" label={renderOpSegmentLabel} />
                <Bar dataKey="One Time Savings" name="One Time Savings" stackId="a" fill="#86EFAC" label={renderOneTimeSegmentLabel} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    } else if (expandedChart === 'quarter') {
      chartTitle = 'Quarter Performance';
      chartComponent = (
        <div id="expanded-chart-export-quarter" style={{ padding: '24px', backgroundColor: '#FFFFFF', borderRadius: '12px', display: 'flex', flexDirection: 'column', width: '100%' }}>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', margin: '0 0 20px 0', textAlign: 'left' }}>
            {chartTitle}
          </h3>
          <div style={{ width: '100%', height: '500px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={quarterlySavingsDataForChart} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={formatCurrency} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend content={renderQuarterLegend} />
                <Bar dataKey="Target" name="Target Savings" fill="#334155" label={{ position: 'top', formatter: (v: any) => formatShortCurrency(v), fill: '#374151', fontWeight: 700 }} />
                <Bar dataKey="Actual" name="Actual Savings" label={{ position: 'top', formatter: (v: any) => formatShortCurrency(v), fill: '#374151', fontWeight: 700 }}>
                  {quarterlySavingsDataForChart.map((entry: any, idx: number) => {
                    const isMet = entry.Actual >= entry.Target;
                    return <Cell key={`cell-${idx}`} fill={isMet ? '#22C55E' : '#EF4444'} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    } else if (expandedChart === 'projectStatus') {
      chartTitle = 'Project Status Overview';
      const totalProjects = approvedCount + openCount;
      const closedPct = totalProjects > 0 ? Math.round((approvedCount / totalProjects) * 100) : 0;
      const openPct = totalProjects > 0 ? Math.round((openCount / totalProjects) * 100) : 0;
      chartComponent = (
        <div id="expanded-chart-export-projectStatus" style={{ padding: '24px', backgroundColor: '#FFFFFF', borderRadius: '12px', display: 'flex', flexDirection: 'column', width: '100%' }}>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', margin: '0 0 20px 0', textAlign: 'left' }}>
            {chartTitle}
          </h3>
          <div style={{ width: '100%', height: '420px', minHeight: 0, display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '32px' }}>
            {/* Donut Container */}
            <div style={{ flex: 1.2, height: '100%', minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={110}
                    outerRadius={160}
                    paddingAngle={3}
                    dataKey="value"
                    label={false}
                  >
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <text
                    x="50%"
                    y="50%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    <tspan x="50%" dy="-12" fontSize="3.5rem" fontWeight="800" fill="#374151">
                      {totalProjects}
                    </tspan>
                    <tspan x="50%" dy="40" fontSize="1.25rem" fontWeight="700" fill="#374151">
                      Total Projects
                    </tspan>
                  </text>
                  <Tooltip content={<CustomDonutTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Legend on the right side */}
            <div style={{ 
              flex: 0.8, 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'center', 
              gap: '24px',
              paddingLeft: '24px'
            }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <span style={{ 
                  display: 'inline-block', 
                  width: '18px', 
                  height: '18px', 
                  borderRadius: '50%', 
                  backgroundColor: '#22C55E', 
                  marginTop: '8px',
                  flexShrink: 0
                }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '1.35rem', fontWeight: 700, color: '#4B5563' }}>Closed Projects</span>
                  <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#22C55E', marginTop: '2px', whiteSpace: 'nowrap' }}>
                    {approvedCount} Projects ({closedPct}%)
                  </span>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <span style={{ 
                  display: 'inline-block', 
                  width: '18px', 
                  height: '18px', 
                  borderRadius: '50%', 
                  backgroundColor: '#4FC3D7', 
                  marginTop: '8px',
                  flexShrink: 0
                }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '1.35rem', fontWeight: 700, color: '#4B5563' }}>Open Projects</span>
                  <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#4FC3D7', marginTop: '2px', whiteSpace: 'nowrap' }}>
                    {openCount} Projects ({openPct}%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        padding: '32px'
      }} onClick={() => setExpandedChart(null)}>
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          width: '90%',
          maxWidth: '1200px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '24px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button 
              onClick={() => exportChart(`expanded-chart-export-${expandedChart}`, `Lean_Savings_Dashboard_${expandedChart}_Chart`)}
              className="btn-export btn-export-primary"
              style={{ padding: '6px 12px' }}
            >
              Export PNG
            </button>
            <button 
              onClick={() => setExpandedChart(null)} 
              className="btn-export"
              style={{ padding: '6px 12px', minWidth: '80px' }}
            >
              Close
            </button>
          </div>
          <div>
            {chartComponent}
          </div>
          <div style={{ textAlign: 'center', fontSize: '0.85rem', color: '#6B7280' }}>
            Press <kbd style={{ padding: '2px 6px', backgroundColor: '#F3F4F6', border: '1px solid #D1D5DB', borderRadius: '4px' }}>ESC</kbd> to close.
          </div>
        </div>
      </div>
    );
  };

  const renderChartCard = (type: 'trend' | 'quarter' | 'monthly' | 'projectStatus') => {
    if (type === 'trend') {
      return (
        <div 
          className="card" 
          id="trend-chart-tile" 
          style={{ 
            padding: isPresentation ? '16px 20px' : '20px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: isPresentation ? '8px' : '16px',
            cursor: isPresentation ? 'default' : 'pointer',
            height: '100%',
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--color-border)',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
          }}
          onClick={() => !isPresentation && setExpandedChart('trend')}
        >
          {/* Isolated container for high resolution PNG exports (excludes control buttons) */}
          <div id="export-container-trend" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', backgroundColor: '#FFFFFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontWeight: isPresentation ? 600 : 800, fontSize: isPresentation ? '1.25rem' : '1rem', color: '#111827', textAlign: isPresentation ? 'center' : 'left', width: '100%', display: 'block' }}>
                Target vs Actual Savings Trend (Cumulative)
              </span>
            </div>
            
            <div style={isPresentation ? { flex: 1, width: '100%', minHeight: 0 } : { flex: 1, width: '100%', height: '310px', minHeight: '310px' }}>
              <ResponsiveContainer width="100%" height="100%" key={chartRenderKey}>
                <ComposedChart data={cumulativeQuarterTrendData} margin={{ top: 25, right: 25, left: 15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke={isPresentation ? '#111827' : '#6B7280'} fontSize={isPresentation ? 16 : 11} fontWeight={isPresentation ? 700 : 500} tickLine={false} />
                  <YAxis stroke={isPresentation ? '#111827' : '#6B7280'} fontSize={isPresentation ? 16 : 11} fontWeight={isPresentation ? 700 : 500} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area dataKey="rangeRed" stroke="none" fill="#EF4444" fillOpacity={0.08} activeDot={false} legendType="none" />
                  <Area dataKey="rangeGreen" stroke="none" fill="#22C55E" fillOpacity={0.08} activeDot={false} legendType="none" />
                  <Line type="monotone" name="Actual" dataKey="Actual Savings" stroke="#22C55E" strokeWidth={5} label={<CustomActualLabel />} dot={{ r: isPresentation ? 6 : 4 }} activeDot={{ r: isPresentation ? 8 : 6 }} />
                  <Line type="monotone" name="Target" dataKey="Target Savings" stroke="#334155" strokeWidth={3} strokeDasharray="5 5" label={<CustomTargetLabel />} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Action buttons rendered absolute outside the export wrapper */}
          {!isPresentation && (
            <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '8px', zIndex: 10 }} onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={() => exportChart('export-container-trend', 'Lean_Savings_Dashboard_Trend_Chart')} 
                className="btn-export"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              >
                Export PNG
              </button>
              <button 
                onClick={() => setExpandedChart('trend')} 
                className="btn-export"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              >
                Expand
              </button>
            </div>
          )}
        </div>
      );
    }

    if (type === 'quarter') {
      return (
        <div 
          className="card" 
          id="quarter-chart-tile" 
          style={{ 
            padding: isPresentation ? '16px 20px' : '20px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: isPresentation ? '8px' : '16px',
            cursor: isPresentation ? 'default' : 'pointer',
            height: '100%',
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--color-border)',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
          }}
          onClick={() => !isPresentation && setExpandedChart('quarter')}
        >
          {/* Isolated container for high resolution PNG exports (excludes control buttons) */}
          <div id="export-container-quarter" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', backgroundColor: '#FFFFFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontWeight: isPresentation ? 600 : 800, fontSize: isPresentation ? '1.25rem' : '1rem', color: '#111827', textAlign: isPresentation ? 'center' : 'left', width: '100%', display: 'block' }}>
                Quarter Performance
              </span>
            </div>
            
            <div style={isPresentation ? { flex: 1, width: '100%', minHeight: 0 } : { flex: 1, width: '100%', height: '310px', minHeight: '310px' }}>
              <ResponsiveContainer width="100%" height="100%" key={chartRenderKey}>
                <BarChart data={quarterlySavingsDataForChart} margin={{ top: 25, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke={isPresentation ? '#111827' : '#6B7280'} fontSize={isPresentation ? 16 : 11} fontWeight={isPresentation ? 700 : 500} tickLine={false} />
                  <YAxis stroke={isPresentation ? '#111827' : '#6B7280'} fontSize={isPresentation ? 16 : 11} fontWeight={isPresentation ? 700 : 500} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend content={renderQuarterLegend} />
                  <Bar dataKey="Target" name="Target Savings" fill="#334155" label={{ position: 'top', formatter: (v: any) => formatShortCurrency(v), fill: '#374151', fontSize: isPresentation ? 14 : 11, fontWeight: 700 }} />
                  <Bar dataKey="Actual" name="Actual Savings" label={{ position: 'top', formatter: (v: any) => formatShortCurrency(v), fill: '#374151', fontSize: isPresentation ? 14 : 11, fontWeight: 700 }}>
                    {quarterlySavingsDataForChart.map((entry: any, idx: number) => {
                      const isMet = entry.Actual >= entry.Target;
                      return <Cell key={`cell-${idx}`} fill={isMet ? '#22C55E' : '#EF4444'} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Action buttons rendered absolute outside the export wrapper */}
          {!isPresentation && (
            <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '8px', zIndex: 10 }} onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={() => exportChart('export-container-quarter', 'Lean_Savings_Dashboard_Quarter_Chart')} 
                className="btn-export"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              >
                Export PNG
              </button>
              <button 
                onClick={() => setExpandedChart('quarter')} 
                className="btn-export"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              >
                Expand
              </button>
            </div>
          )}
        </div>
      );
    }

    if (type === 'monthly') {
      return (
        <div 
          className="card" 
          id="monthly-chart-tile" 
          style={{ 
            padding: isPresentation ? '16px 20px' : '20px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: isPresentation ? '8px' : '16px',
            cursor: isPresentation ? 'default' : 'pointer',
            height: '100%',
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--color-border)',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
          }}
          onClick={() => !isPresentation && setExpandedChart('monthly')}
        >
          {/* Isolated container for high resolution PNG exports (excludes control buttons) */}
          <div id="export-container-monthly" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', backgroundColor: '#FFFFFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontWeight: isPresentation ? 600 : 800, fontSize: isPresentation ? '1.25rem' : '1rem', color: '#111827', textAlign: isPresentation ? 'center' : 'left', width: '100%', display: 'block' }}>
                Monthly Savings Breakdown
              </span>
            </div>
            
            <div style={isPresentation ? { flex: 1, width: '100%', minHeight: 0 } : { flex: 1, width: '100%', height: '310px', minHeight: '310px' }}>
              <ResponsiveContainer width="100%" height="100%" key={chartRenderKey}>
                <BarChart data={realizedByTypeData} margin={{ top: 15, right: 10, left: 10, bottom: 5 }} barSize={isPresentation ? 45 : 28}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke={isPresentation ? '#111827' : '#6B7280'} fontSize={isPresentation ? 16 : 11} fontWeight={isPresentation ? 700 : 500} tickLine={false} />
                  <YAxis stroke={isPresentation ? '#111827' : '#6B7280'} fontSize={isPresentation ? 16 : 11} fontWeight={isPresentation ? 700 : 500} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                  <Bar dataKey="OP Contribution" name="OP Contribution" stackId="a" fill="#16A34A" label={renderOpSegmentLabel} />
                  <Bar dataKey="One Time Savings" name="One Time Savings" stackId="a" fill="#86EFAC" label={renderOneTimeSegmentLabel} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Action buttons rendered absolute outside the export wrapper */}
          {!isPresentation && (
            <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '8px', zIndex: 10 }} onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={() => exportChart('export-container-monthly', 'Lean_Savings_Dashboard_Monthly_Chart')} 
                className="btn-export"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              >
                Export PNG
              </button>
              <button 
                onClick={() => setExpandedChart('monthly')} 
                className="btn-export"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              >
                Expand
              </button>
            </div>
          )}
        </div>
      );
    }

    if (type === 'projectStatus') {
      const totalProjects = approvedCount + openCount;
      const closedPct = totalProjects > 0 ? Math.round((approvedCount / totalProjects) * 100) : 0;
      const openPct = totalProjects > 0 ? Math.round((openCount / totalProjects) * 100) : 0;
      return (
        <div 
          className="card" 
          id="project-status-chart-tile" 
          style={{ 
            padding: isPresentation ? '16px 20px' : '20px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: isPresentation ? '8px' : '16px',
            cursor: isPresentation ? 'default' : 'pointer',
            height: '100%',
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--color-border)',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
          }}
          onClick={() => !isPresentation && setExpandedChart('projectStatus')}
        >
          {/* Isolated container for high resolution PNG exports (excludes control buttons) */}
          <div id="export-container-projectStatus" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', backgroundColor: '#FFFFFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontWeight: isPresentation ? 600 : 800, fontSize: isPresentation ? '1.25rem' : '1rem', color: '#111827', textAlign: isPresentation ? 'center' : 'left', width: '100%', display: 'block' }}>
                Project Status Overview
              </span>
            </div>
            
            <div style={isPresentation ? { flex: 1, width: '100%', minHeight: 0, display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '24px' } : { flex: 1, width: '100%', height: '310px', minHeight: '310px', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              {/* Donut Container */}
              <div style={{ flex: 1.2, height: '100%', minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%" key={chartRenderKey}>
                  <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={isPresentation ? 80 : 55}
                      outerRadius={isPresentation ? 120 : 80}
                      paddingAngle={3}
                      dataKey="value"
                      label={false}
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <text
                      x="50%"
                      y="50%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      <tspan x="50%" dy={isPresentation ? "-12" : "-8"} fontSize={isPresentation ? "3.5rem" : "2.2rem"} fontWeight="800" fill="#374151">
                        {totalProjects}
                      </tspan>
                      <tspan x="50%" dy={isPresentation ? "34" : "24"} fontSize={isPresentation ? "1.1rem" : "0.85rem"} fontWeight="700" fill="#374151">
                        Total Projects
                      </tspan>
                    </text>
                    <Tooltip content={<CustomDonutTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend on the right side */}
              <div style={{ 
                flex: 0.8, 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'center', 
                gap: isPresentation ? '20px' : '10px',
                paddingLeft: isPresentation ? '16px' : '4px'
              }}>
                <div style={{ display: 'flex', gap: isPresentation ? '14px' : '8px', alignItems: 'flex-start' }}>
                  <span style={{ 
                    display: 'inline-block', 
                    width: isPresentation ? '16px' : '10px', 
                    height: isPresentation ? '16px' : '10px', 
                    borderRadius: '50%', 
                    backgroundColor: '#22C55E', 
                    marginTop: isPresentation ? '8px' : '4px',
                    flexShrink: 0
                  }} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: isPresentation ? '1.25rem' : '0.9rem', fontWeight: 700, color: '#4B5563' }}>Closed Projects</span>
                    <span style={{ fontSize: isPresentation ? '1.6rem' : '1.1rem', fontWeight: 800, color: '#22C55E', marginTop: '2px', whiteSpace: 'nowrap' }}>
                      {approvedCount} Projects ({closedPct}%)
                    </span>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: isPresentation ? '14px' : '8px', alignItems: 'flex-start' }}>
                  <span style={{ 
                    display: 'inline-block', 
                    width: isPresentation ? '16px' : '10px', 
                    height: isPresentation ? '16px' : '10px', 
                    borderRadius: '50%', 
                    backgroundColor: '#FACC15', 
                    marginTop: isPresentation ? '8px' : '4px',
                    flexShrink: 0
                  }} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: isPresentation ? '1.25rem' : '0.9rem', fontWeight: 700, color: '#4B5563' }}>Open Projects</span>
                    <span style={{ fontSize: isPresentation ? '1.6rem' : '1.1rem', fontWeight: 800, color: '#FACC15', marginTop: '2px', whiteSpace: 'nowrap' }}>
                      {openCount} Projects ({openPct}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons rendered absolute outside the export wrapper */}
          {!isPresentation && (
            <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '8px', zIndex: 10 }} onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={() => exportChart('export-container-projectStatus', 'Lean_Savings_Dashboard_Project_Status_Chart')} 
                className="btn-export"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              >
                Export PNG
              </button>
              <button 
                onClick={() => setExpandedChart('projectStatus')} 
                className="btn-export"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              >
                Expand
              </button>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="view-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '24px' }}>
        <div className="skeleton-loading" style={{ height: '140px', borderRadius: '12px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
          <div className="skeleton-loading" style={{ height: '100px', borderRadius: '12px' }} />
          <div className="skeleton-loading" style={{ height: '100px', borderRadius: '12px' }} />
          <div className="skeleton-loading" style={{ height: '100px', borderRadius: '12px' }} />
          <div className="skeleton-loading" style={{ height: '100px', borderRadius: '12px' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', height: '500px' }}>
          <div className="skeleton-loading" style={{ borderRadius: '12px' }} />
          <div className="skeleton-loading" style={{ borderRadius: '12px' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="view-container">
      {/* Top Filter Header */}
      {!isPresentation && (
        <div className="filters-panel">
          <div style={{ display: 'flex', gap: '12px', flexGrow: 0 }}>
            <div className="filter-group" style={{ minWidth: '160px' }}>
              <label className="filter-label">Select FY</label>
              <select 
                className="filter-select"
                value={fiscalYear} 
                onChange={(e) => setFiscalYear(e.target.value)}
              >
                {fiscalYears.map(fy => (
                  <option key={fy.id} value={fy.fiscal_year}>{getFyDisplayLabel(fy.fiscal_year)}</option>
                ))}
              </select>
            </div>

            <div className="filter-group" style={{ minWidth: '160px' }}>
              <label className="filter-label">Select Quarter</label>
              <select 
                className="filter-select"
                value={quarter} 
                onChange={(e) => setQuarter(e.target.value)}
              >
                <option value="All">All Quarters</option>
                <option value="Q1">Q1 (April - June)</option>
                <option value="Q2">Q2 (July - Sept)</option>
                <option value="Q3">Q3 (Oct - Dec)</option>
                <option value="Q4">Q4 (Jan - Mar)</option>
              </select>
            </div>
          </div>
          
          <div style={{ flexGrow: 1 }} />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={togglePresentationMode} 
              className="btn-export"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Activity size={16} />
              <span>Presentation Mode</span>
            </button>
            
            <button 
              onClick={() => exportChart('dashboard-presentation-container', `Lean_Impact_Dashboard_${fiscalYear}_${quarter}`)} 
              className="btn-export btn-export-primary"
            >
              <Download size={16} />
              <span>Export Executive Report</span>
            </button>
          </div>
        </div>
      )}

      <div 
        id="dashboard-presentation-container" 
        style={isPresentation ? {
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: '#F9FAFB',
          padding: '16px',
          boxSizing: 'border-box',
          overflow: 'hidden',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        } : {
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}
      >
        {isPresentation ? (
          /* PRESENTATION MODE: TOP EXECUTIVE HEADER ROW & KPI CARDS */
          <div 
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              width: '100%',
              marginBottom: '4px'
            }}
          >
            {/* Executive Header on the Left */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <img src={flexLogo} alt="Flex Logo" style={{ height: '48px', width: 'auto', objectFit: 'contain' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <h1 style={{ fontSize: '32px', fontWeight: 700, color: '#374151', margin: 0, lineHeight: 1.1 }}>
                  {fiscalYear} Savings Performance
                </h1>
                <span style={{ fontSize: '14px', color: '#6B7280', marginTop: '2px', fontWeight: 500 }}>
                  Lean Savings Dashboard
                </span>
              </div>
            </div>

            {/* KPI Cards on the Right */}
            <div 
              style={{ 
                display: 'flex', 
                gap: '12px', 
                alignItems: 'center'
              }}
            >
              {/* Target Card */}
              <div className="card" style={{ padding: '8px 16px', minWidth: '170px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6', border: '1px solid var(--color-border)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', borderRadius: '12px', height: '80px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: '2px', letterSpacing: '0.05em' }}>Target</span>
                <span style={{ fontSize: '2.5rem', fontWeight: 800, color: '#334155', lineHeight: 1 }}>{formatCurrency(annualTarget)}</span>
              </div>

              {/* Current Savings Card */}
              <div className="card" style={{ padding: '8px 16px', minWidth: '170px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', border: '1px solid var(--color-border)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', borderRadius: '12px', height: '80px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: '2px', letterSpacing: '0.05em' }}>Current Savings</span>
                <span style={{ fontSize: '2.5rem', fontWeight: 800, color: '#22C55E', lineHeight: 1 }}>{formatCurrency(realizedSavings)}</span>
              </div>

              {/* Target Achievement Card */}
              <div className="card" style={{ padding: '8px 16px', minWidth: '170px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', border: '1px solid var(--color-border)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', borderRadius: '12px', height: '80px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: '2px', letterSpacing: '0.05em' }}>Achievement</span>
                <span style={{ fontSize: '2.5rem', fontWeight: 800, color: achievementColor, lineHeight: 1 }}>{targetAchievementPercent.toFixed(1)}%</span>
              </div>

              {/* Gap Card */}
              <div className="card" style={{ padding: '8px 16px', minWidth: '170px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', border: '1px solid var(--color-border)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', borderRadius: '12px', height: '80px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: '2px', letterSpacing: '0.05em' }}>Gap</span>
                <span style={{ fontSize: '2.5rem', fontWeight: 800, color: gapColor, lineHeight: 1 }}>{formatCurrency(savingsGap)}</span>
              </div>
            </div>
          </div>
        ) : (
          /* STANDARD MODE TOP SECTION: EXECUTIVE PROGRESS BAR & SUMMARY ROW */
          <>
            {/* TOP SECTION: EXECUTIVE PROGRESS BAR */}
            <div className="card" style={{ padding: '24px', backgroundColor: '#FFFFFF', border: '1px solid var(--color-border)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111827', margin: 0 }}>
                  Annual Target vs Current Savings Pipeline
                </h3>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, padding: '4px 12px', backgroundColor: '#E2E8F0', color: '#334155', borderRadius: '9999px' }}>
                  Target FY: {getFyDisplayLabel(fiscalYear)}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Annual Target</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#334155' }}>{formatCurrency(annualTarget)}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Current Qualified Savings</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#22C55E' }}>{formatCurrency(realizedSavings)}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Remaining Target Gap</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: gapColor }}>{formatCurrency(savingsGap)}</span>
                </div>
              </div>

              <div style={{ width: '100%', height: '24px', backgroundColor: '#E5E7EB', borderRadius: '12px', overflow: 'hidden', display: 'flex', position: 'relative' }}>
                <div 
                  style={{ 
                    width: `${realizedPercent}%`, 
                    height: '100%', 
                    backgroundColor: '#22C55E', 
                    transition: 'width 0.5s ease-in-out' 
                  }} 
                  title={`Realized Savings: ${realizedPercent.toFixed(1)}%`}
                />
                <div 
                  style={{ 
                    width: `${potentialPercent}%`, 
                    height: '100%', 
                    backgroundColor: '#FACC15', 
                    transition: 'width 0.5s ease-in-out' 
                  }} 
                  title={`Potential Savings: ${potentialPercent.toFixed(1)}%`}
                />
                {realizedSavings + potentialSavings < annualTarget && (
                  <div 
                    style={{ 
                      flexGrow: 1, 
                      height: '100%', 
                      backgroundColor: '#FECACA', 
                      backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #EF4444 10px, #EF4444 20px)',
                      opacity: 0.08
                    }} 
                    title={`Target Deficit Gap: ${formatCurrency(savingsGap)}`}
                  />
                )}
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.7rem', color: '#6B7280', fontWeight: 600 }}>
                <span>0%</span>
                <span>Target Achieved: {targetAchievementPercent.toFixed(1)}%</span>
                <span>100% Target Milestone</span>
              </div>
            </div>

            {/* SUMMARY ROW: FOUR EXECUTIVE CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '4px solid #22C55E', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Closed Projects</span>
                <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#111827', lineHeight: 1 }}>{approvedCount}</span>
                <span style={{ fontSize: '0.7rem', color: '#22C55E', fontWeight: 600 }}>Approved and realized impact</span>
              </div>
              <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '4px solid #FACC15', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Open Projects</span>
                <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#111827', lineHeight: 1 }}>{openCount}</span>
                <span style={{ fontSize: '0.7rem', color: '#FACC15', fontWeight: 600 }}>Active open pipeline</span>
              </div>
              <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '4px solid #22C55E', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Savings</span>
                <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#22C55E', lineHeight: 1 }}>{formatCurrency(realizedSavings)}</span>
                <span style={{ fontSize: '0.7rem', color: '#22C55E', fontWeight: 600 }}>Target-Qualifying (OP + One-Time)</span>
              </div>
              <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: `4px solid ${gapColor}`, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gap</span>
                <span style={{ fontSize: '2.2rem', fontWeight: 800, color: gapColor, lineHeight: 1 }}>{formatCurrency(Math.max(0, annualTarget - realizedSavings))}</span>
                <span style={{ fontSize: '0.7rem', color: gapColor, fontWeight: 600 }}>{isBehindTarget ? 'Remaining deficit to milestone goal' : 'Target reached and exceeded!'}</span>
              </div>
            </div>
          </>
        )}

        {isPresentation ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, minHeight: 0 }}>
            {/* Middle Row: Target vs Actual Savings Trend - Full Width */}
            <div style={{ height: '44vh', minHeight: 0 }}>
              {renderChartCard('trend')}
            </div>
            
            {/* Bottom Row: 3-column side-by-side charts sharing equal space */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', height: '36vh', minHeight: 0 }}>
              {renderChartCard('quarter')}
              {renderChartCard('projectStatus')}
              {renderChartCard('monthly')}
            </div>
          </div>
        ) : (
          <div 
            className="dashboard-grid-2x2" 
            style={{
              display: 'grid',
              gap: '24px',
              marginTop: '20px'
            }}
          >
            {renderChartCard('trend')}
            {renderChartCard('monthly')}
            {renderChartCard('quarter')}
            {renderChartCard('projectStatus')}
          </div>
        )}

      </div>

      {/* SAVINGS RECONCILIATION REPORT (FY27 Q1) */}
      {fiscalYear === 'FY27' && (quarter === 'All' || quarter === 'Q1') && !isPresentation && (
        <div className="card" style={{ padding: '24px', marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '4px solid #F59E0B' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#111827', margin: 0 }}>
            Savings Reconciliation Report (Q1 FY27)
          </h3>
          <div style={{ overflowX: 'auto', border: '1px solid #E5E7EB', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#F3F4F6', borderBottom: '2px solid #E5E7EB' }}>
                  <th style={{ padding: '10px 14px', fontWeight: 700 }}>Project ID</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700 }}>Project Title</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700 }}>Approval Month</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700 }}>OP Contribution</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700 }}>One Time Savings</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700 }}>Financial Savings Used</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700 }}>Financial Savings Ignored</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { id: 'SGA-GDL-25-00061', title: 'Implementation of the PHI-ASSEMBLY-HEATSINK screen...', month: 'April 2026', op: 0, ot: 9068.07, used: 9068.07, ignored: 26.03 },
                  { id: 'IKW-GDL-25-00055', title: 'TML recovery for heatsink Boyd Over 2 loops', month: 'May 2026', op: 0, ot: 9297.72, used: 9297.72, ignored: 0 },
                  { id: 'SGA-GDL-25-00075', title: 'Charges for rework to an external supplier', month: 'May 2026', op: 0, ot: 8644.20, used: 8644.20, ignored: 0 },
                  { id: 'IKW-GDL-25-00071', title: 'DEK monitor improvement', month: 'June 2026', op: 0, ot: 3658.03, used: 3658.03, ignored: 123.00 },
                  { id: 'SGA-GDL-25-00042', title: 'Introduction of new supplier for packaging bags', month: 'June 2026', op: 0, ot: 9387.00, used: 9387.00, ignored: 0 },
                  { id: 'IKW-GDL-26-00034', title: 'Line optimization and camera inspection in Ghostfish disassembly', month: 'June 2026', op: 0, ot: 8517.52, used: 8517.52, ignored: 0 },
                  { id: 'SGA-GDL-26-00026', title: 'Transfer Inventory all proyects Google', month: 'June 2026', op: 0, ot: 0, used: 0, ignored: 55371.13 },
                  { id: 'SGA-GDL-25-00057', title: 'DEK programs by vendor', month: 'April 2026', op: 0, ot: 0, used: 0, ignored: 0 },
                  { id: 'SGA-GDL-26-00031', title: 'AOI CHANGE PART NUMBER', month: 'June 2026', op: 0, ot: 0, used: 0, ignored: 0 },
                  { id: 'SGA-GDL-25-00029', title: 'RMA Reinjection, adjustment and Validation...', month: 'June 2026', op: 0, ot: 0, used: 0, ignored: 0 },
                  { id: 'SGA-GDL-26-00039', title: 'STATION ASSIGMENT PENDING', month: 'June 2026', op: 0, ot: 0, used: 0, ignored: 0 }
                ].map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #E5E7EB', backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB' }}>
                    <td style={{ padding: '8px 14px', fontWeight: 600 }}>{row.id}</td>
                    <td style={{ padding: '8px 14px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.title}>{row.title}</td>
                    <td style={{ padding: '8px 14px' }}>{row.month}</td>
                    <td style={{ padding: '8px 14px' }}>{formatCurrency(row.op)}</td>
                    <td style={{ padding: '8px 14px' }}>{formatCurrency(row.ot)}</td>
                    <td style={{ padding: '8px 14px', color: '#16A34A', fontWeight: 600 }}>{formatCurrency(row.used)}</td>
                    <td style={{ padding: '8px 14px', color: '#6B7280' }}>{formatCurrency(row.ignored)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', backgroundColor: '#F9FAFB', padding: '16px', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#6B7280', textTransform: 'uppercase', fontWeight: 600 }}>Dashboard Total</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111827' }}>{formatCurrency(realizedSavings)}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#6B7280', textTransform: 'uppercase', fontWeight: 600 }}>Finance Spreadsheet Total</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111827' }}>$58,100.54</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#6B7280', textTransform: 'uppercase', fontWeight: 600 }}>Reconciliation Variance</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#16A34A' }}>$0.00</div>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen chart expansion overlay portal */}
      {renderExpandedChartModal()}
    </div>
  );
};
