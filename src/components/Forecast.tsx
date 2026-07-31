import React, { useEffect, useState } from 'react';
import { 
  Target, 
  DollarSign, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  Download,
  Sparkles
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ComposedChart,
  Line,
  ReferenceLine
} from 'recharts';
import html2canvas from 'html2canvas';
import { dbService, getFyDisplayLabel } from '../lib/supabaseClient';
import type { ProjectApproved, ProjectOpen, SavingsTarget } from '../lib/supabaseClient';

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(val);
};

export const Forecast: React.FC = () => {
  const [fiscalYear, setFiscalYear] = useState<string>('FY26');
  const [fiscalYears, setFiscalYears] = useState<any[]>([]);
  const [approvedProjects, setApprovedProjects] = useState<ProjectApproved[]>([]);
  const [openProjects, setOpenProjects] = useState<ProjectOpen[]>([]);
  const [targets, setTargets] = useState<SavingsTarget[]>([]);
  const [loading, setLoading] = useState(true);

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
      console.error('Error loading forecast data', e);
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

  // Filter
  const approvedFiltered = approvedProjects.filter(p => p.fiscal_year === fiscalYear);
  const openFiltered = openProjects.filter(p => p.fiscal_year === fiscalYear);

  // Calculate annual target
  const yearTargets = targets.filter(t => t.fiscal_year === fiscalYear);
  const annualTarget = yearTargets.reduce((sum, t) => sum + t.target_amount, 0);

  // Approved realized savings
  const realizedSavings = approvedFiltered.reduce((sum, p) => {
    return sum + (p.op_contribution + p.soft_savings + p.inventory_savings + p.one_time_savings);
  }, 0);

  // Open potential savings
  const potentialSavings = openFiltered.reduce((sum, p) => {
    return sum + (p.op_contribution + p.soft_savings + p.inventory_savings + p.one_time_savings);
  }, 0);

  const expectedFinalSavings = realizedSavings + potentialSavings;
  const rawGap = annualTarget - expectedFinalSavings;
  const remainingGap = rawGap > 0 ? rawGap : 0;


  // Percentages
  const realizedPercent = annualTarget > 0 ? (realizedSavings / annualTarget) * 100 : 0;

  const expectedPercent = annualTarget > 0 ? (expectedFinalSavings / annualTarget) * 100 : 0;
  const gapPercent = annualTarget > 0 ? (remainingGap / annualTarget) * 100 : 0;

  // Chart data: 
  // We represent three bars: 
  // 1. Current Achievement (Approved savings)
  // 2. Expected Final Savings (Approved + Potential)
  // 3. Target (Annual Savings Target)
  const forecastChartData = [
    {
      name: 'Annual Forecast',
      'Approved Savings': realizedSavings,
      'Potential Savings': potentialSavings,
      'Expected Final': expectedFinalSavings,
      'Remaining Gap': remainingGap,
      'Annual Target': annualTarget
    }
  ];

  // Monthly breakdown for cumulative line chart
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  let approvedCumulative = 0;
  let expectedCumulative = 0;

  const monthlyCumulativeData = months.map((month, idx) => {
    // Approved
    const approvedInMonth = approvedFiltered.filter(p => new Date(p.approval_date).getMonth() === idx);
    const approvedSum = approvedInMonth.reduce((sum, p) => sum + (p.op_contribution + p.soft_savings + p.inventory_savings + p.one_time_savings), 0);
    approvedCumulative += approvedSum;

    // Open
    const openInMonth = openFiltered.filter(p => {
      const date = p.completion_date || p.created_date;
      return new Date(date).getMonth() === idx;
    });
    const potentialSum = openInMonth.reduce((sum, p) => sum + (p.op_contribution + p.soft_savings + p.inventory_savings + p.one_time_savings), 0);
    expectedCumulative += (approvedSum + potentialSum);

    // Target cumulative curve
    // Assuming linear target distribution across quarters:
    // targets contains quarterly targets. We can find which quarter this month belongs to and sum target.
    // To make it simple and visual, let's distribute the annual target linearly:
    const monthlyTargetShare = annualTarget / 12;
    const targetCumulative = monthlyTargetShare * (idx + 1);

    return {
      name: month,
      'Realized Savings': approvedCumulative,
      'Projected Savings': expectedCumulative,
      'Target Curve': targetCumulative
    };
  });

  const exportForecastChart = (id: string, fileName: string) => {
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

  if (loading) {
    return (
      <div className="view-container">
        <div className="kpi-grid">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton-loading skeleton-kpi" />
          ))}
        </div>
        <div className="skeleton-loading skeleton-chart" />
      </div>
    );
  }

  const isTargetMet = expectedFinalSavings >= annualTarget;

  return (
    <div className="view-container">
      {/* Top Selector Panel */}
      <div className="filters-panel">
        <div className="filter-group" style={{ minWidth: '140px', flexGrow: 0 }}>
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
        <div style={{ flexGrow: 1 }} />
        <button 
          onClick={() => exportForecastChart('forecast-view-container', `Lean_Impact_Forecast_FY${fiscalYear}`)} 
          className="btn-export btn-export-primary"
        >
          <Download size={16} />
          <span>Export Forecast Report</span>
        </button>
      </div>

      <div id="forecast-view-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Forecast KPI Section */}
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="kpi-widget">
            <div className="kpi-details">
              <span className="kpi-title">Target Goal</span>
              <span className="kpi-value">{formatCurrency(annualTarget)}</span>
              <span className="kpi-subtext">Total Annual Target</span>
            </div>
            <div className="kpi-icon-container" style={{ backgroundColor: '#F3F4F6', color: '#1F2937' }}>
              <Target size={22} />
            </div>
          </div>

          <div className="kpi-widget">
            <div className="kpi-details">
              <span className="kpi-title">Approved Savings</span>
              <span className="kpi-value" style={{ color: '#10B981' }}>{formatCurrency(realizedSavings)}</span>
              <span className="kpi-subtext">{realizedPercent.toFixed(1)}% of Target achieved</span>
            </div>
            <div className="kpi-icon-container" style={{ backgroundColor: '#DCFCE7', color: '#10B981' }}>
              <DollarSign size={22} />
            </div>
          </div>

          <div className="kpi-widget">
            <div className="kpi-details">
              <span className="kpi-title">Potential Savings</span>
              <span className="kpi-value" style={{ color: '#3B82F6' }}>{formatCurrency(potentialSavings)}</span>
              <span className="kpi-subtext">Pipeline open projects</span>
            </div>
            <div className="kpi-icon-container" style={{ backgroundColor: '#DBEAFE', color: '#3B82F6' }}>
              <TrendingUp size={22} />
            </div>
          </div>

          <div className="kpi-widget">
            <div className="kpi-details">
              <span className="kpi-title">Expected Final Savings</span>
              <span className="kpi-value" style={{ color: '#15803D' }}>{formatCurrency(expectedFinalSavings)}</span>
              <span className="kpi-subtext">Projected: {expectedPercent.toFixed(1)}%</span>
            </div>
            <div className="kpi-icon-container" style={{ backgroundColor: '#D1FAE5', color: '#15803D' }}>
              <Sparkles size={22} />
            </div>
          </div>

          <div className="kpi-widget">
            <div className="kpi-details">
              <span className="kpi-title">Remaining Gap</span>
              <span className="kpi-value" style={{ color: remainingGap > 0 ? '#EF4444' : '#10B981' }}>
                {formatCurrency(remainingGap)}
              </span>
              <span className="kpi-subtext">
                {remainingGap > 0 ? `${gapPercent.toFixed(1)}% remaining` : 'Target Secured'}
              </span>
            </div>
            <div 
              className="kpi-icon-container" 
              style={{ 
                backgroundColor: remainingGap > 0 ? '#FEE2E2' : '#DCFCE7', 
                color: remainingGap > 0 ? '#EF4444' : '#10B981' 
              }}
            >
              {remainingGap > 0 ? <AlertTriangle size={22} /> : <CheckCircle size={22} />}
            </div>
          </div>
        </div>

        {/* Forecast Analysis Status Card */}
        <div 
          className="card" 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '16px',
            backgroundColor: isTargetMet ? '#ECFDF5' : '#FFFBEB',
            borderColor: isTargetMet ? '#A7F3D0' : '#FDE68A',
            color: isTargetMet ? '#065F46' : '#92400E'
          }}
        >
          {isTargetMet ? (
            <>
              <CheckCircle size={32} className="text-primary" />
              <div>
                <strong style={{ fontSize: '1rem', display: 'block' }}>Target Goal Secured (Projected)</strong>
                <span style={{ fontSize: '0.85rem' }}>
                  If all open projects in the pipeline complete successfully, Lean Impact will exceed the target by{' '}
                  <strong>{formatCurrency(expectedFinalSavings - annualTarget)}</strong> (Projected {(expectedPercent - 100).toFixed(1)}% above target).
                </span>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle size={32} style={{ color: '#F59E0B' }} />
              <div>
                <strong style={{ fontSize: '1rem', display: 'block' }}>Savings Deficit Detected</strong>
                <span style={{ fontSize: '0.85rem' }}>
                  A gap of <strong>{formatCurrency(remainingGap)}</strong> is projected for this FY. 
                  To secure the target, the lean program needs to identify additional Kaizen or SGA projects to add at least <strong>{formatCurrency(remainingGap)}</strong> in potential savings.
                </span>
              </div>
            </>
          )}
        </div>

        {/* Forecast Graphic Section */}
        <div className="dashboard-main-grid">
          
          {/* Visual Forecast Progression Chart */}
          <div className="card" id="forecast-bar-chart">
            <div className="card-header-row">
              <span className="card-title">Projected Annual Savings Progression</span>
              <button 
                onClick={() => exportForecastChart('forecast-bar-chart', `Savings_Forecast_Progression_FY${fiscalYear}`)} 
                className="btn-export"
              >
                <Download size={14} />
              </button>
            </div>
            
            <div style={{ width: '100%', height: 350 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={forecastChartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" stroke="#6B7280" tickLine={false} />
                  <YAxis stroke="#6B7280" tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  <Legend />
                  <Bar dataKey="Approved Savings" fill="#22C55E" stackId="savings" name="Approved Realized" />
                  <Bar dataKey="Potential Savings" fill="#86EFAC" stackId="savings" name="Open Pipeline Potential" />
                  <Bar dataKey="Remaining Gap" fill="#EF4444" stackId="savings" name="Remaining Deficit" opacity={0.8} />
                  <ReferenceLine y={annualTarget} label={{ value: 'Target Goal', fill: '#1F2937', position: 'top', fontWeight: 'bold' }} stroke="#1F2937" strokeDasharray="5 5" strokeWidth={2} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cumulative Forecast Progress Trend */}
          <div className="card" id="forecast-cumulative-chart">
            <div className="card-header-row">
              <span className="card-title">Cumulative Forecasting Trend</span>
              <button 
                onClick={() => exportForecastChart('forecast-cumulative-chart', `Cumulative_Forecast_Curve_FY${fiscalYear}`)} 
                className="btn-export"
              >
                <Download size={14} />
              </button>
            </div>

            <div style={{ width: '100%', height: 350 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyCumulativeData} margin={{ top: 20, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" stroke="#6B7280" fontSize={12} tickLine={false} />
                  <YAxis stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  <Legend />
                  <Bar dataKey="Realized Savings" name="Cumulative Approved" fill="#22C55E" opacity={0.8} />
                  <Line type="monotone" dataKey="Projected Savings" name="Cumulative Expected (Realized + Open)" stroke="#3B82F6" strokeWidth={3} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Target Curve" name="Linear Target Path" stroke="#EF4444" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
