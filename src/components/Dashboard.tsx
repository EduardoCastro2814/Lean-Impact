import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Target, 
  Percent, 
  Activity, 
  Download,
  Layers,
  Award,
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
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine
} from 'recharts';
import html2canvas from 'html2canvas';
import { dbService } from '../lib/supabaseClient';
import type { ProjectApproved, ProjectOpen, SavingsTarget } from '../lib/supabaseClient';

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(val);
};

export const Dashboard: React.FC = () => {
  const [fiscalYear, setFiscalYear] = useState<number>(2026);
  const [approvedProjects, setApprovedProjects] = useState<ProjectApproved[]>([]);
  const [openProjects, setOpenProjects] = useState<ProjectOpen[]>([]);
  const [targets, setTargets] = useState<SavingsTarget[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [approved, open, targetList] = await Promise.all([
        dbService.getProjectsApproved(),
        dbService.getProjectsOpen(),
        dbService.getSavingsTargets()
      ]);
      setApprovedProjects(approved);
      setOpenProjects(open);
      setTargets(targetList);
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

  const getProjectYear = (dateStr: string | null): number => {
    if (!dateStr) return 0;
    return new Date(dateStr).getFullYear();
  };

  // Filter
  const approvedFiltered = approvedProjects.filter(p => getProjectYear(p.approval_date) === fiscalYear);
  const openFiltered = openProjects.filter(p => {
    const year = p.completion_date ? getProjectYear(p.completion_date) : getProjectYear(p.created_date);
    return year === fiscalYear;
  });

  // 1. Annual Savings Target
  const yearTargets = targets.filter(t => t.fiscal_year === fiscalYear);
  const annualTarget = yearTargets.reduce((sum, t) => sum + t.target_amount, 0);

  // 2. Realized Savings
  const realizedSavings = approvedFiltered.reduce((sum, p) => {
    return sum + (p.op_contribution + p.soft_savings + p.inventory_savings + p.one_time_savings);
  }, 0);

  // 3. Potential Savings
  const potentialSavings = openFiltered.reduce((sum, p) => {
    return sum + (p.op_contribution + p.soft_savings + p.inventory_savings + p.one_time_savings);
  }, 0);

  const expectedFinalSavings = realizedSavings + potentialSavings;

  // 4. Achievement %
  const achievementPercent = annualTarget > 0 ? (realizedSavings / annualTarget) * 100 : 0;

  // 5. Forecast Achievement %
  const forecastAchievementPercent = annualTarget > 0 ? (expectedFinalSavings / annualTarget) * 100 : 0;

  // 6. Savings Gap
  const rawGap = annualTarget - realizedSavings;
  const savingsGap = rawGap > 0 ? rawGap : 0;

  // 7. Open Projects Count
  const openCount = openFiltered.length;

  // 8. Approved Projects Count
  const approvedCount = approvedFiltered.length;

  // Visual Progress Gauge metrics
  const maxBarVal = Math.max(annualTarget, expectedFinalSavings);
  const realizedPercent = maxBarVal > 0 ? (realizedSavings / maxBarVal) * 100 : 0;
  const potentialPercent = maxBarVal > 0 ? (potentialSavings / maxBarVal) * 100 : 0;

  // Visual Forecast progression metrics
  const forecastChartData = [
    {
      name: 'Forecast Year',
      'Approved Savings': realizedSavings,
      'Potential Savings': potentialSavings,
      'Remaining Gap': Math.max(0, annualTarget - expectedFinalSavings)
    }
  ];

  // Monthly Savings Trend
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyTrendData = months.map((month, idx) => {
    const approvedInMonth = approvedFiltered.filter(p => new Date(p.approval_date).getMonth() === idx);
    const approvedSum = approvedInMonth.reduce((sum, p) => sum + (p.op_contribution + p.soft_savings + p.inventory_savings + p.one_time_savings), 0);
    return {
      name: month,
      Savings: approvedSum
    };
  });

  // Savings by Workshop
  const workshopMap: Record<string, number> = {};
  approvedFiltered.forEach(p => {
    const ws = p.workshop || 'Unspecified';
    const savings = p.op_contribution + p.soft_savings + p.inventory_savings + p.one_time_savings;
    workshopMap[ws] = (workshopMap[ws] || 0) + savings;
  });
  const workshopData = Object.keys(workshopMap).map(key => ({
    name: key,
    Savings: workshopMap[key]
  })).sort((a, b) => b.Savings - a.Savings);

  // Top 10 Facilitators
  const facilitatorsMap: Record<string, { approved: number; potential: number; total: number }> = {};
  approvedFiltered.forEach(p => {
    const name = p.facilitator || 'Unassigned';
    const savings = p.op_contribution + p.soft_savings + p.inventory_savings + p.one_time_savings;
    if (!facilitatorsMap[name]) facilitatorsMap[name] = { approved: 0, potential: 0, total: 0 };
    facilitatorsMap[name].approved += savings;
    facilitatorsMap[name].total += savings;
  });
  openFiltered.forEach(p => {
    const name = p.facilitator || 'Unassigned';
    const savings = p.op_contribution + p.soft_savings + p.inventory_savings + p.one_time_savings;
    if (!facilitatorsMap[name]) facilitatorsMap[name] = { approved: 0, potential: 0, total: 0 };
    facilitatorsMap[name].potential += savings;
    facilitatorsMap[name].total += savings;
  });
  const facilitatorRankData = Object.keys(facilitatorsMap).map(name => ({
    name,
    Approved: facilitatorsMap[name].approved,
    Potential: facilitatorsMap[name].potential,
    Total: facilitatorsMap[name].total
  })).sort((a, b) => b.Total - a.Total).slice(0, 10);

  // Top 10 Projects
  const projectRankData = approvedFiltered.map(p => {
    const savings = p.op_contribution + p.soft_savings + p.inventory_savings + p.one_time_savings;
    return {
      name: p.project_id,
      title: p.project_title,
      Savings: savings
    };
  }).sort((a, b) => b.Savings - a.Savings).slice(0, 10);

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
        <div className="filter-group" style={{ minWidth: '160px', flexGrow: 0 }}>
          <label className="filter-label">Select Fiscal Year</label>
          <select 
            className="filter-select"
            value={fiscalYear} 
            onChange={(e) => setFiscalYear(Number(e.target.value))}
          >
            <option value={2026}>2026 Fiscal Year</option>
            <option value={2027}>2027 Fiscal Year</option>
          </select>
        </div>
        <div style={{ flexGrow: 1 }} />
        <button 
          onClick={() => exportChart('dashboard-redesign-container', `Lean_Impact_Dashboard_FY${fiscalYear}`)} 
          className="btn-export btn-export-primary"
        >
          <Download size={16} />
          <span>Export Executive Report</span>
        </button>
      </div>

      <div id="dashboard-redesign-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* 8 KPIs Grid */}
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          
          <div className="kpi-widget">
            <div className="kpi-details">
              <span className="kpi-title">Annual Savings Target</span>
              <span className="kpi-value">{formatCurrency(annualTarget)}</span>
              <span className="kpi-subtext">Program goal targets</span>
            </div>
            <div className="kpi-icon-container" style={{ backgroundColor: '#F3F4F6', color: '#1F2937' }}>
              <Target size={20} />
            </div>
          </div>

          <div className="kpi-widget">
            <div className="kpi-details">
              <span className="kpi-title">Realized Savings</span>
              <span className="kpi-value" style={{ color: '#16A34A' }}>{formatCurrency(realizedSavings)}</span>
              <span className="kpi-subtext">Approved closed projects</span>
            </div>
            <div className="kpi-icon-container" style={{ backgroundColor: '#DCFCE7', color: '#16A34A' }}>
              <DollarSign size={20} />
            </div>
          </div>

          <div className="kpi-widget">
            <div className="kpi-details">
              <span className="kpi-title">Potential Savings</span>
              <span className="kpi-value" style={{ color: '#2563EB' }}>{formatCurrency(potentialSavings)}</span>
              <span className="kpi-subtext">Pipeline open projects</span>
            </div>
            <div className="kpi-icon-container" style={{ backgroundColor: '#DBEAFE', color: '#2563EB' }}>
              <TrendingUp size={20} />
            </div>
          </div>

          <div className="kpi-widget">
            <div className="kpi-details">
              <span className="kpi-title">Achievement %</span>
              <span className="kpi-value">{achievementPercent.toFixed(1)}%</span>
              <span className="kpi-subtext">Realized vs. Target</span>
            </div>
            <div className="kpi-icon-container" style={{ backgroundColor: '#F3E8FF', color: '#7C3AED' }}>
              <Percent size={20} />
            </div>
          </div>

          <div className="kpi-widget">
            <div className="kpi-details">
              <span className="kpi-title">Forecast Achievement %</span>
              <span className="kpi-value" style={{ color: '#15803D' }}>{forecastAchievementPercent.toFixed(1)}%</span>
              <span className="kpi-subtext">Realized + Potential vs Target</span>
            </div>
            <div className="kpi-icon-container" style={{ backgroundColor: '#D1FAE5', color: '#15803D' }}>
              <Percent size={20} />
            </div>
          </div>

          <div className="kpi-widget">
            <div className="kpi-details">
              <span className="kpi-title">Savings Gap</span>
              <span className="kpi-value" style={{ color: savingsGap > 0 ? '#EF4444' : '#16A34A' }}>
                {formatCurrency(savingsGap)}
              </span>
              <span className="kpi-subtext">{savingsGap > 0 ? 'Remaining deficit' : 'Target Achieved'}</span>
            </div>
            <div 
              className="kpi-icon-container" 
              style={{ 
                backgroundColor: savingsGap > 0 ? '#FEE2E2' : '#DCFCE7', 
                color: savingsGap > 0 ? '#EF4444' : '#16A34A' 
              }}
            >
              {savingsGap > 0 ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
            </div>
          </div>

          <div className="kpi-widget">
            <div className="kpi-details">
              <span className="kpi-title">Approved Projects</span>
              <span className="kpi-value">{approvedCount}</span>
              <span className="kpi-subtext">Projects successfully closed</span>
            </div>
            <div className="kpi-icon-container" style={{ backgroundColor: '#E0F2FE', color: '#0369A1' }}>
              <Briefcase size={20} />
            </div>
          </div>

          <div className="kpi-widget">
            <div className="kpi-details">
              <span className="kpi-title">Open Projects</span>
              <span className="kpi-value">{openCount}</span>
              <span className="kpi-subtext">Projects in pipeline</span>
            </div>
            <div className="kpi-icon-container" style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}>
              <Activity size={20} />
            </div>
          </div>

        </div>

        {/* Chart 1: Savings Progress Gauge */}
        <div className="card gauge-card" id="gauge-redesign">
          <div className="card-header-row" style={{ marginBottom: '16px' }}>
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} className="text-primary" />
              Savings Progress Gauge
            </span>
            <button 
              onClick={() => exportChart('gauge-redesign', `Savings_Progress_Gauge_FY${fiscalYear}`)} 
              className="btn-export"
              title="Export Gauge"
            >
              <Download size={14} />
            </button>
          </div>

          <div className="gauge-header-details">
            <div className="gauge-kpi-item">
              <span className="gauge-kpi-lbl">Total Annual Target</span>
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
              <span className="gauge-kpi-lbl">Remaining Gap</span>
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

        {/* Redesigned Charts Grid */}
        <div className="dashboard-main-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))' }}>
          
          {/* Chart 2: Annual Forecast */}
          <div className="card" id="forecast-card-view">
            <div className="card-header-row">
              <span className="card-title">Annual Forecast</span>
              <button onClick={() => exportChart('forecast-card-view', `Annual_Forecast_FY${fiscalYear}`)} className="btn-export">
                <Download size={14} />
              </button>
            </div>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={forecastChartData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" stroke="#6B7280" tickLine={false} />
                  <YAxis stroke="#6B7280" tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  <Legend />
                  <Bar dataKey="Approved Savings" fill="#22C55E" stackId="s" name="Approved Realized" />
                  <Bar dataKey="Potential Savings" fill="#86EFAC" stackId="s" name="Open Potential" />
                  <Bar dataKey="Remaining Gap" fill="#EF4444" stackId="s" name="Deficit Gap" opacity={0.8} />
                  <ReferenceLine y={annualTarget} stroke="#1F2937" strokeWidth={2} strokeDasharray="5 5" label={{ value: 'Annual Target', position: 'top', fill: '#1F2937', fontWeight: 600 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: Monthly Savings Trend */}
          <div className="card" id="trend-card-view">
            <div className="card-header-row">
              <span className="card-title">Monthly Savings Trend (Approved)</span>
              <button onClick={() => exportChart('trend-card-view', `Monthly_Savings_Trend_FY${fiscalYear}`)} className="btn-export">
                <Download size={14} />
              </button>
            </div>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" stroke="#6B7280" tickLine={false} />
                  <YAxis stroke="#6B7280" tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                  <Tooltip formatter={(value) => [formatCurrency(value as number), 'Approved Savings']} />
                  <Line type="monotone" dataKey="Savings" stroke="#22C55E" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 4: Savings by Workshop */}
          <div className="card" id="workshop-card-view">
            <div className="card-header-row">
              <span className="card-title">Savings by Workshop (Approved)</span>
              <button onClick={() => exportChart('workshop-card-view', `Savings_by_Workshop_FY${fiscalYear}`)} className="btn-export">
                <Download size={14} />
              </button>
            </div>
            <div style={{ width: '100%', height: 300 }}>
              {workshopData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={workshopData.slice(0, 8)} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="name" stroke="#6B7280" tickLine={false} />
                    <YAxis stroke="#6B7280" tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    <Bar dataKey="Savings" fill="#22C55E" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6B7280' }}>
                  <Layers size={36} style={{ marginBottom: '8px' }} />
                  <span style={{ fontSize: '0.85rem' }}>No data available</span>
                </div>
              )}
            </div>
          </div>

          {/* Chart 5: Top 10 Facilitators */}
          <div className="card" id="facilitators-card-view">
            <div className="card-header-row">
              <span className="card-title">Top 10 Facilitators (Savings Managed)</span>
              <button onClick={() => exportChart('facilitators-card-view', `Top_10_Facilitators_FY${fiscalYear}`)} className="btn-export">
                <Download size={14} />
              </button>
            </div>
            <div style={{ width: '100%', height: 300 }}>
              {facilitatorRankData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={facilitatorRankData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="name" stroke="#6B7280" tickLine={false} />
                    <YAxis stroke="#6B7280" tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    <Legend />
                    <Bar dataKey="Approved" name="Approved Realized" fill="#22C55E" stackId="fac" />
                    <Bar dataKey="Potential" name="Potential Open" fill="#86EFAC" stackId="fac" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6B7280' }}>
                  <Award size={36} style={{ marginBottom: '8px' }} />
                  <span style={{ fontSize: '0.85rem' }}>No data available</span>
                </div>
              )}
            </div>
          </div>

          {/* Chart 6: Top 10 Projects */}
          <div className="card" id="projects-card-view" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header-row">
              <span className="card-title">Top 10 Approved Projects by Total Savings</span>
              <button onClick={() => exportChart('projects-card-view', `Top_10_Projects_FY${fiscalYear}`)} className="btn-export">
                <Download size={14} />
              </button>
            </div>
            <div style={{ width: '100%', height: 350 }}>
              {projectRankData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={projectRankData} margin={{ top: 10, right: 10, left: 30, bottom: 5 }} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                    <XAxis type="number" stroke="#6B7280" tickLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                    <YAxis dataKey="name" type="category" stroke="#6B7280" tickLine={false} width={100} />
                    <Tooltip 
                      formatter={(value) => formatCurrency(value as number)}
                      labelFormatter={(label) => {
                        const project = projectRankData.find(p => p.name === label);
                        return project ? `${project.name}: ${project.title}` : label;
                      }}
                    />
                    <Bar dataKey="Savings" name="Total Savings" fill="#22C55E" radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6B7280' }}>
                  <Briefcase size={36} style={{ marginBottom: '8px' }} />
                  <span style={{ fontSize: '0.85rem' }}>No approved project data available</span>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
