import React, { useEffect, useState } from 'react';
import { 
  Download, 
  Search, 
  Eye, 
  X, 
  Calendar,
  User,
  Briefcase,
  Maximize2,
  Minimize2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { dbService, getProjectPeriodSavings, getFiscalMonthIndex } from '../lib/supabaseClient';
import type { ProjectApproved, ProjectOpen } from '../lib/supabaseClient';

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(val);
};

const getProjectSingleMonthSavings = (p: any, m: number): number => {
  const dateStr = p.approval_date || p.created_date;
  if (!dateStr) return 0;
  const mProj = getFiscalMonthIndex(dateStr);
  if (mProj !== m) return 0;
  return Number(p.op_contribution) * (12 - mProj) + Number(p.one_time_savings);
};

export const Projects: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'approved' | 'open'>('approved');
  const [approvedProjects, setApprovedProjects] = useState<ProjectApproved[]>([]);
  const [openProjects, setOpenProjects] = useState<ProjectOpen[]>([]);
  const [loading, setLoading] = useState(true);
  const [fiscalYear, setFiscalYear] = useState('FY27');
  const [fiscalYears, setFiscalYears] = useState<any[]>([]);

  // Selected Project for details modal
  const [selectedProject, setSelectedProject] = useState<ProjectApproved | ProjectOpen | null>(null);
  
  // Table expansion state
  const [isExpanded, setIsExpanded] = useState(false);

  // Filter states
  const [filterWorkshop, setFilterWorkshop] = useState('');
  const [filterFacilitator, setFilterFacilitator] = useState('');
  const [filterLeader, setFilterLeader] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterMonth, setFilterMonth] = useState(''); // 0-11 as string, or ''

  // Search query
  const [searchQuery, setSearchQuery] = useState('');

  // Synchronized horizontal scrollbars
  const topScrollRef = React.useRef<HTMLDivElement>(null);
  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState(0);

  const expandedTopScrollRef = React.useRef<HTMLDivElement>(null);
  const expandedTableContainerRef = React.useRef<HTMLDivElement>(null);
  const [expandedScrollWidth, setExpandedScrollWidth] = useState(0);

  const syncScrollTable = (e: any) => {
    const target = e.target;
    if (topScrollRef.current && Math.abs(topScrollRef.current.scrollLeft - target.scrollLeft) > 1) {
      topScrollRef.current.scrollLeft = target.scrollLeft;
    }
  };

  const syncScrollTop = (e: any) => {
    const target = e.target;
    if (tableContainerRef.current && Math.abs(tableContainerRef.current.scrollLeft - target.scrollLeft) > 1) {
      tableContainerRef.current.scrollLeft = target.scrollLeft;
    }
  };

  const syncScrollExpandedTable = (e: any) => {
    const target = e.target;
    if (expandedTopScrollRef.current && Math.abs(expandedTopScrollRef.current.scrollLeft - target.scrollLeft) > 1) {
      expandedTopScrollRef.current.scrollLeft = target.scrollLeft;
    }
  };

  const syncScrollExpandedTop = (e: any) => {
    const target = e.target;
    if (expandedTableContainerRef.current && Math.abs(expandedTableContainerRef.current.scrollLeft - target.scrollLeft) > 1) {
      expandedTableContainerRef.current.scrollLeft = target.scrollLeft;
    }
  };

  useEffect(() => {
    if (loading) return;
    const updateWidth = () => {
      if (tableContainerRef.current) {
        setScrollWidth(tableContainerRef.current.scrollWidth);
      }
    };
    const timer = setTimeout(updateWidth, 100);
    window.addEventListener('resize', updateWidth);
    
    let observer: ResizeObserver | null = null;
    if (tableContainerRef.current) {
      observer = new ResizeObserver(updateWidth);
      observer.observe(tableContainerRef.current);
    }
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateWidth);
      if (observer) observer.disconnect();
    };
  }, [loading, activeTab, approvedProjects, openProjects]);

  useEffect(() => {
    if (!isExpanded) return;
    const updateWidth = () => {
      if (expandedTableContainerRef.current) {
        setExpandedScrollWidth(expandedTableContainerRef.current.scrollWidth);
      }
    };
    const timer = setTimeout(updateWidth, 100);
    window.addEventListener('resize', updateWidth);
    
    let observer: ResizeObserver | null = null;
    if (expandedTableContainerRef.current) {
      observer = new ResizeObserver(updateWidth);
      observer.observe(expandedTableContainerRef.current);
    }
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateWidth);
      if (observer) observer.disconnect();
    };
  }, [isExpanded, activeTab, approvedProjects, openProjects]);

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

      // Default to active fiscal year
      const activeFy = fyList.find(fy => fy.active);
      if (activeFy) {
        setFiscalYear(activeFy.fiscal_year);
      } else if (fyList.length > 0) {
        setFiscalYear(fyList[0].fiscal_year);
      }
    } catch (e) {
      console.error('Error loading projects', e);
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

  // Filter datasets by selected Fiscal Year first
  const activeDataset = (activeTab === 'approved' ? approvedProjects : openProjects)
    .filter(p => p.fiscal_year === fiscalYear);

  const workshops = Array.from(new Set(activeDataset.map(p => p.workshop))).filter(Boolean).sort();
  const facilitators = Array.from(new Set(activeDataset.map(p => p.facilitator))).filter(Boolean).sort();
  const leaders = Array.from(new Set(activeDataset.map(p => p.leader))).filter(Boolean).sort();
  const customers = Array.from(new Set(activeDataset.map(p => p.customer))).filter(Boolean).sort();
  const types = Array.from(new Set(activeDataset.map(p => p.project_type))).filter(Boolean).sort();

  const months = [
    { label: 'April', value: '0' },
    { label: 'May', value: '1' },
    { label: 'June', value: '2' },
    { label: 'July', value: '3' },
    { label: 'August', value: '4' },
    { label: 'September', value: '5' },
    { label: 'October', value: '6' },
    { label: 'November', value: '7' },
    { label: 'December', value: '8' },
    { label: 'January', value: '9' },
    { label: 'February', value: '10' },
    { label: 'March', value: '11' },
  ];

  // Filtering Logic
  const filteredProjects = (activeDataset as any[]).filter(p => {
    const matchesSearch = searchQuery === '' || 
      p.project_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.project_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.leader.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.facilitator.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.functional_area.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesWorkshop = filterWorkshop === '' || p.workshop === filterWorkshop;
    const matchesFacilitator = filterFacilitator === '' || p.facilitator === filterFacilitator;
    const matchesLeader = filterLeader === '' || p.leader === filterLeader;
    const matchesCustomer = filterCustomer === '' || p.customer === filterCustomer;
    const matchesType = filterType === '' || p.project_type === filterType;

    const dateStr = activeTab === 'approved' ? p.approval_date : (p.completion_date || p.created_date);
    const dateMonthIdx = dateStr ? getFiscalMonthIndex(dateStr).toString() : '';
    const matchesMonth = filterMonth === '' || dateMonthIdx === filterMonth;

    return matchesSearch && matchesWorkshop && matchesFacilitator && matchesLeader && matchesCustomer && matchesType && matchesMonth;
  });

  const projectsListWithRecon = filteredProjects;

  // Column Totals Calculations
  const totalOp = projectsListWithRecon.reduce((sum, p) => {
    const mProj = getFiscalMonthIndex(p.approval_date || p.created_date);
    return sum + Number(p.op_contribution || 0) * (12 - mProj);
  }, 0);
  const totalOt = projectsListWithRecon.reduce((sum, p) => sum + Number(p.one_time_savings || 0), 0);

  const getMonthlyTotal = (m: number) => {
    return projectsListWithRecon.reduce((sum, p) => sum + getProjectSingleMonthSavings(p, m), 0);
  };

  const getQuarterTotal = (q: string) => {
    const monthsForQ = q === 'Q1' ? [0, 1, 2] : q === 'Q2' ? [3, 4, 5] : q === 'Q3' ? [6, 7, 8] : [9, 10, 11];
    return monthsForQ.reduce((sum, m) => sum + getMonthlyTotal(m), 0);
  };

  const totalFyTotal = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].reduce((sum, m) => sum + getMonthlyTotal(m), 0);

  // Reset filters when switching tabs
  const handleTabChange = (tab: 'approved' | 'open') => {
    setActiveTab(tab);
    setFilterWorkshop('');
    setFilterFacilitator('');
    setFilterLeader('');
    setFilterCustomer('');
    setFilterType('');
    setFilterMonth('');
    setSearchQuery('');
  };

  // Export Table to Excel
  const handleExportExcel = () => {
    const dataToExport = projectsListWithRecon.map(p => {
      const apr = getProjectSingleMonthSavings(p, 0);
      const may = getProjectSingleMonthSavings(p, 1);
      const jun = getProjectSingleMonthSavings(p, 2);
      const q1 = apr + may + jun;
      const jul = getProjectSingleMonthSavings(p, 3);
      const aug = getProjectSingleMonthSavings(p, 4);
      const sep = getProjectSingleMonthSavings(p, 5);
      const q2 = jul + aug + sep;
      const oct = getProjectSingleMonthSavings(p, 6);
      const nov = getProjectSingleMonthSavings(p, 7);
      const dec = getProjectSingleMonthSavings(p, 8);
      const q3 = oct + nov + dec;
      const jan = getProjectSingleMonthSavings(p, 9);
      const feb = getProjectSingleMonthSavings(p, 10);
      const mar = getProjectSingleMonthSavings(p, 11);
      const q4 = jan + feb + mar;
      const fyTotal = q1 + q2 + q3 + q4;

      return {
        'Project Title': p.project_title,
        'Customer': p.customer || 'N/A',
        'Project ID': p.project_id,
        'OP Contribution': p.op_contribution * (12 - getFiscalMonthIndex(p.approval_date || p.created_date)),
        'One Time Savings': p.one_time_savings,
        'Apr': apr,
        'May': may,
        'Jun': jun,
        [`Q1${fiscalYear}`]: q1,
        'Jul': jul,
        'Aug': aug,
        'Sep': sep,
        [`Q2${fiscalYear}`]: q2,
        'Oct': oct,
        'Nov': nov,
        'Dec': dec,
        [`Q3${fiscalYear}`]: q3,
        'Jan': jan,
        'Feb': feb,
        'Mar': mar,
        [`Q4${fiscalYear}`]: q4,
        'FY Total': fyTotal
      };
    });

    // Totals row for Excel
    const totalsRow = {
      'Project Title': 'TOTALS',
      'Customer': '',
      'Project ID': '',
      'OP Contribution': totalOp,
      'One Time Savings': totalOt,
      'Apr': getMonthlyTotal(0),
      'May': getMonthlyTotal(1),
      'Jun': getMonthlyTotal(2),
      [`Q1${fiscalYear}`]: getQuarterTotal('Q1'),
      'Jul': getMonthlyTotal(3),
      'Aug': getMonthlyTotal(4),
      'Sep': getMonthlyTotal(5),
      [`Q2${fiscalYear}`]: getQuarterTotal('Q2'),
      'Oct': getMonthlyTotal(6),
      'Nov': getMonthlyTotal(7),
      'Dec': getMonthlyTotal(8),
      [`Q3${fiscalYear}`]: getQuarterTotal('Q3'),
      'Jan': getMonthlyTotal(9),
      'Feb': getMonthlyTotal(10),
      'Mar': getMonthlyTotal(11),
      [`Q4${fiscalYear}`]: getQuarterTotal('Q4'),
      'FY Total': totalFyTotal
    };
    dataToExport.push(totalsRow);

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, activeTab === 'approved' ? 'Approved Waterfall' : 'Open Waterfall');
    
    worksheet['!cols'] = [
      { wch: 30 }, // Project Title
      { wch: 15 }, // Customer
      { wch: 15 }, // Project ID
      { wch: 15 }, // OP Contribution
      { wch: 15 }, // One Time Savings
      ...Array(17).fill({ wch: 10 })
    ];

    XLSX.writeFile(workbook, `LeanImpact_ProjectsWaterfall_${fiscalYear}.xlsx`);
  };

  // Styles for highlights
  const stickyHeaderTitleStyle = {
    position: 'sticky' as const,
    left: 0,
    top: 0,
    zIndex: 15,
    backgroundColor: '#F3F4F6',
    minWidth: '240px',
    textAlign: 'left' as const
  };

  const stickyHeaderCustomerStyle = {
    position: 'sticky' as const,
    left: '240px',
    top: 0,
    zIndex: 15,
    backgroundColor: '#F3F4F6',
    minWidth: '120px',
    textAlign: 'left' as const
  };

  const stickyHeaderIdStyle = {
    position: 'sticky' as const,
    left: '360px',
    top: 0,
    zIndex: 15,
    backgroundColor: '#F3F4F6',
    minWidth: '120px',
    boxShadow: '2px 0 5px -2px rgba(0,0,0,0.15)',
    textAlign: 'left' as const
  };

  const stickyCellTitleStyle = (isEven: boolean, isRecon: boolean) => ({
    position: 'sticky' as const,
    left: 0,
    zIndex: 5,
    backgroundColor: isRecon ? '#FFFBEB' : (isEven ? '#FFFFFF' : '#F9FAFB'),
    minWidth: '240px',
    fontWeight: 600,
    textAlign: 'left' as const
  });

  const stickyCellCustomerStyle = (isEven: boolean, isRecon: boolean) => ({
    position: 'sticky' as const,
    left: '240px',
    zIndex: 5,
    backgroundColor: isRecon ? '#FFFBEB' : (isEven ? '#FFFFFF' : '#F9FAFB'),
    minWidth: '120px',
    textAlign: 'left' as const
  });

  const stickyCellIdStyle = (isEven: boolean, isRecon: boolean) => ({
    position: 'sticky' as const,
    left: '360px',
    zIndex: 5,
    backgroundColor: isRecon ? '#FFFBEB' : (isEven ? '#FFFFFF' : '#F9FAFB'),
    minWidth: '120px',
    fontWeight: 700,
    boxShadow: '2px 0 5px -2px rgba(0,0,0,0.15)',
    textAlign: 'left' as const
  });

  const stickyTotalsTitleStyle = {
    position: 'sticky' as const,
    left: 0,
    zIndex: 5,
    backgroundColor: '#F3F4F6',
    minWidth: '240px',
    fontWeight: 800,
    textAlign: 'left' as const
  };

  const stickyTotalsCustomerStyle = {
    position: 'sticky' as const,
    left: '240px',
    zIndex: 5,
    backgroundColor: '#F3F4F6',
    minWidth: '120px',
    textAlign: 'left' as const
  };

  const stickyTotalsIdStyle = {
    position: 'sticky' as const,
    left: '360px',
    zIndex: 5,
    backgroundColor: '#F3F4F6',
    minWidth: '120px',
    boxShadow: '2px 0 5px -2px rgba(0,0,0,0.15)',
    textAlign: 'left' as const
  };

  const quarterColStyle = { 
    backgroundColor: '#F0F9FF', 
    fontWeight: 700, 
    textAlign: 'right' as const, 
    color: '#0369A1' 
  };
  
  const fyColStyle = { 
    backgroundColor: '#ECFDF5', 
    fontWeight: 800, 
    textAlign: 'right' as const, 
    color: '#15803D' 
  };

  // Render Table Element
  const renderWaterfallTable = () => {
    return (
      <table className="executive-table" style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
        <thead>
          <tr style={{ backgroundColor: '#F3F4F6' }}>
            <th style={stickyHeaderTitleStyle}>Project Title</th>
            <th style={stickyHeaderCustomerStyle}>Customer</th>
            <th style={stickyHeaderIdStyle}>Project ID</th>
            <th style={{ minWidth: '130px', textAlign: 'right' }}>OP Contribution</th>
            <th style={{ minWidth: '140px', textAlign: 'right' }}>One Time Savings</th>
            <th style={{ minWidth: '85px', textAlign: 'right' }}>Apr</th>
            <th style={{ minWidth: '85px', textAlign: 'right' }}>May</th>
            <th style={{ minWidth: '85px', textAlign: 'right' }}>Jun</th>
            <th style={{ ...quarterColStyle, minWidth: '105px' }}>{`Q1${fiscalYear}`}</th>
            <th style={{ minWidth: '85px', textAlign: 'right' }}>Jul</th>
            <th style={{ minWidth: '85px', textAlign: 'right' }}>Aug</th>
            <th style={{ minWidth: '85px', textAlign: 'right' }}>Sep</th>
            <th style={{ ...quarterColStyle, minWidth: '105px' }}>{`Q2${fiscalYear}`}</th>
            <th style={{ minWidth: '85px', textAlign: 'right' }}>Oct</th>
            <th style={{ minWidth: '85px', textAlign: 'right' }}>Nov</th>
            <th style={{ minWidth: '85px', textAlign: 'right' }}>Dec</th>
            <th style={{ ...quarterColStyle, minWidth: '105px' }}>{`Q3${fiscalYear}`}</th>
            <th style={{ minWidth: '85px', textAlign: 'right' }}>Jan</th>
            <th style={{ minWidth: '85px', textAlign: 'right' }}>Feb</th>
            <th style={{ minWidth: '85px', textAlign: 'right' }}>Mar</th>
            <th style={{ ...quarterColStyle, minWidth: '105px' }}>{`Q4${fiscalYear}`}</th>
            <th style={{ ...fyColStyle, minWidth: '115px' }}>FY Total</th>
            <th style={{ minWidth: '80px', textAlign: 'center' }}>Details</th>
          </tr>
        </thead>
        <tbody>
          {projectsListWithRecon.map((p, idx) => {
            const isEven = idx % 2 === 0;
            const isRecon = p.id === 'RECON-FY27-Q1';
            
            const apr = getProjectSingleMonthSavings(p, 0);
            const may = getProjectSingleMonthSavings(p, 1);
            const jun = getProjectSingleMonthSavings(p, 2);
            const q1 = apr + may + jun;
            const jul = getProjectSingleMonthSavings(p, 3);
            const aug = getProjectSingleMonthSavings(p, 4);
            const sep = getProjectSingleMonthSavings(p, 5);
            const q2 = jul + aug + sep;
            const oct = getProjectSingleMonthSavings(p, 6);
            const nov = getProjectSingleMonthSavings(p, 7);
            const dec = getProjectSingleMonthSavings(p, 8);
            const q3 = oct + nov + dec;
            const jan = getProjectSingleMonthSavings(p, 9);
            const feb = getProjectSingleMonthSavings(p, 10);
            const mar = getProjectSingleMonthSavings(p, 11);
            const q4 = jan + feb + mar;
            const fyTotal = q1 + q2 + q3 + q4;

            return (
              <tr 
                key={p.id} 
                onClick={() => !isRecon && setSelectedProject(p)}
                style={{ 
                  backgroundColor: isRecon ? '#FFFBEB' : (isEven ? '#FFFFFF' : '#F9FAFB'),
                  cursor: isRecon ? 'default' : 'pointer'
                }}
              >
                <td style={stickyCellTitleStyle(isEven, isRecon)}>
                  {p.project_title}
                </td>
                <td style={stickyCellCustomerStyle(isEven, isRecon)}>
                  {p.customer || 'N/A'}
                </td>
                <td style={stickyCellIdStyle(isEven, isRecon)}>
                  {p.project_id}
                </td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(p.op_contribution * (12 - getFiscalMonthIndex(p.approval_date || p.created_date)))}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(p.one_time_savings)}</td>
                
                {/* Months */}
                <td style={{ textAlign: 'right' }}>{formatCurrency(apr)}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(may)}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(jun)}</td>
                <td style={quarterColStyle}>{formatCurrency(q1)}</td>
                
                <td style={{ textAlign: 'right' }}>{formatCurrency(jul)}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(aug)}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(sep)}</td>
                <td style={quarterColStyle}>{formatCurrency(q2)}</td>
                
                <td style={{ textAlign: 'right' }}>{formatCurrency(oct)}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(nov)}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(dec)}</td>
                <td style={quarterColStyle}>{formatCurrency(q3)}</td>
                
                <td style={{ textAlign: 'right' }}>{formatCurrency(jan)}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(feb)}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(mar)}</td>
                <td style={quarterColStyle}>{formatCurrency(q4)}</td>
                
                <td style={fyColStyle}>{formatCurrency(fyTotal)}</td>
                
                <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                  {!isRecon && (
                    <button 
                      onClick={() => setSelectedProject(p)} 
                      className="btn-export" 
                      style={{ padding: '4px 8px', display: 'inline-flex', alignItems: 'center' }}
                    >
                      <Eye size={12} />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          
          {/* Totals Row */}
          <tr style={{ backgroundColor: '#F3F4F6', fontWeight: 800 }}>
            <td style={stickyTotalsTitleStyle}>TOTALS</td>
            <td style={stickyTotalsCustomerStyle}></td>
            <td style={stickyTotalsIdStyle}></td>
            <td style={{ textAlign: 'right' }}>{formatCurrency(totalOp)}</td>
            <td style={{ textAlign: 'right' }}>{formatCurrency(totalOt)}</td>
            
            <td style={{ textAlign: 'right' }}>{formatCurrency(getMonthlyTotal(0))}</td>
            <td style={{ textAlign: 'right' }}>{formatCurrency(getMonthlyTotal(1))}</td>
            <td style={{ textAlign: 'right' }}>{formatCurrency(getMonthlyTotal(2))}</td>
            <td style={quarterColStyle}>{formatCurrency(getQuarterTotal('Q1'))}</td>
            
            <td style={{ textAlign: 'right' }}>{formatCurrency(getMonthlyTotal(3))}</td>
            <td style={{ textAlign: 'right' }}>{formatCurrency(getMonthlyTotal(4))}</td>
            <td style={{ textAlign: 'right' }}>{formatCurrency(getMonthlyTotal(5))}</td>
            <td style={quarterColStyle}>{formatCurrency(getQuarterTotal('Q2'))}</td>
            
            <td style={{ textAlign: 'right' }}>{formatCurrency(getMonthlyTotal(6))}</td>
            <td style={{ textAlign: 'right' }}>{formatCurrency(getMonthlyTotal(7))}</td>
            <td style={{ textAlign: 'right' }}>{formatCurrency(getMonthlyTotal(8))}</td>
            <td style={quarterColStyle}>{formatCurrency(getQuarterTotal('Q3'))}</td>
            
            <td style={{ textAlign: 'right' }}>{formatCurrency(getMonthlyTotal(9))}</td>
            <td style={{ textAlign: 'right' }}>{formatCurrency(getMonthlyTotal(10))}</td>
            <td style={{ textAlign: 'right' }}>{formatCurrency(getMonthlyTotal(11))}</td>
            <td style={quarterColStyle}>{formatCurrency(getQuarterTotal('Q4'))}</td>
            
            <td style={fyColStyle}>{formatCurrency(totalFyTotal)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    );
  };

  return (
    <div className="view-container">
      {/* Search and Filters */}
      <div className="filters-panel" style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ position: 'relative', minWidth: '220px', flexGrow: 2 }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#9CA3AF' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '38px' }}
            placeholder="Search by ID, title, leader, facilitator..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="filter-group" style={{ minWidth: '120px' }}>
          <label className="filter-label">Select FY</label>
          <select className="filter-select" value={fiscalYear} onChange={(e) => setFiscalYear(e.target.value)}>
            {fiscalYears.map(fy => (
              <option key={fy.id} value={fy.fiscal_year}>{fy.fiscal_year}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Workshop</label>
          <select className="filter-select" value={filterWorkshop} onChange={(e) => setFilterWorkshop(e.target.value)}>
            <option value="">All Workshops</option>
            {workshops.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Facilitator</label>
          <select className="filter-select" value={filterFacilitator} onChange={(e) => setFilterFacilitator(e.target.value)}>
            <option value="">All Facilitators</option>
            {facilitators.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Leader</label>
          <select className="filter-select" value={filterLeader} onChange={(e) => setFilterLeader(e.target.value)}>
            <option value="">All Leaders</option>
            {leaders.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Customer</label>
          <select className="filter-select" value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)}>
            <option value="">All Customers</option>
            {customers.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Type</label>
          <select className="filter-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">All Types</option>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Month</label>
          <select className="filter-select" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
            <option value="">All Months</option>
            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignSelf: 'flex-end', marginLeft: 'auto' }}>
          <button 
            onClick={() => setIsExpanded(true)} 
            className="btn-export"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Expand Projects"
          >
            <Maximize2 size={16} />
            <span>Expand Projects</span>
          </button>
          
          <button onClick={handleExportExcel} className="btn-export">
            <Download size={16} />
            <span>Export to Excel</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-navigation">
        <button 
          className={`tab-btn ${activeTab === 'approved' ? 'active' : ''}`}
          onClick={() => handleTabChange('approved')}
        >
          Approved Projects ({activeDataset.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'open' ? 'active' : ''}`}
          onClick={() => handleTabChange('open')}
        >
          Open Projects ({activeDataset.length})
        </button>
      </div>

      {/* Projects Table */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton-loading skeleton-table-row" style={{ height: '48px' }} />
          ))}
        </div>
      ) : projectsListWithRecon.length > 0 ? (
        <>
          {/* Top scrollbar */}
          <div 
            ref={topScrollRef}
            onScroll={syncScrollTop}
            style={{ 
              overflowX: 'auto', 
              overflowY: 'hidden', 
              width: '100%', 
              maxWidth: '100%',
              height: '14px', 
              backgroundColor: '#F9FAFB',
              border: '1px solid #E5E7EB',
              borderBottom: 'none',
              borderRadius: '8px 8px 0 0',
              zIndex: 10
            }}
          >
            <div style={{ width: `${scrollWidth}px`, height: '1px' }} />
          </div>
          
          <div 
            ref={tableContainerRef}
            onScroll={syncScrollTable}
            className="table-container" 
            style={{ 
              overflow: 'auto', 
              maxHeight: '600px', 
              width: '100%',
              maxWidth: '100%',
              border: '1px solid #E5E7EB', 
              borderRadius: '0 0 8px 8px' 
            }}
          >
            {renderWaterfallTable()}
          </div>
        </>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '48px', color: '#6B7280' }}>
          <Briefcase size={40} style={{ margin: '0 auto 12px', display: 'block', color: '#9CA3AF' }} />
          <h3>No projects match your filter criteria</h3>
          <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>Try resetting or modifying the search filters above.</p>
        </div>
      )}

      {/* Project Details Modal */}
      {selectedProject && (
        <div className="modal-overlay" onClick={() => setSelectedProject(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="badge badge-green" style={{ marginBottom: '8px' }}>
                  {selectedProject.project_type} Project
                </span>
                <h3 className="card-title" style={{ fontSize: '1.25rem' }}>{selectedProject.project_id}</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedProject(null)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="detail-item">
                <span className="detail-label">Project Title</span>
                <span className="detail-value" style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                  {selectedProject.project_title}
                </span>
              </div>

              <div className="project-details-grid">
                <div className="detail-item">
                  <span className="detail-label">Workshop / Program</span>
                  <span className="detail-value">{selectedProject.workshop}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Status</span>
                  <span className="detail-value">{selectedProject.status}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Project Leader</span>
                  <span className="detail-value">{selectedProject.leader}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Kaizen Facilitator</span>
                  <span className="detail-value">{selectedProject.facilitator}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Functional Area</span>
                  <span className="detail-value">{selectedProject.functional_area}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Project Category</span>
                  <span className="detail-value">{selectedProject.project_category || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Customer Associated</span>
                  <span className="detail-value">{selectedProject.customer || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Business Unit</span>
                  <span className="detail-value">{selectedProject.business || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">
                    {activeTab === 'approved' ? 'Approval Date' : 'Created Date'}
                  </span>
                  <span className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={14} />
                    {activeTab === 'approved' ? (selectedProject as ProjectApproved).approval_date : (selectedProject as ProjectOpen).created_date}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Target Completion Date</span>
                  <span className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={14} />
                    {selectedProject.completion_date || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Financial Savings Breakdown */}
              <div style={{ marginTop: '8px', borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                <span className="detail-label" style={{ marginBottom: '8px', display: 'block', fontWeight: 600 }}>
                  Financial Savings Breakdown
                </span>
                
                <div className="project-details-grid" style={{ backgroundColor: '#F9FAFB', padding: '16px', borderRadius: '8px' }}>
                  <div className="detail-item">
                    <span className="detail-label">Operational Contribution</span>
                    <span className="detail-value">{formatCurrency(selectedProject.op_contribution)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Soft Savings</span>
                    <span className="detail-value">{formatCurrency(selectedProject.soft_savings)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Inventory Reduction</span>
                    <span className="detail-value">{formatCurrency(selectedProject.inventory_savings)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">One-Time Savings</span>
                    <span className="detail-value">{formatCurrency(selectedProject.one_time_savings)}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px', padding: '8px', backgroundColor: '#F3F4F6', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1F2937' }}>
                      Target-Qualifying Savings (OP + One-Time):
                    </span>
                    <span className="detail-value savings" style={{ fontSize: '1.1rem', color: '#15803D' }}>
                      {formatCurrency(getProjectPeriodSavings(selectedProject, 11))}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed #D1D5DB', paddingTop: '6px' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#4B5563' }}>
                      Total Savings (Incl. Soft/Inventory):
                    </span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#4B5563' }}>
                      {formatCurrency(
                        getProjectPeriodSavings(selectedProject, 11) +
                        selectedProject.soft_savings +
                        selectedProject.inventory_savings
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* FTE Headcount Savings */}
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px', display: 'flex', gap: '12px' }}>
                <div className="kpi-icon-container" style={{ backgroundColor: '#E0F2FE', color: '#0284C7', minWidth: '40px', height: '40px' }}>
                  <User size={18} />
                </div>
                <div>
                  <span className="detail-label" style={{ fontWeight: 600 }}>FTE Headcount Savings</span>
                  <span className="detail-value fte" style={{ display: 'block', fontSize: '1.1rem', marginTop: '2px' }}>
                    {selectedProject.fte_savings.toFixed(1)} FTEs
                  </span>
                  <p style={{ fontSize: '0.7rem', color: '#6B7280', marginTop: '2px', lineHeight: 1.3 }}>
                    Note: FTE headcount reductions are excluded from monetary calculations in compliance with platform business rules.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Table Fullscreen Overlay Modal */}
      {isExpanded && (
        <div 
          className="modal-overlay" 
          style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            zIndex: 99999,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <div 
            style={{
              backgroundColor: '#FFFFFF',
              width: '100vw',
              height: '100vh',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              overflow: 'hidden'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', margin: 0 }}>
                {`Projects Waterfall Spreadsheet View (${fiscalYear})`}
              </h3>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={handleExportExcel} className="btn-export" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Download size={16} />
                  <span>Export to Excel</span>
                </button>
                <button 
                  onClick={() => setIsExpanded(false)} 
                  className="btn-export"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '90px' }}
                >
                  <Minimize2 size={16} />
                  <span>Minimize</span>
                </button>
              </div>
            </div>

            {/* Synchronized top scrollbar inside modal */}
            {projectsListWithRecon.length > 0 && (
              <div 
                ref={expandedTopScrollRef}
                onScroll={syncScrollExpandedTop}
                style={{ 
                  overflowX: 'auto', 
                  overflowY: 'hidden', 
                  width: '100%', 
                  maxWidth: '100%',
                  height: '14px', 
                  backgroundColor: '#F9FAFB',
                  border: '1px solid #E5E7EB',
                  borderBottom: 'none',
                  borderRadius: '8px 8px 0 0',
                  zIndex: 10
                }}
              >
                <div style={{ width: `${expandedScrollWidth}px`, height: '1px' }} />
              </div>
            )}

            <div 
              ref={expandedTableContainerRef}
              onScroll={syncScrollExpandedTable}
              style={{ 
                flex: 1, 
                overflow: 'auto', 
                border: '1px solid #E5E7EB', 
                borderRadius: projectsListWithRecon.length > 0 ? '0 0 8px 8px' : '8px' 
              }}
            >
              {renderWaterfallTable()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
