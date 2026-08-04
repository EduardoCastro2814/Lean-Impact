import React, { useEffect, useState } from 'react';
import { 
  Download, 
  Users, 
  Award
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
import * as XLSX from 'xlsx';
import { dbService, getFyDisplayLabel, getFiscalMonthIndex } from '../lib/supabaseClient';
import type { ProjectApproved } from '../lib/supabaseClient';

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(val);
};

interface FacilitatorRow {
  facilitator: string;
  approvedProjectsCount: number;
  opContribution: number;
  oneTimeSavings: number;
  qualifiedSavings: number;
}

export const Facilitators: React.FC = () => {
  const [fiscalYear, setFiscalYear] = useState<string>('FY26');
  const [fiscalYears, setFiscalYears] = useState<any[]>([]);
  const [approvedProjects, setApprovedProjects] = useState<ProjectApproved[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [approved, fyList] = await Promise.all([
        dbService.getProjectsApproved(),
        dbService.getFiscalYears()
      ]);
      setApprovedProjects(approved);
      setFiscalYears(fyList);

      const activeFy = fyList.find(fy => fy.active);
      if (activeFy) {
        setFiscalYear(activeFy.fiscal_year);
      } else if (fyList.length > 0) {
        setFiscalYear(fyList[0].fiscal_year);
      }
    } catch (e) {
      console.error('Error loading facilitators data', e);
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

  // Process data to generate rankings
  const getFacilitatorRankings = (): FacilitatorRow[] => {
    const facilitatorsMap: Record<string, Omit<FacilitatorRow, 'facilitator'>> = {};

    // Filter approved projects by fiscal year
    const approvedFiltered = approvedProjects.filter(p => p.fiscal_year === fiscalYear);

    // Aggregate Approved Projects
    approvedFiltered.forEach(p => {
      const name = p.facilitator || 'Unassigned';
      const mProj = getFiscalMonthIndex(p.approval_date || p.created_at);
      const opContributionVal = p.op_contribution * (12 - mProj);
      const oneTimeSavingsVal = p.one_time_savings || 0;
      const qualifiedSavingsVal = opContributionVal + oneTimeSavingsVal;
      
      if (!facilitatorsMap[name]) {
        facilitatorsMap[name] = {
          approvedProjectsCount: 0,
          opContribution: 0,
          oneTimeSavings: 0,
          qualifiedSavings: 0
        };
      }
      facilitatorsMap[name].approvedProjectsCount += 1;
      facilitatorsMap[name].opContribution += opContributionVal;
      facilitatorsMap[name].oneTimeSavings += oneTimeSavingsVal;
      facilitatorsMap[name].qualifiedSavings += qualifiedSavingsVal;
    });

    // Convert map to array and sort by qualifiedSavings desc
    return Object.keys(facilitatorsMap).map(name => ({
      facilitator: name,
      ...facilitatorsMap[name]
    })).sort((a, b) => b.qualifiedSavings - a.qualifiedSavings);
  };

  const rankings = getFacilitatorRankings();
  const top10Facilitators = rankings.slice(0, 10);

  // Excel Export Ranking Table
  const handleExportExcel = () => {
    const dataToExport = rankings.map((r, idx) => ({
      'Rank': idx + 1,
      'Facilitator': r.facilitator,
      'Approved Projects': r.approvedProjectsCount,
      'OP Contribution ($)': r.opContribution,
      'One Time Savings ($)': r.oneTimeSavings,
      'Qualified Savings ($)': r.qualifiedSavings
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Facilitator Ranking');
    
    // Auto fit column widths
    worksheet['!cols'] = Array(6).fill({ wch: 18 });

    XLSX.writeFile(workbook, `Lean_Impact_Facilitator_Rankings_FY${fiscalYear}.xlsx`);
  };

  // PNG Chart Export
  const exportChartPng = (id: string, fileName: string) => {
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
        <div className="skeleton-loading skeleton-chart" style={{ height: '300px' }} />
        <div className="skeleton-loading skeleton-table-row" style={{ height: '240px' }} />
      </div>
    );
  }

  return (
    <div className="view-container">
      {/* Top Filter and Actions Row */}
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
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleExportExcel} className="btn-export">
            <Download size={16} />
            <span>Export Rankings to Excel</span>
          </button>
        </div>
      </div>

      {/* Chart Section */}
      <div className="card" id="facilitator-top-chart" style={{ padding: '28px' }}>
        <div className="card-header-row">
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={20} className="text-primary" />
            Top 10 Facilitators - Approved Savings (OP vs. One-Time)
          </span>
          <button 
            onClick={() => exportChartPng('facilitator-top-chart', `Top_Facilitators_Chart_FY${fiscalYear}`)} 
            className="btn-export"
            title="Export Chart as PNG"
          >
            <Download size={14} />
          </button>
        </div>

        <div style={{ width: '100%', height: 350, marginTop: '16px' }}>
          {top10Facilitators.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top10Facilitators} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="facilitator" stroke="#6B7280" tickLine={false} />
                <YAxis stroke="#6B7280" tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Legend />
                <Bar dataKey="opContribution" name="OP Contribution" fill="#009AAD" stackId="savings" />
                <Bar dataKey="oneTimeSavings" name="One-Time Savings" fill="#00B7CC" stackId="savings" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6B7280' }}>
              <Users size={40} style={{ marginBottom: '8px', color: '#9CA3AF' }} />
              <span style={{ fontSize: '0.85rem' }}>No project data available for {fiscalYear.startsWith('FY') ? fiscalYear : `FY${fiscalYear}`}</span>
            </div>
          )}
        </div>
      </div>

      {/* Rankings Table Card */}
      <div className="card">
        <div className="card-header-row" style={{ marginBottom: '16px' }}>
          <span className="card-title">Facilitator Performance Leaderboard</span>
          <div style={{ fontSize: '0.85rem', color: '#6B7280' }}>
            Sorted by Qualified Savings (OP + One-Time)
          </div>
        </div>

        {rankings.length > 0 ? (
          <div className="table-container">
            <table className="executive-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Rank</th>
                  <th>Facilitator Name</th>
                  <th style={{ textAlign: 'center' }}>Approved Projects</th>
                  <th style={{ textAlign: 'right' }}>OP Contribution</th>
                  <th style={{ textAlign: 'right' }}>One Time Savings</th>
                  <th style={{ textAlign: 'right' }}>Qualified Savings</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((r, idx) => (
                  <tr key={r.facilitator}>
                    <td style={{ fontWeight: 800, color: idx === 0 ? '#D97706' : idx === 1 ? '#4B5563' : idx === 2 ? '#B45309' : '#9CA3AF' }}>
                      {idx === 0 ? '🏆 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : idx + 1}
                    </td>
                    <td style={{ fontWeight: 600, color: '#111827' }}>{r.facilitator}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{r.approvedProjectsCount}</td>
                    <td style={{ textAlign: 'right', color: '#009AAD', fontWeight: 600 }}>{formatCurrency(r.opContribution)}</td>
                    <td style={{ textAlign: 'right', color: '#00B7CC', fontWeight: 600 }}>{formatCurrency(r.oneTimeSavings)}</td>
                    <td style={{ textAlign: 'right', color: '#111827', fontWeight: 700 }}>{formatCurrency(r.qualifiedSavings)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
            <Users size={32} style={{ margin: '0 auto 8px', display: 'block', color: '#9CA3AF' }} />
            <span>No data available to generate leaderboard</span>
          </div>
        )}
      </div>
    </div>
  );
};
