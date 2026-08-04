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
import { dbService, getFyDisplayLabel, getProjectPeriodSavings } from '../lib/supabaseClient';
import type { ProjectApproved, ProjectOpen } from '../lib/supabaseClient';

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(val);
};

interface FacilitatorRow {
  facilitator: string;
  approvedSavings: number;
  potentialSavings: number;
  totalSavingsManaged: number;
  projectsClosed: number;
  projectsOpen: number;
}

export const Facilitators: React.FC = () => {
  const [fiscalYear, setFiscalYear] = useState<string>('FY26');
  const [fiscalYears, setFiscalYears] = useState<any[]>([]);
  const [approvedProjects, setApprovedProjects] = useState<ProjectApproved[]>([]);
  const [openProjects, setOpenProjects] = useState<ProjectOpen[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [approved, open, fyList] = await Promise.all([
        dbService.getProjectsApproved(),
        dbService.getProjectsOpen(),
        dbService.getFiscalYears()
      ]);
      setApprovedProjects(approved);
      setOpenProjects(open);
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

    // Filter by fiscal year
    const approvedFiltered = approvedProjects.filter(p => p.fiscal_year === fiscalYear);
    const openFiltered = openProjects.filter(p => p.fiscal_year === fiscalYear);

    // Aggregate Approved
    approvedFiltered.forEach(p => {
      const name = p.facilitator || 'Unassigned';
      const savings = getProjectPeriodSavings(p, 11);
      
      if (!facilitatorsMap[name]) {
        facilitatorsMap[name] = {
          approvedSavings: 0,
          potentialSavings: 0,
          totalSavingsManaged: 0,
          projectsClosed: 0,
          projectsOpen: 0
        };
      }
      facilitatorsMap[name].approvedSavings += savings;
      facilitatorsMap[name].totalSavingsManaged += savings;
      facilitatorsMap[name].projectsClosed += 1;
    });

    // Aggregate Open
    openFiltered.forEach(p => {
      const name = p.facilitator || 'Unassigned';
      const savings = getProjectPeriodSavings(p, 11);
      
      if (!facilitatorsMap[name]) {
        facilitatorsMap[name] = {
          approvedSavings: 0,
          potentialSavings: 0,
          totalSavingsManaged: 0,
          projectsClosed: 0,
          projectsOpen: 0
        };
      }
      facilitatorsMap[name].potentialSavings += savings;
      facilitatorsMap[name].totalSavingsManaged += savings;
      facilitatorsMap[name].projectsOpen += 1;
    });

    // Convert map to array
    return Object.keys(facilitatorsMap).map(name => ({
      facilitator: name,
      ...facilitatorsMap[name]
    })).sort((a, b) => b.totalSavingsManaged - a.totalSavingsManaged);
  };

  const rankings = getFacilitatorRankings();
  const top10Facilitators = rankings.slice(0, 10);

  // Excel Export Ranking Table
  const handleExportExcel = () => {
    const dataToExport = rankings.map((r, idx) => ({
      'Rank': idx + 1,
      'Facilitator': r.facilitator,
      'Approved Savings ($)': r.approvedSavings,
      'Potential Savings ($)': r.potentialSavings,
      'Total Savings Managed ($)': r.totalSavingsManaged,
      'Projects Closed': r.projectsClosed,
      'Projects Open': r.projectsOpen
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Facilitator Ranking');
    
    // Auto fit column widths
    worksheet['!cols'] = Array(7).fill({ wch: 18 });

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
            Top 10 Facilitators - Savings Managed (Approved vs. Potential)
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
                <Bar dataKey="approvedSavings" name="Approved Realized" fill="#006B78" stackId="savings" />
                <Bar dataKey="potentialSavings" name="Potential Open" fill="#4FC3D7" stackId="savings" />
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
            Sorted by Total Managed Savings
          </div>
        </div>

        {rankings.length > 0 ? (
          <div className="table-container">
            <table className="executive-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Rank</th>
                  <th>Facilitator Name</th>
                  <th>Approved Savings</th>
                  <th>Potential Savings</th>
                  <th>Total Managed Savings</th>
                  <th style={{ textAlign: 'center' }}>Projects Closed</th>
                  <th style={{ textAlign: 'center' }}>Projects Open</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((r, idx) => (
                  <tr key={r.facilitator}>
                    <td style={{ fontWeight: 800, color: idx === 0 ? '#D97706' : idx === 1 ? '#4B5563' : idx === 2 ? '#B45309' : '#9CA3AF' }}>
                      {idx === 0 ? '🏆 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : idx + 1}
                    </td>
                    <td style={{ fontWeight: 600, color: '#111827' }}>{r.facilitator}</td>
                    <td style={{ color: '#009AAD', fontWeight: 600 }}>{formatCurrency(r.approvedSavings)}</td>
                    <td style={{ color: '#2563EB', fontWeight: 600 }}>{formatCurrency(r.potentialSavings)}</td>
                    <td style={{ color: '#111827', fontWeight: 700 }}>{formatCurrency(r.totalSavingsManaged)}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{r.projectsClosed}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{r.projectsOpen}</td>
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
