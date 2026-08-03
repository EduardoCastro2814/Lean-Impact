import React, { useEffect, useState } from 'react';
import { 
  Activity, 
  Download
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer
} from 'recharts';
import html2canvas from 'html2canvas';
import { dbService, getFyDisplayLabel, getFiscalMonthIndex, getProjectPeriodSavings } from '../lib/supabaseClient';
import type { ProjectApproved, ProjectOpen, SavingsTarget } from '../lib/supabaseClient';

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(val);
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
  const [expandedChart, setExpandedChart] = useState<string | null>(null);

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
    return sum + (mProj <= endMonthIdx ? p.op_contribution * (endMonthIdx - mProj + 1) : 0);
  }, 0);
  const realizedOneTime = approvedFiltered.reduce((sum, p) => sum + (getFiscalMonthIndex(p.approval_date) <= endMonthIdx ? p.one_time_savings : 0), 0);
  const realizedSavings = realizedOp + realizedOneTime;

  // Potential Breakdown (Open Projects)
  const potentialOp = openFiltered.reduce((sum, p) => {
    const mProj = getFiscalMonthIndex(p.created_date);
    return sum + (mProj <= endMonthIdx ? p.op_contribution * (endMonthIdx - mProj + 1) : 0);
  }, 0);
  const potentialOneTime = openFiltered.reduce((sum, p) => sum + (getFiscalMonthIndex(p.created_date) <= endMonthIdx ? p.one_time_savings : 0), 0);
  const potentialSavings = potentialOp + potentialOneTime;

  // Other Executive KPIs
  const expectedFinalSavings = realizedSavings + potentialSavings;
  const forecastAchievementPercent = annualTarget > 0 ? (expectedFinalSavings / annualTarget) * 100 : 0;
  const rawGap = annualTarget - realizedSavings;
  const savingsGap = rawGap > 0 ? rawGap : 0;
  
  // Filter count projects for period display
  const openCount = openFiltered.filter(p => getFiscalMonthIndex(p.created_date) <= endMonthIdx).length;
  const approvedCount = approvedFiltered.filter(p => getFiscalMonthIndex(p.approval_date) <= endMonthIdx).length;

  // Visual Progress Gauge markers
  const maxBarVal = Math.max(annualTarget, expectedFinalSavings);
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
      .reduce((sum, p) => sum + p.op_contribution, 0);

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

  // 5. Target vs Actual Savings Trend Cumulative Data
  const getTargetProgression = (monthIdx: number) => {
    const q1T = getTargetForPeriod(targets, fiscalYear, 'Q1');
    const q2T = getTargetForPeriod(targets, fiscalYear, 'Q2');
    const q3T = getTargetForPeriod(targets, fiscalYear, 'Q3');
    const q4T = getTargetForPeriod(targets, fiscalYear, 'Q4');

    if (monthIdx <= 2) { // Apr (0), May (1), Jun (2)
      return (q1T / 3) * (monthIdx + 1);
    } else if (monthIdx <= 5) { // Jul (3), Aug (4), Sep (5)
      const base = q1T;
      const diff = q2T - q1T;
      return base + (diff / 3) * (monthIdx - 2);
    } else if (monthIdx <= 8) { // Oct (6), Nov (7), Dec (8)
      const base = q2T;
      const diff = q3T - q2T;
      return base + (diff / 3) * (monthIdx - 5);
    } else { // Jan (9), Feb (10), Mar (11)
      const base = q3T;
      const diff = q4T - q3T;
      return base + (diff / 3) * (monthIdx - 8);
    }
  };

  const cumulativeTrendData = fiscalMonths.map((m, monthIdx) => {
    const targetVal = getTargetProgression(monthIdx);
    const actualVal = approvedFiltered.reduce((sum, p) => sum + getProjectPeriodSavings(p, monthIdx), 0);
    const potentialVal = openFiltered.reduce((sum, p) => sum + getProjectPeriodSavings(p, monthIdx), 0);
    const forecastVal = actualVal + potentialVal;
    return {
      name: m.name,
      index: monthIdx,
      'Target Savings': Math.round(targetVal),
      'Actual Savings': Math.round(actualVal),
      'Forecast': Math.round(forecastVal),
      'Variance': Math.round(actualVal - targetVal)
    };
  });

  // 6. Quarterly FTE Headcount Savings Data
  const quartersList = ['Q1', 'Q2', 'Q3', 'Q4'];
  const fteData = quartersList.map(q => {
    const approvedFteVal = approvedFiltered
      .filter(p => p.fiscal_year === fiscalYear && p.fiscal_quarter === q)
      .reduce((sum, p) => sum + p.fte_savings, 0);

    const openFteVal = openFiltered
      .filter(p => p.fiscal_year === fiscalYear && p.fiscal_quarter === q)
      .reduce((sum, p) => sum + p.fte_savings, 0);

    return {
      name: q,
      'Approved FTE': approvedFteVal,
      'Open FTE': openFteVal
    };
  });

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <ResponsiveContainer width="100%" height={380}>
            <LineChart data={cumulativeTrendData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={formatCurrency} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Legend />
              <Line type="monotone" dataKey="Actual Savings" stroke="#16A34A" strokeWidth={3} dot={{ r: 6 }} activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="Target Savings" stroke="#4B5563" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4 }} />
              <Line type="monotone" dataKey="Forecast" stroke="#2563EB" strokeWidth={2} strokeDasharray="3 3" dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
          
          <div style={{ overflowX: 'auto', border: '1px solid #E5E7EB', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#F3F4F6', borderBottom: '2px solid #E5E7EB' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Fiscal Month</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Quarter</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Target Savings</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Actual Savings (Realized)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Variance to Target</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Forecast (Cumulative)</th>
                </tr>
              </thead>
              <tbody>
                {cumulativeTrendData.map((row, idx) => {
                  const qLabel = idx <= 2 ? 'Q1' : idx <= 5 ? 'Q2' : idx <= 8 ? 'Q3' : 'Q4';
                  const isPositive = row.Variance >= 0;
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #E5E7EB', backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB' }}>
                      <td style={{ padding: '10px 16px', fontWeight: 600 }}>{row.name}</td>
                      <td style={{ padding: '10px 16px', color: '#4B5563' }}>{qLabel}</td>
                      <td style={{ padding: '10px 16px' }}>{formatCurrency(row['Target Savings'])}</td>
                      <td style={{ padding: '10px 16px', color: '#16A34A', fontWeight: 600 }}>{formatCurrency(row['Actual Savings'])}</td>
                      <td style={{ padding: '10px 16px', color: isPositive ? '#16A34A' : '#DC2626', fontWeight: 600 }}>
                        {isPositive ? '+' : ''}{formatCurrency(row.Variance)}
                      </td>
                      <td style={{ padding: '10px 16px', color: '#2563EB' }}>{formatCurrency(row.Forecast)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    } else if (expandedChart === 'monthly') {
      chartTitle = 'Monthly Savings Breakdown (Stacked Month Trend)';
      chartComponent = (
        <ResponsiveContainer width="100%" height={500}>
          <BarChart data={realizedByTypeData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis tickFormatter={formatCurrency} />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <Legend />
            <Bar dataKey="OP Contribution" stackId="a" fill="#16A34A" />
            <Bar dataKey="One Time Savings" stackId="a" fill="#3B82F6" />
            <Bar dataKey="Soft Savings" stackId="a" fill="#9CA3AF" />
            <Bar dataKey="Inventory Savings" stackId="a" fill="#FBBF24" />
          </BarChart>
        </ResponsiveContainer>
      );
    } else if (expandedChart === 'quarter') {
      chartTitle = 'Quarter Performance (Target vs Realized vs Potential)';
      chartComponent = (
        <ResponsiveContainer width="100%" height={500}>
          <BarChart data={quarterlySavingsData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis tickFormatter={formatCurrency} />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <Legend />
            <Bar dataKey="Target" fill="#4B5563" />
            <Bar dataKey="Approved Realized" fill="#16A34A" />
            <Bar dataKey="Open Potential" fill="#2563EB" />
          </BarChart>
        </ResponsiveContainer>
      );
    } else if (expandedChart === 'fte') {
      chartTitle = 'Productivity Impact (Quarterly FTE Headcount Savings)';
      chartComponent = (
        <ResponsiveContainer width="100%" height={500}>
          <BarChart data={fteData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip formatter={(value) => `${Number(value).toFixed(1)} FTEs`} />
            <Legend />
            <Bar dataKey="Approved FTE" fill="#0284C7" />
            <Bar dataKey="Open FTE" fill="#38BDF8" />
          </BarChart>
        </ResponsiveContainer>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', margin: 0 }}>{chartTitle}</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => exportChart(`expanded-chart-render-${expandedChart}`, `Lean_Impact_Expanded_${expandedChart}`)}
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
          </div>
          <div id={`expanded-chart-render-${expandedChart}`} style={{ padding: '16px', backgroundColor: '#FFFFFF', borderRadius: '8px' }}>
            {chartComponent}
          </div>
          <div style={{ textAlign: 'center', fontSize: '0.85rem', color: '#6B7280' }}>
            Press <kbd style={{ padding: '2px 6px', backgroundColor: '#F3F4F6', border: '1px solid #D1D5DB', borderRadius: '4px' }}>ESC</kbd> to close.
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="view-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '24px' }}>
        <div className="skeleton-loading" style={{ height: '140px', borderRadius: '12px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
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
          padding: '20px',
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
        {/* Compact Presentation Header controls inside fullscreen */}
        {isPresentation && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: '12px 20px', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#111827' }}>Lean Impact Executive Monitoring Dashboard</span>
              <div style={{ display: 'flex', gap: '12px' }}>
                <select 
                  className="filter-select"
                  style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                  value={fiscalYear} 
                  onChange={(e) => setFiscalYear(e.target.value)}
                >
                  {fiscalYears.map(fy => (
                    <option key={fy.id} value={fy.fiscal_year}>{getFyDisplayLabel(fy.fiscal_year)}</option>
                  ))}
                </select>
                <select 
                  className="filter-select"
                  style={{ padding: '4px 8px', fontSize: '0.85rem' }}
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
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={togglePresentationMode} 
                className="btn-export"
                style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              >
                Exit Presentation
              </button>
              <button 
                onClick={() => exportChart('dashboard-presentation-container', `Lean_Impact_Dashboard_${fiscalYear}_${quarter}`)}
                className="btn-export btn-export-primary"
                style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              >
                Export PNG
              </button>
            </div>
          </div>
        )}

        {/* TOP SECTION: EXECUTIVE PROGRESS BAR */}
        <div className="card" style={isPresentation ? { padding: '16px 20px', backgroundColor: '#FFFFFF', border: '1px solid var(--color-border)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', display: 'flex', flexDirection: 'column', gap: '8px' } : { padding: '24px', backgroundColor: '#FFFFFF', border: '1px solid var(--color-border)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isPresentation ? '4px' : '16px' }}>
            <h3 style={{ fontSize: isPresentation ? '1.1rem' : '1.25rem', fontWeight: 800, color: '#111827', margin: 0 }}>
              Annual Target vs Current Savings Pipeline
            </h3>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, padding: '4px 12px', backgroundColor: '#F0F9FF', color: '#0369A1', borderRadius: '9999px' }}>
              Target FY: {getFyDisplayLabel(fiscalYear)}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: isPresentation ? '4px' : '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Target FY Milestone</span>
              <span style={{ fontSize: isPresentation ? '1.15rem' : '1.25rem', fontWeight: 800, color: '#111827' }}>{formatCurrency(annualTarget)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Current Realized Savings</span>
              <span style={{ fontSize: isPresentation ? '1.15rem' : '1.25rem', fontWeight: 800, color: '#16A34A' }}>{formatCurrency(realizedSavings)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Potential Savings</span>
              <span style={{ fontSize: isPresentation ? '1.15rem' : '1.25rem', fontWeight: 800, color: '#2563EB' }}>{formatCurrency(potentialSavings)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Forecast End of FY</span>
              <span style={{ fontSize: isPresentation ? '1.15rem' : '1.25rem', fontWeight: 800, color: '#0F766E' }}>{formatCurrency(expectedFinalSavings)}</span>
            </div>
          </div>

          <div style={{ width: '100%', height: isPresentation ? '16px' : '24px', backgroundColor: '#E5E7EB', borderRadius: '12px', overflow: 'hidden', display: 'flex', position: 'relative' }}>
            <div 
              style={{ 
                width: `${realizedPercent}%`, 
                height: '100%', 
                backgroundColor: '#16A34A', 
                transition: 'width 0.5s ease-in-out' 
              }} 
              title={`Realized Savings: ${realizedPercent.toFixed(1)}%`}
            />
            <div 
              style={{ 
                width: `${potentialPercent}%`, 
                height: '100%', 
                backgroundColor: '#3B82F6', 
                transition: 'width 0.5s ease-in-out' 
              }} 
              title={`Potential Savings: ${potentialPercent.toFixed(1)}%`}
            />
            {realizedSavings + potentialSavings < annualTarget && (
              <div 
                style={{ 
                  flexGrow: 1, 
                  height: '100%', 
                  backgroundColor: '#FEE2E2', 
                  backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #FCA5A5 10px, #FCA5A5 20px)',
                  opacity: 0.8
                }} 
                title={`Target Deficit Gap: ${formatCurrency(savingsGap)}`}
              />
            )}
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.7rem', color: '#6B7280', fontWeight: 600 }}>
            <span>0%</span>
            <span>Forecast Achieved: {forecastAchievementPercent.toFixed(1)}%</span>
            <span>100% Target Milestone</span>
          </div>
        </div>

        {/* SUMMARY ROW: THREE EXECUTIVE CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <div className="card" style={{ padding: isPresentation ? '12px 16px' : '24px', display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '4px solid #10B981', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Closed Projects</span>
            <span style={{ fontSize: isPresentation ? '1.8rem' : '2.5rem', fontWeight: 800, color: '#111827', lineHeight: 1 }}>{approvedCount}</span>
            <span style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: 600 }}>Approved and realized impact</span>
          </div>
          <div className="card" style={{ padding: isPresentation ? '12px 16px' : '24px', display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '4px solid #3B82F6', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Open Projects</span>
            <span style={{ fontSize: isPresentation ? '1.8rem' : '2.5rem', fontWeight: 800, color: '#111827', lineHeight: 1 }}>{openCount}</span>
            <span style={{ fontSize: '0.7rem', color: '#3B82F6', fontWeight: 600 }}>Active open pipeline</span>
          </div>
          <div className="card" style={{ padding: isPresentation ? '12px 16px' : '24px', display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '4px solid #0F766E', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Qualified Savings</span>
            <span style={{ fontSize: isPresentation ? '1.8rem' : '2.5rem', fontWeight: 800, color: '#0F766E', lineHeight: 1 }}>{formatCurrency(realizedSavings)}</span>
            <span style={{ fontSize: '0.7rem', color: '#0F766E', fontWeight: 600 }}>Target-Qualifying (OP + One-Time)</span>
          </div>
        </div>

        {/* MAIN ANALYTICS GRID: 2x2 CHART TILES */}
        <div 
          className="dashboard-grid-2x2" 
          style={isPresentation ? {
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gridTemplateRows: 'repeat(2, 1fr)',
            gap: '16px',
            overflow: 'hidden'
          } : {
            display: 'grid',
            gap: '24px',
            marginTop: '20px'
          }}
        >
          
          {/* Card 1: Target vs Actual Savings Trend Chart */}
          <div 
            className="card" 
            id="trend-chart-tile" 
            style={{ 
              padding: isPresentation ? '12px 16px' : '20px', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: isPresentation ? '8px' : '16px',
              cursor: 'pointer',
              height: '100%',
              overflow: 'hidden'
            }}
            onClick={() => setExpandedChart('trend')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: '1rem', color: '#111827' }}>Target vs Actual Savings Trend</span>
              <button 
                onClick={(e) => { e.stopPropagation(); setExpandedChart('trend'); }} 
                className="btn-export"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              >
                Expand
              </button>
            </div>
            <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cumulativeTrendData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke="#6B7280" fontSize={11} tickLine={false} />
                  <YAxis stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Line type="monotone" dataKey="Actual Savings" stroke="#16A34A" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="Target Savings" stroke="#4B5563" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Card 2: Monthly Savings Breakdown */}
          <div 
            className="card" 
            id="monthly-chart-tile" 
            style={{ 
              padding: isPresentation ? '12px 16px' : '20px', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: isPresentation ? '8px' : '16px',
              height: '100%',
              overflow: 'hidden'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: '1rem', color: '#111827' }}>Monthly Savings Breakdown</span>
              <button 
                onClick={() => setExpandedChart('monthly')} 
                className="btn-export"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              >
                Expand
              </button>
            </div>
            <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={realizedByTypeData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke="#6B7280" fontSize={11} tickLine={false} />
                  <YAxis stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="OP Contribution" stackId="a" fill="#16A34A" />
                  <Bar dataKey="One Time Savings" stackId="a" fill="#3B82F6" />
                  <Bar dataKey="Soft Savings" stackId="a" fill="#9CA3AF" />
                  <Bar dataKey="Inventory Savings" stackId="a" fill="#FBBF24" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Card 3: Quarter Performance */}
          <div 
            className="card" 
            id="quarter-chart-tile" 
            style={{ 
              padding: isPresentation ? '12px 16px' : '20px', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: isPresentation ? '8px' : '16px',
              height: '100%',
              overflow: 'hidden'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: '1rem', color: '#111827' }}>Quarter Performance</span>
              <button 
                onClick={() => setExpandedChart('quarter')} 
                className="btn-export"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              >
                Expand
              </button>
            </div>
            <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={quarterlySavingsData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke="#6B7280" fontSize={11} tickLine={false} />
                  <YAxis stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="Target" fill="#4B5563" />
                  <Bar dataKey="Approved Realized" fill="#16A34A" />
                  <Bar dataKey="Open Potential" fill="#2563EB" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Card 4: FTE Performance */}
          <div 
            className="card" 
            id="fte-chart-tile" 
            style={{ 
              padding: isPresentation ? '12px 16px' : '20px', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: isPresentation ? '8px' : '16px',
              height: '100%',
              overflow: 'hidden'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: '1rem', color: '#111827' }}>Productivity Impact (FTE Savings)</span>
              <button 
                onClick={() => setExpandedChart('fte')} 
                className="btn-export"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              >
                Expand
              </button>
            </div>
            <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fteData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke="#6B7280" fontSize={11} tickLine={false} />
                  <YAxis stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value) => `${Number(value).toFixed(1)} FTEs`} />
                  <Bar dataKey="Approved FTE" fill="#0284C7" />
                  <Bar dataKey="Open FTE" fill="#38BDF8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

      </div>

      {/* Full-screen chart expansion overlay portal */}
      {renderExpandedChartModal()}
    </div>
  );
};
