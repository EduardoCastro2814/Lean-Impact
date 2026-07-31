import React, { useEffect, useState } from 'react';
import { 
  Download, 
  Search, 
  Eye, 
  X, 
  Calendar,
  User,
  Briefcase
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { dbService } from '../lib/supabaseClient';
import type { ProjectApproved, ProjectOpen } from '../lib/supabaseClient';

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(val);
};

export const Projects: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'approved' | 'open'>('approved');
  const [approvedProjects, setApprovedProjects] = useState<ProjectApproved[]>([]);
  const [openProjects, setOpenProjects] = useState<ProjectOpen[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected Project for details modal
  const [selectedProject, setSelectedProject] = useState<ProjectApproved | ProjectOpen | null>(null);

  // Filter states
  const [filterWorkshop, setFilterWorkshop] = useState('');
  const [filterFacilitator, setFilterFacilitator] = useState('');
  const [filterLeader, setFilterLeader] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterMonth, setFilterMonth] = useState(''); // 0-11 as string, or ''

  // Search query
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [approved, open] = await Promise.all([
        dbService.getProjectsApproved(),
        dbService.getProjectsOpen()
      ]);
      setApprovedProjects(approved);
      setOpenProjects(open);
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

  // Get unique values for filters based on active dataset
  const activeDataset = activeTab === 'approved' ? approvedProjects : openProjects;

  const workshops = Array.from(new Set(activeDataset.map(p => p.workshop))).filter(Boolean).sort();
  const facilitators = Array.from(new Set(activeDataset.map(p => p.facilitator))).filter(Boolean).sort();
  const leaders = Array.from(new Set(activeDataset.map(p => p.leader))).filter(Boolean).sort();
  const customers = Array.from(new Set(activeDataset.map(p => p.customer))).filter(Boolean).sort();
  const types = Array.from(new Set(activeDataset.map(p => p.project_type))).filter(Boolean).sort();

  const months = [
    { label: 'January', value: '0' },
    { label: 'February', value: '1' },
    { label: 'March', value: '2' },
    { label: 'April', value: '3' },
    { label: 'May', value: '4' },
    { label: 'June', value: '5' },
    { label: 'July', value: '6' },
    { label: 'August', value: '7' },
    { label: 'September', value: '8' },
    { label: 'October', value: '9' },
    { label: 'November', value: '10' },
    { label: 'December', value: '11' },
  ];

  // Filtering Logic
  const filteredProjects = (activeDataset as any[]).filter(p => {
    // Search query check (id, title, leader, facilitator, area)
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

    // Month check
    const dateStr = activeTab === 'approved' ? p.approval_date : (p.completion_date || p.created_date);
    const dateMonth = dateStr ? new Date(dateStr).getMonth().toString() : '';
    const matchesMonth = filterMonth === '' || dateMonth === filterMonth;

    return matchesSearch && matchesWorkshop && matchesFacilitator && matchesLeader && matchesCustomer && matchesType && matchesMonth;
  });

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
    const dataToExport = filteredProjects.map(p => {
      const savings = p.op_contribution + p.soft_savings + p.inventory_savings + p.one_time_savings;
      const dateLabel = activeTab === 'approved' ? 'Approval Date' : 'Created Date';
      const dateVal = activeTab === 'approved' ? p.approval_date : p.created_date;

      return {
        'Project ID': p.project_id,
        'Project Title': p.project_title,
        'Workshop': p.workshop,
        'Project Type': p.project_type,
        'Leader': p.leader,
        'Facilitator': p.facilitator,
        'Status': p.status,
        [dateLabel]: dateVal,
        'Est. Completion': p.completion_date || 'N/A',
        'Functional Area': p.functional_area,
        'Category': p.project_category || 'N/A',
        'Customer': p.customer || 'N/A',
        'Business Unit': p.business || 'N/A',
        'Op Contribution ($)': p.op_contribution,
        'Soft Savings ($)': p.soft_savings,
        'Inventory Savings ($)': p.inventory_savings,
        'One-time Savings ($)': p.one_time_savings,
        'Total Financial Savings ($)': savings,
        'FTE Savings (Headcount)': p.fte_savings
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, activeTab === 'approved' ? 'Approved Projects' : 'Open Projects');
    
    // Fit columns width
    const max_width = dataToExport.reduce((w, r) => Math.max(w, Object.keys(r).length), 10);
    worksheet['!cols'] = Array(max_width).fill({ wch: 18 });

    XLSX.writeFile(workbook, `Lean_Impact_${activeTab === 'approved' ? 'Approved' : 'Open'}_Projects.xlsx`);
  };

  return (
    <div className="view-container">
      {/* Search and Filters */}
      <div className="filters-panel">
        <div style={{ position: 'relative', minWidth: '240px', flexGrow: 2 }}>
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
          Approved Projects ({approvedProjects.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'open' ? 'active' : ''}`}
          onClick={() => handleTabChange('open')}
        >
          Open Projects ({openProjects.length})
        </button>
      </div>

      {/* Projects Table */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton-loading skeleton-table-row" />
          ))}
        </div>
      ) : filteredProjects.length > 0 ? (
        <div className="table-container">
          <table className="executive-table">
            <thead>
              <tr>
                <th>Project ID</th>
                <th>Project Title</th>
                <th>Workshop</th>
                <th>Type</th>
                <th>Leader</th>
                <th>Facilitator</th>
                <th>Status</th>
                <th>Financial Savings</th>
                <th>Area</th>
                <th>Customer</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((p) => {
                const savings = p.op_contribution + p.soft_savings + p.inventory_savings + p.one_time_savings;
                return (
                  <tr key={p.id} onClick={() => setSelectedProject(p)}>
                    <td style={{ fontWeight: 700, color: '#111827' }}>{p.project_id}</td>
                    <td style={{ whiteSpace: 'normal', maxWidth: '300px', fontWeight: 500 }}>{p.project_title}</td>
                    <td>{p.workshop}</td>
                    <td>
                      <span className={`badge ${
                        p.project_type.toUpperCase() === 'KAIZEN' ? 'badge-green' : 
                        p.project_type.toUpperCase() === 'SGA' ? 'badge-yellow' : 'badge-blue'
                      }`}>
                        {p.project_type}
                      </span>
                    </td>
                    <td>{p.leader}</td>
                    <td>{p.facilitator}</td>
                    <td>
                      <span className={`badge ${
                        activeTab === 'approved' ? 'badge-green' : 
                        p.status.toLowerCase() === 'execution' ? 'badge-blue' : 'badge-gray'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: '#16803D' }}>{formatCurrency(savings)}</td>
                    <td>{p.functional_area}</td>
                    <td>{p.customer || 'N/A'}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => setSelectedProject(p)} 
                        className="btn-export" 
                        style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Eye size={14} />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', padding: '4px 8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1F2937' }}>
                    Total Financial Savings:
                  </span>
                  <span className="detail-value savings" style={{ fontSize: '1.25rem' }}>
                    {formatCurrency(
                      selectedProject.op_contribution +
                      selectedProject.soft_savings +
                      selectedProject.inventory_savings +
                      selectedProject.one_time_savings
                    )}
                  </span>
                </div>
              </div>

              {/* FTE Headcount Savings (Notice Banner) */}
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
    </div>
  );
};
