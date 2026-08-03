import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Target, 
  Percent, 
  Activity, 
  Download,
  AlertTriangle,
  CheckCircle,
  Briefcase
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer
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

export const Dashboard: React.FC = () => {
  const [fiscalYear, setFiscalYear] = useState<string>('FY26');
  const [quarter, setQuarter] = useState<string>('All');
  const [approvedProjects, setApprovedProjects] = useState<ProjectApproved[]>([]);
  const [openProjects, setOpenProjects] = useState<ProjectOpen[]>([]);
  const [targets, setTargets] = useState<SavingsTarget[]>([]);
  const [fiscalYears, setFiscalYears] = useState<any[]>([]);
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

  // Filter projects by selected Fiscal Year and Quarter
  const approvedFiltered = approvedProjects.filter(p => 
    p.fiscal_year === fiscalYear && 
    (quarter === 'All' || p.fiscal_quarter === quarter)
  );

  const openFiltered = openProjects.filter(p => 
    p.fiscal_year === fiscalYear && 
    (quarter === 'All' || p.fiscal_quarter === quarter)
  );

  // Targets filtered
  const yearTargets = targets.filter(t => 
    t.fiscal_year === fiscalYear && 
    (quarter === 'All' ? t.quarter !== 'Annual' : t.quarter === quarter)
  );
  
  const annualTarget = yearTargets.reduce((sum, t) => sum + t.target_amount, 0);

  // Realized Breakdown (Approved Projects)
  const realizedOp = approvedFiltered.reduce((sum, p) => sum + p.op_contribution, 0);
  const realizedSoft = approvedFiltered.reduce((sum, p) => sum + p.soft_savings, 0);
  const realizedInventory = approvedFiltered.reduce((sum, p) => sum + p.inventory_savings, 0);
  const realizedOneTime = approvedFiltered.reduce((sum, p) => sum + p.one_time_savings, 0);
  const realizedFte = approvedFiltered.reduce((sum, p) => sum + p.fte_savings, 0);
  const realizedSavings = realizedOp + realizedOneTime;

  // Potential Breakdown (Open Projects)
  const potentialOp = openFiltered.reduce((sum, p) => sum + p.op_contribution, 0);
  const potentialSoft = openFiltered.reduce((sum, p) => sum + p.soft_savings, 0);
  const potentialInventory = openFiltered.reduce((sum, p) => sum + p.inventory_savings, 0);
  const potentialOneTime = openFiltered.reduce((sum, p) => sum + p.one_time_savings, 0);
  const potentialFte = openFiltered.reduce((sum, p) => sum + p.fte_savings, 0);
  const potentialSavings = potentialOp + potentialOneTime;

  // Overall Breakdown (Total Savings)
  const totalOp = realizedOp + potentialOp;
  const totalSoft = realizedSoft + potentialSoft;
  const totalInventory = realizedInventory + potentialInventory;
  const totalOneTime = realizedOneTime + potentialOneTime;
  const totalFte = realizedFte + potentialFte;
  const totalSavings = realizedSavings + potentialSavings;

  // Other Executive KPIs
  const expectedFinalSavings = realizedSavings + potentialSavings;
  const achievementPercent = annualTarget > 0 ? (realizedSavings / annualTarget) * 100 : 0;
  const forecastAchievementPercent = annualTarget > 0 ? (expectedFinalSavings / annualTarget) * 100 : 0;
  const rawGap = annualTarget - realizedSavings;
  const savingsGap = rawGap > 0 ? rawGap : 0;
  const openCount = openFiltered.length;
  const approvedCount = approvedFiltered.length;

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

  const realizedByTypeData = fiscalMonths.map(m => {
    const projectsInMonth = approvedFiltered.filter(p => new Date(p.approval_date).getMonth() === m.index);
    return {
      name: m.name,
      'OP Contribution': projectsInMonth.reduce((sum, p) => sum + p.op_contribution, 0),
      'Soft Savings': projectsInMonth.reduce((sum, p) => sum + p.soft_savings, 0),
      'Inventory Savings': projectsInMonth.reduce((sum, p) => sum + p.inventory_savings, 0),
      'One Time Savings': projectsInMonth.reduce((sum, p) => sum + p.one_time_savings, 0)
    };
  });

  // 2. Chart 2: Potential Savings by Type (stacked month trend April to March)
  const potentialByTypeData = fiscalMonths.map(m => {
    const projectsInMonth = openFiltered.filter(p => new Date(p.created_date).getMonth() === m.index);
    return {
      name: m.name,
      'OP Contribution': projectsInMonth.reduce((sum, p) => sum + p.op_contribution, 0),
      'Soft Savings': projectsInMonth.reduce((sum, p) => sum + p.soft_savings, 0),
      'Inventory Savings': projectsInMonth.reduce((sum, p) => sum + p.inventory_savings, 0),
      'One Time Savings': projectsInMonth.reduce((sum, p) => sum + p.one_time_savings, 0)
    };
  });

  // 3. Chart 3: Savings by Fiscal Quarter
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  const quarterlySavingsData = quarters.map(q => {
    const qTarget = targets
      .filter(t => t.fiscal_year === fiscalYear && t.quarter === q)
      .reduce((sum, t) => sum + t.target_amount, 0);
    
    const qApproved = approvedProjects
      .filter(p => p.fiscal_year === fiscalYear && p.fiscal_quarter === q)
      .reduce((sum, p) => sum + (p.op_contribution + p.one_time_savings), 0);
    
    const qOpen = openProjects
      .filter(p => p.fiscal_year === fiscalYear && p.fiscal_quarter === q)
      .reduce((sum, p) => sum + (p.op_contribution + p.one_time_savings), 0);

    return {
      name: q,
      'Target': qTarget,
      'Approved Realized': qApproved,
      'Open Potential': qOpen
    };
  });

  // 4. Chart 4: Savings by Fiscal Year
  const yearlySavingsData = fiscalYears.map(fy => {
    const fyTarget = targets
      .filter(t => t.fiscal_year === fy.fiscal_year && t.quarter !== 'Annual')
      .reduce((sum, t) => sum + t.target_amount, 0);

    const fyApproved = approvedProjects
      .filter(p => p.fiscal_year === fy.fiscal_year)
      .reduce((sum, p) => sum + (p.op_contribution + p.one_time_savings), 0);
    
    const fyOpen = openProjects
      .filter(p => p.fiscal_year === fy.fiscal_year)
      .reduce((sum, p) => sum + (p.op_contribution + p.one_time_savings), 0);

    return {
      name: fy.fiscal_year,
      'Target': fyTarget,
      'Approved Realized': fyApproved,
      'Open Potential': fyOpen
    };
  });

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

  if (loading) {
    return (
      <div className="view-container">
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="skeleton-loading skeleton-kpi" />
          ))}
        </div>
        <div className="skeleton-loading skeleton-chart" style={{ height: '350px' }} />
      </div>
    );
  }

  return (
    <div className="view-container">
      {/* Top Filter Header */}
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
        <button 
          onClick={() => exportChart('dashboard-redesign-container', `Lean_Impact_Dashboard_${fiscalYear}_${quarter}`)} 
          className="btn-export btn-export-primary"
        >
          <Download size={16} />
          <span>Export Executive Report</span>
        </button>
      </div>

      <div id="dashboard-redesign-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* SECTION 1: EXECUTIVE PERFORMANCE SUMMARY */}
        <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#1F2937', marginTop: '12px', display: 'block' }}>
          🎯 Executive Performance Summary ({fiscalYear} - {quarter === 'All' ? 'All Quarters' : quarter})
        </span>
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          
          <div className="kpi-widget">
            <div className="kpi-details">
              <span className="kpi-title">Annual Savings Target</span>
              <span className="kpi-value">{formatCurrency(annualTarget)}</span>
              <span className="kpi-subtext">Selected period target goal</span>
            </div>
            <div className="kpi-icon-container" style={{ backgroundColor: '#F3F4F6', color: '#1F2937' }}>
              <Target size={20} />
            </div>
          </div>

          <div className="kpi-widget">
            <div className="kpi-details">
              <span className="kpi-title">Realized Savings</span>
              <span className="kpi-value" style={{ color: '#16A34A' }}>{formatCurrency(realizedSavings)}</span>
              <span className="kpi-subtext">Approved project savings</span>
            </div>
            <div className="kpi-icon-container" style={{ backgroundColor: '#DCFCE7', color: '#15803D' }}>
              <DollarSign size={20} />
            </div>
          </div>

          <div className="kpi-widget">
            <div className="kpi-details">
              <span className="kpi-title">Potential Savings</span>
              <span className="kpi-value" style={{ color: '#2563EB' }}>{formatCurrency(potentialSavings)}</span>
              <span className="kpi-subtext">Open pipeline savings</span>
            </div>
            <div className="kpi-icon-container" style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>
              <TrendingUp size={20} />
            </div>
          </div>

          <div className="kpi-widget">
            <div className="kpi-details">
              <span className="kpi-title">Achievement %</span>
              <span className="kpi-value">{achievementPercent.toFixed(1)}%</span>
              <span className="kpi-subtext">Realized vs Target Goal</span>
            </div>
            <div className="kpi-icon-container" style={{ backgroundColor: '#F3F4F6', color: '#1F2937' }}>
              <Percent size={20} />
            </div>
          </div>

          <div className="kpi-widget">
            <div className="kpi-details">
              <span className="kpi-title">Forecast Achievement %</span>
              <span className="kpi-value" style={{ color: forecastAchievementPercent >= 100 ? '#16A34A' : '#D97706' }}>
                {forecastAchievementPercent.toFixed(1)}%
              </span>
              <span className="kpi-subtext">Forecast vs Target Goal</span>
            </div>
            <div className="kpi-icon-container" style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}>
              <Activity size={20} />
            </div>
          </div>

          <div className="kpi-widget">
            <div className="kpi-details">
              <span className="kpi-title">Savings Deficit Gap</span>
              <span className="kpi-value" style={{ color: savingsGap > 0 ? '#DC2626' : '#16A34A' }}>
                {savingsGap > 0 ? formatCurrency(savingsGap) : 'Goal Reached!'}
              </span>
              <span className="kpi-subtext">Deficit to period target</span>
            </div>
            <div className="kpi-icon-container" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>
              <AlertTriangle size={20} />
            </div>
          </div>

          <div className="kpi-widget">
            <div className="kpi-details">
              <span className="kpi-title">Approved Projects</span>
              <span className="kpi-value">{approvedCount}</span>
              <span className="kpi-subtext">Completed project tracks</span>
            </div>
            <div className="kpi-icon-container" style={{ backgroundColor: '#F3F4F6', color: '#1F2937' }}>
              <CheckCircle size={20} />
            </div>
          </div>

          <div className="kpi-widget">
            <div className="kpi-details">
              <span className="kpi-title">Open Projects</span>
              <span className="kpi-value">{openCount}</span>
              <span className="kpi-subtext">Pipeline projects count</span>
            </div>
            <div className="kpi-icon-container" style={{ backgroundColor: '#F3F4F6', color: '#1F2937' }}>
              <Briefcase size={20} />
            </div>
          </div>

        </div>

        {/* SECTION 2: SAVINGS IMPACT DETAILED BREAKDOWN */}
        <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#1F2937', marginTop: '16px', display: 'block' }}>
          💼 Savings & Impact Detailed Breakdown (Realized + Potential)
        </span>

        {/* Group A: Financial Savings */}
        <div style={{ marginTop: '12px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#15803D', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            💰 Financial Savings (Counts toward Target Achievement)
          </span>
          <div className="kpi-grid" style={{ marginTop: '8px', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <div className="kpi-widget" style={{ backgroundColor: '#F0FDF4', borderLeft: '4px solid #16A34A' }}>
              <div className="kpi-details">
                <span className="kpi-title" style={{ color: '#14532D' }}>Target-Qualifying Savings</span>
                <span className="kpi-value" style={{ color: '#16A34A' }}>{formatCurrency(totalSavings)}</span>
                <span className="kpi-subtext">OP + One-Time Savings</span>
              </div>
            </div>
            <div className="kpi-widget">
              <div className="kpi-details">
                <span className="kpi-title">OP Contribution</span>
                <span className="kpi-value">{formatCurrency(totalOp)}</span>
                <span className="kpi-subtext">Operational savings</span>
              </div>
            </div>
            <div className="kpi-widget">
              <div className="kpi-details">
                <span className="kpi-title">One Time Savings</span>
                <span className="kpi-value">{formatCurrency(totalOneTime)}</span>
                <span className="kpi-subtext">One-time event savings</span>
              </div>
            </div>
          </div>
        </div>

        {/* Group B: Operational Impact */}
        <div style={{ marginTop: '20px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ⚙️ Operational Impact (Informational Metrics Only)
          </span>
          <div className="kpi-grid" style={{ marginTop: '8px', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <div className="kpi-widget" style={{ backgroundColor: '#F9FAFB', borderLeft: '4px solid #6B7280' }}>
              <div className="kpi-details">
                <span className="kpi-title">Soft Savings</span>
                <span className="kpi-value">{formatCurrency(totalSoft)}</span>
                <span className="kpi-subtext">Methodology savings</span>
              </div>
            </div>
            <div className="kpi-widget" style={{ backgroundColor: '#F9FAFB', borderLeft: '4px solid #6B7280' }}>
              <div className="kpi-details">
                <span className="kpi-title">Inventory ARAP Savings</span>
                <span className="kpi-value">{formatCurrency(totalInventory)}</span>
                <span className="kpi-subtext">Inventory reduction</span>
              </div>
            </div>
          </div>
        </div>

        {/* Group C: Productivity Impact */}
        <div style={{ marginTop: '20px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0284C7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            👥 Productivity Impact (Non-Financial)
          </span>
          <div className="kpi-grid" style={{ marginTop: '8px', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <div className="kpi-widget" style={{ backgroundColor: '#F0F9FF', borderLeft: '4px solid #0284C7' }}>
              <div className="kpi-details">
                <span className="kpi-title" style={{ color: '#0369A1' }}>FTE Headcount Savings</span>
                <span className="kpi-value" style={{ color: '#0284C7' }}>{totalFte.toFixed(1)} FTEs</span>
                <span className="kpi-subtext">Excludes from monetary calculations</span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: APPROVED PROJECTS (REALIZED BREAKDOWN) */}
        <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#1F2937', marginTop: '24px', display: 'block' }}>
          ✅ Approved Projects (Realized Savings Breakdown)
        </span>
        <div style={{ marginTop: '12px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#15803D', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            💰 Financial Savings (Realized)
          </span>
          <div className="kpi-grid" style={{ marginTop: '8px', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <div className="kpi-widget" style={{ backgroundColor: '#F0FDF4', borderLeft: '4px solid #16A34A' }}>
              <div className="kpi-details">
                <span className="kpi-title" style={{ color: '#14532D' }}>Realized Savings Total</span>
                <span className="kpi-value" style={{ color: '#16A34A' }}>{formatCurrency(realizedSavings)}</span>
                <span className="kpi-subtext">OP + One-Time approved</span>
              </div>
            </div>
            <div className="kpi-widget">
              <div className="kpi-details">
                <span className="kpi-title">OP Contribution Total</span>
                <span className="kpi-value">{formatCurrency(realizedOp)}</span>
                <span className="kpi-subtext">Operational actuals</span>
              </div>
            </div>
            <div className="kpi-widget">
              <div className="kpi-details">
                <span className="kpi-title">One Time Savings Total</span>
                <span className="kpi-value">{formatCurrency(realizedOneTime)}</span>
                <span className="kpi-subtext">One-time actuals</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '20px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ⚙️ Operational Impact (Realized Informational)
          </span>
          <div className="kpi-grid" style={{ marginTop: '8px', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <div className="kpi-widget" style={{ backgroundColor: '#F9FAFB', borderLeft: '4px solid #6B7280' }}>
              <div className="kpi-details">
                <span className="kpi-title">Soft Savings Total</span>
                <span className="kpi-value">{formatCurrency(realizedSoft)}</span>
                <span className="kpi-subtext">Soft savings actuals</span>
              </div>
            </div>
            <div className="kpi-widget" style={{ backgroundColor: '#F9FAFB', borderLeft: '4px solid #6B7280' }}>
              <div className="kpi-details">
                <span className="kpi-title">Inventory Savings Total</span>
                <span className="kpi-value">{formatCurrency(realizedInventory)}</span>
                <span className="kpi-subtext">Inventory actuals</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '20px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0284C7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            👥 Productivity Impact (Realized Non-Financial)
          </span>
          <div className="kpi-grid" style={{ marginTop: '8px', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <div className="kpi-widget" style={{ backgroundColor: '#F0F9FF', borderLeft: '4px solid #0284C7' }}>
              <div className="kpi-details">
                <span className="kpi-title" style={{ color: '#0369A1' }}>FTE Savings Total</span>
                <span className="kpi-value" style={{ color: '#0284C7' }}>{realizedFte.toFixed(1)} FTEs</span>
                <span className="kpi-subtext">FTE reductions actuals</span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 4: OPEN PROJECTS (POTENTIAL BREAKDOWN) */}
        <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#1F2937', marginTop: '24px', display: 'block' }}>
          ⏳ Open Pipeline (Potential Savings Breakdown)
        </span>
        <div style={{ marginTop: '12px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            💰 Financial Savings (Potential)
          </span>
          <div className="kpi-grid" style={{ marginTop: '8px', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <div className="kpi-widget" style={{ backgroundColor: '#EFF6FF', borderLeft: '4px solid #2563EB' }}>
              <div className="kpi-details">
                <span className="kpi-title" style={{ color: '#1E3A8A' }}>Potential Total Savings</span>
                <span className="kpi-value" style={{ color: '#2563EB' }}>{formatCurrency(potentialSavings)}</span>
                <span className="kpi-subtext">OP + One-Time open</span>
              </div>
            </div>
            <div className="kpi-widget">
              <div className="kpi-details">
                <span className="kpi-title">Potential OP</span>
                <span className="kpi-value">{formatCurrency(potentialOp)}</span>
                <span className="kpi-subtext">OP contributions pipeline</span>
              </div>
            </div>
            <div className="kpi-widget">
              <div className="kpi-details">
                <span className="kpi-title">Potential One Time Savings</span>
                <span className="kpi-value">{formatCurrency(potentialOneTime)}</span>
                <span className="kpi-subtext">One-time pipeline savings</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '20px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ⚙️ Operational Impact (Potential Informational)
          </span>
          <div className="kpi-grid" style={{ marginTop: '8px', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <div className="kpi-widget" style={{ backgroundColor: '#F9FAFB', borderLeft: '4px solid #6B7280' }}>
              <div className="kpi-details">
                <span className="kpi-title">Potential Soft Savings</span>
                <span className="kpi-value">{formatCurrency(potentialSoft)}</span>
                <span className="kpi-subtext">Soft pipeline savings</span>
              </div>
            </div>
            <div className="kpi-widget" style={{ backgroundColor: '#F9FAFB', borderLeft: '4px solid #6B7280' }}>
              <div className="kpi-details">
                <span className="kpi-title">Potential Inventory Savings</span>
                <span className="kpi-value">{formatCurrency(potentialInventory)}</span>
                <span className="kpi-subtext">Inventory pipeline reduction</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '20px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0284C7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            👥 Productivity Impact (Potential Non-Financial)
          </span>
          <div className="kpi-grid" style={{ marginTop: '8px', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <div className="kpi-widget" style={{ backgroundColor: '#F0F9FF', borderLeft: '4px solid #0284C7' }}>
              <div className="kpi-details">
                <span className="kpi-title" style={{ color: '#0369A1' }}>Potential FTE Savings</span>
                <span className="kpi-value" style={{ color: '#0284C7' }}>{potentialFte.toFixed(1)} FTEs</span>
                <span className="kpi-subtext">FTE pipeline reductions</span>
              </div>
            </div>
          </div>
        </div>

        {/* Executive Savings Forecasting Gauge Card */}
        <div className="card" id="gauge-redesign" style={{ marginTop: '12px' }}>
          <div className="card-header-row">
            <span className="card-title">Savings Target Achievement Forecast ({fiscalYear} {quarter !== 'All' ? quarter : ''})</span>
            <button 
              onClick={() => exportChart('gauge-redesign', `Savings_Progress_Gauge_${fiscalYear}_${quarter}`)} 
              className="btn-export"
              title="Export Gauge"
            >
              <Download size={14} />
            </button>
          </div>

          <div className="gauge-header-details">
            <div className="gauge-kpi-item">
              <span className="gauge-kpi-lbl">Target Goal</span>
              <span className="gauge-kpi-val" style={{ color: '#EF4444' }}>{formatCurrency(annualTarget)}</span>
            </div>
            <div className="gauge-kpi-item">
              <span className="gauge-kpi-lbl">Approved Realized</span>
              <span className="gauge-kpi-val" style={{ color: '#10B981' }}>{formatCurrency(realizedSavings)}</span>
            </div>
            <div className="gauge-kpi-item">
              <span className="gauge-kpi-lbl">Open Potential</span>
              <span className="gauge-kpi-val" style={{ color: '#3B82F6' }}>{formatCurrency(potentialSavings)}</span>
            </div>
            <div className="gauge-kpi-item">
              <span className="gauge-kpi-lbl">Remaining Deficit</span>
              <span className="gauge-kpi-val" style={{ color: savingsGap > 0 ? '#EF4444' : '#10B981' }}>
                {savingsGap > 0 ? formatCurrency(savingsGap) : 'Achieved!'}
              </span>
            </div>
          </div>

          <div className="progress-gauge-container">
            <div 
              className="gauge-bar-realized" 
              style={{ width: `${realizedPercent}%` }}
              title={`Realized: ${formatCurrency(realizedSavings)} (${achievementPercent.toFixed(1)}%)`}
            >
              {realizedPercent > 8 ? `${achievementPercent.toFixed(0)}% Realized` : ''}
            </div>
            <div 
              className="gauge-bar-potential" 
              style={{ width: `${potentialPercent}%` }}
              title={`Potential: ${formatCurrency(potentialSavings)}`}
            >
              {potentialPercent > 8 ? `+${(forecastAchievementPercent - achievementPercent).toFixed(0)}% Pipeline` : ''}
            </div>
          </div>

          <div className="progress-gauge-markers">
            <div className="gauge-marker">
              <div className="gauge-marker-dot" />
              <span>0%</span>
            </div>
            <div className="gauge-marker" style={{ position: 'absolute', left: `${Math.min(95, realizedPercent)}%`, transform: 'translateX(-50%)' }}>
              <div className="gauge-marker-dot" style={{ backgroundColor: '#10B981' }} />
              <span>Realized</span>
            </div>
            {annualTarget > 0 && expectedFinalSavings < annualTarget ? (
              <div className="gauge-marker target" style={{ position: 'absolute', left: '100%' }}>
                <div className="gauge-marker-dot" />
                <span>Target (100%)</span>
              </div>
            ) : (
              <div className="gauge-marker target" style={{ position: 'absolute', left: `${(annualTarget / maxBarVal) * 100}%`, transform: 'translateX(-50%)' }}>
                <div className="gauge-marker-dot" />
                <span>Target (100%)</span>
              </div>
            )}
          </div>
        </div>

        {/* 4 Stacked Visualizations */}
        <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#1F2937', marginTop: '16px', display: 'block' }}>
          📊 Detailed Savings stacked Visualizations
        </span>
        <div className="dashboard-main-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))' }}>
          
          {/* Chart 1: Realized Savings by Type */}
          <div className="card" id="realized-type-card">
            <div className="card-header-row">
              <span className="card-title">Realized Savings by Type (Approved Month Trend)</span>
              <button onClick={() => exportChart('realized-type-card', `Realized_Savings_by_Type_${fiscalYear}`)} className="btn-export">
                <Download size={14} />
              </button>
            </div>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={realizedByTypeData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" stroke="#6B7280" tickLine={false} />
                  <YAxis stroke="#6B7280" tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  <Legend />
                  <Bar dataKey="OP Contribution" fill="#22C55E" stackId="realized" />
                  <Bar dataKey="Soft Savings" fill="#3B82F6" stackId="realized" />
                  <Bar dataKey="Inventory Savings" fill="#EAB308" stackId="realized" />
                  <Bar dataKey="One Time Savings" fill="#EC4899" stackId="realized" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Potential Savings by Type */}
          <div className="card" id="potential-type-card">
            <div className="card-header-row">
              <span className="card-title">Potential Savings by Type (Open Month Trend)</span>
              <button onClick={() => exportChart('potential-type-card', `Potential_Savings_by_Type_${fiscalYear}`)} className="btn-export">
                <Download size={14} />
              </button>
            </div>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={potentialByTypeData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" stroke="#6B7280" tickLine={false} />
                  <YAxis stroke="#6B7280" tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  <Legend />
                  <Bar dataKey="OP Contribution" fill="#86EFAC" stackId="potential" />
                  <Bar dataKey="Soft Savings" fill="#93C5FD" stackId="potential" />
                  <Bar dataKey="Inventory Savings" fill="#FEF08A" stackId="potential" />
                  <Bar dataKey="One Time Savings" fill="#FBCFE8" stackId="potential" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: Savings by Quarter */}
          <div className="card" id="quarterly-savings-card">
            <div className="card-header-row">
              <span className="card-title">Savings by Quarter ({fiscalYear})</span>
              <button onClick={() => exportChart('quarterly-savings-card', `Savings_by_Quarter_${fiscalYear}`)} className="btn-export">
                <Download size={14} />
              </button>
            </div>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={quarterlySavingsData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" stroke="#6B7280" tickLine={false} />
                  <YAxis stroke="#6B7280" tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  <Legend />
                  <Bar dataKey="Target" fill="#1F2937" name="Target Goal" />
                  <Bar dataKey="Approved Realized" fill="#22C55E" name="Approved Realized" />
                  <Bar dataKey="Open Potential" fill="#86EFAC" name="Open Potential" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 4: Savings by FY */}
          <div className="card" id="yearly-savings-card">
            <div className="card-header-row">
              <span className="card-title">Savings by FY Comparison</span>
              <button onClick={() => exportChart('yearly-savings-card', `Savings_by_FY`)} className="btn-export">
                <Download size={14} />
              </button>
            </div>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yearlySavingsData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" stroke="#6B7280" tickLine={false} />
                  <YAxis stroke="#6B7280" tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  <Legend />
                  <Bar dataKey="Target" fill="#1F2937" name="Target Goal" />
                  <Bar dataKey="Approved Realized" fill="#22C55E" name="Approved Realized" />
                  <Bar dataKey="Open Potential" fill="#86EFAC" name="Open Potential" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
