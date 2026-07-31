import React, { useState, useEffect } from 'react';
import { 
  Target, 
  Upload, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  FileSpreadsheet,
  Plus
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { dbService, checkConnection } from '../lib/supabaseClient';
import type { SavingsTarget } from '../lib/supabaseClient';

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(val);
};

export const Configuration: React.FC = () => {
  // Connection Status State
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'failed'>('checking');

  useEffect(() => {
    const verifyDb = async () => {
      const isConnected = await checkConnection();
      setConnectionStatus(isConnected ? 'connected' : 'failed');
    };
    verifyDb();
  }, []);

  // Target States
  const [fiscalYear, setFiscalYear] = useState<number>(2026);
  const [quarter, setQuarter] = useState<string>('Q1');
  const [targetAmount, setTargetAmount] = useState<string>('');
  const [targetList, setTargetList] = useState<SavingsTarget[]>([]);
  const [targetMessage, setTargetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Import States
  const [approvedImportSummary, setApprovedImportSummary] = useState<any | null>(null);
  const [openImportSummary, setOpenImportSummary] = useState<any | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState<string | null>(null); // 'approved' or 'open'

  // Refresh State
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);

  const loadTargets = async () => {
    try {
      const data = await dbService.getSavingsTargets();
      setTargetList(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadTargets();
  }, []);

  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    setTargetMessage(null);
    const amt = parseFloat(targetAmount);

    if (isNaN(amt) || amt < 0) {
      setTargetMessage({ type: 'error', text: 'Please enter a valid savings target amount.' });
      return;
    }

    try {
      await dbService.saveSavingsTarget({
        fiscal_year: fiscalYear,
        quarter,
        target_amount: amt
      });
      setTargetMessage({ type: 'success', text: `Target for FY${fiscalYear} ${quarter} successfully saved!` });
      setTargetAmount('');
      loadTargets();
    } catch (err: any) {
      setTargetMessage({ type: 'error', text: err.message || 'Error saving target.' });
    }
  };

  // Helper to normalize and match column headers dynamically
  const findColumnIndex = (headers: string[], synonyms: string[]): string | null => {
    for (const h of headers) {
      const normalizedHeader = h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const syn of synonyms) {
        const normalizedSyn = syn.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normalizedHeader === normalizedSyn || normalizedHeader.includes(normalizedSyn)) {
          return h;
        }
      }
    }
    return null;
  };

  const parseExcelFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
          resolve(jsonData);
        } catch (err) {
          reject(new Error('Failed to parse Excel file. Ensure it is a valid .xlsx or .xls file.'));
        }
      };
      reader.onerror = () => reject(new Error('File reading error.'));
      reader.readAsArrayBuffer(file);
    });
  };

  const processImport = async (file: File, type: 'approved' | 'open') => {
    setImportError(null);
    setImportLoading(type);
    if (type === 'approved') setApprovedImportSummary(null);
    else setOpenImportSummary(null);

    try {
      const jsonData = await parseExcelFile(file);
      if (jsonData.length === 0) {
        throw new Error('The uploaded file contains no data.');
      }

      // Read headers from first row keys
      const headers = Object.keys(jsonData[0]);

      // Synonyms for mapping
      const idSyns = ['projectid', 'id', 'code', 'project_id', 'clave'];
      const titleSyns = ['title', 'projecttitle', 'name', 'projectname', 'titulo', 'nombre'];
      const workshopSyns = ['workshop', 'event', 'taller', 'program', 'programa'];
      const typeSyns = ['type', 'projecttype', 'tipo', 'project_type'];
      const leaderSyns = ['leader', 'projectleader', 'lider', 'responsable'];
      const facilitatorSyns = ['facilitator', 'facilitador', 'leanfacilitator', 'kaizenfacilitator'];
      const statusSyns = ['status', 'state', 'estatus', 'estado', 'fase'];
      const opSyns = ['opcontribution', 'operationalsavings', 'op_contribution', 'contribucionoperacional', 'operacional'];
      const softSyns = ['softsavings', 'soft_savings', 'ahorrossoft', 'soft'];
      const inventorySyns = ['inventorysavings', 'inventoryreduction', 'inventory_savings', 'inventario', 'ahorrosinventario'];
      const fteSyns = ['fte', 'ftesavings', 'fte_savings', 'headcount'];
      const oneTimeSyns = ['onetime', 'onetimesavings', 'one_time_savings', 'ahorrosonetime', 'eventual'];
      const areaSyns = ['area', 'functionalarea', 'functional_area', 'departamento', 'seccion'];
      const catSyns = ['category', 'projectcategory', 'project_category', 'categoria', 'pilar'];
      const custSyns = ['customer', 'client', 'cliente', 'customername'];
      const busSyns = ['business', 'businessunit', 'business_unit', 'negocio', 'segmento'];

      // Specific keys: date mapping
      const approvedDateSyns = ['approvaldate', 'dateapproved', 'approval_date', 'fechaaprobacion'];
      const openDateSyns = ['createddate', 'startdate', 'created_date', 'fechacreacion', 'fecha_inicio'];
      const completionDateSyns = ['completiondate', 'enddate', 'completion_date', 'fechaterminacion', 'fecha_fin'];

      // Validate required columns
      const keyId = findColumnIndex(headers, idSyns);
      const keyTitle = findColumnIndex(headers, titleSyns);
      const keyWorkshop = findColumnIndex(headers, workshopSyns);
      const keyType = findColumnIndex(headers, typeSyns);
      const keyLeader = findColumnIndex(headers, leaderSyns);
      const keyFacilitator = findColumnIndex(headers, facilitatorSyns);
      const keyStatus = findColumnIndex(headers, statusSyns);
      const keyArea = findColumnIndex(headers, areaSyns);
      const keyDate = type === 'approved' 
        ? findColumnIndex(headers, approvedDateSyns) 
        : findColumnIndex(headers, openDateSyns);

      // Check validation
      if (!keyId || !keyTitle || !keyWorkshop || !keyType || !keyLeader || !keyFacilitator || !keyStatus || !keyArea || !keyDate) {
        const missing = [];
        if (!keyId) missing.push('Project ID');
        if (!keyTitle) missing.push('Project Title');
        if (!keyWorkshop) missing.push('Workshop');
        if (!keyType) missing.push('Project Type');
        if (!keyLeader) missing.push('Leader');
        if (!keyFacilitator) missing.push('Facilitator');
        if (!keyStatus) missing.push('Status');
        if (!keyArea) missing.push('Functional Area');
        if (!keyDate) missing.push(type === 'approved' ? 'Approval Date' : 'Created Date');

        throw new Error(`Invalid file headers. Could not identify columns for: ${missing.join(', ')}.`);
      }

      // Retrieve optional columns
      const keyOp = findColumnIndex(headers, opSyns);
      const keySoft = findColumnIndex(headers, softSyns);
      const keyInventory = findColumnIndex(headers, inventorySyns);
      const keyFte = findColumnIndex(headers, fteSyns);
      const keyOneTime = findColumnIndex(headers, oneTimeSyns);
      const keyCategory = findColumnIndex(headers, catSyns);
      const keyCustomer = findColumnIndex(headers, custSyns);
      const keyBusiness = findColumnIndex(headers, busSyns);
      const keyCompDate = findColumnIndex(headers, completionDateSyns);

      // Map rows
      const projectsMapped = jsonData.map((row: any) => {
        const opVal = keyOp ? parseFloat(row[keyOp]) : 0;
        const softVal = keySoft ? parseFloat(row[keySoft]) : 0;
        const invVal = keyInventory ? parseFloat(row[keyInventory]) : 0;
        const fteVal = keyFte ? parseFloat(row[keyFte]) : 0;
        const otVal = keyOneTime ? parseFloat(row[keyOneTime]) : 0;

        const dateRaw = row[keyDate];
        // Format Date to YYYY-MM-DD
        let formattedDate = new Date().toISOString().split('T')[0];
        if (dateRaw) {
          const parsedD = new Date(dateRaw);
          if (!isNaN(parsedD.getTime())) {
            formattedDate = parsedD.toISOString().split('T')[0];
          }
        }

        let formattedCompDate: string | null = null;
        if (keyCompDate && row[keyCompDate]) {
          const parsedD = new Date(row[keyCompDate]);
          if (!isNaN(parsedD.getTime())) {
            formattedCompDate = parsedD.toISOString().split('T')[0];
          }
        }

        const baseProject = {
          project_id: String(row[keyId]).trim(),
          project_title: String(row[keyTitle]).trim(),
          workshop: String(row[keyWorkshop]).trim(),
          project_type: String(row[keyType]).trim(),
          leader: String(row[keyLeader]).trim(),
          facilitator: String(row[keyFacilitator]).trim(),
          status: String(row[keyStatus]).trim(),
          op_contribution: isNaN(opVal) ? 0 : opVal,
          soft_savings: isNaN(softVal) ? 0 : softVal,
          inventory_savings: isNaN(invVal) ? 0 : invVal,
          fte_savings: isNaN(fteVal) ? 0 : fteVal,
          one_time_savings: isNaN(otVal) ? 0 : otVal,
          functional_area: String(row[keyArea]).trim(),
          project_category: keyCategory ? String(row[keyCategory]).trim() : 'N/A',
          customer: keyCustomer ? String(row[keyCustomer]).trim() : 'N/A',
          business: keyBusiness ? String(row[keyBusiness]).trim() : 'N/A',
          completion_date: formattedCompDate,
        };

        if (type === 'approved') {
          return {
            ...baseProject,
            approval_date: formattedDate,
          };
        } else {
          return {
            ...baseProject,
            created_date: formattedDate,
          };
        }
      });

      // Insert/Upsert via DB service
      let summary;
      if (type === 'approved') {
        summary = await dbService.importApprovedProjects(projectsMapped as any);
        setApprovedImportSummary({
          fileName: file.name,
          totalRows: jsonData.length,
          inserted: summary.inserted,
          updated: summary.updated,
          mappedColumns: {
            'Project ID': keyId,
            'Title': keyTitle,
            'Facilitator': keyFacilitator,
            'Approval Date': keyDate
          }
        });
      } else {
        summary = await dbService.importOpenProjects(projectsMapped as any);
        setOpenImportSummary({
          fileName: file.name,
          totalRows: jsonData.length,
          inserted: summary.inserted,
          updated: summary.updated,
          mappedColumns: {
            'Project ID': keyId,
            'Title': keyTitle,
            'Facilitator': keyFacilitator,
            'Created Date': keyDate
          }
        });
      }
    } catch (err: any) {
      console.error(err);
      setImportError(err.message || 'Error processing Excel import.');
    } finally {
      setImportLoading(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'approved' | 'open') => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processImport(files[0], type);
    }
  };

  // Recalculate Dashboard action
  const handleRecalculate = () => {
    setRefreshLoading(true);
    setRefreshSuccess(false);
    setTimeout(() => {
      // Dispatch database changed event to trigger state reload across tabs
      window.dispatchEvent(new Event('lean-impact-db-changed'));
      setRefreshLoading(false);
      setRefreshSuccess(true);
      setTimeout(() => setRefreshSuccess(false), 3000);
    }, 1200);
  };



  return (
    <div className="view-container">
      {/* Supabase Connection Status Banner */}
      <div className="card" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        padding: '16px', 
        borderRadius: '8px', 
        backgroundColor: connectionStatus === 'connected' ? '#DCFCE7' : connectionStatus === 'failed' ? '#FEE2E2' : '#F3F4F6',
        borderColor: connectionStatus === 'connected' ? '#BBF7D0' : connectionStatus === 'failed' ? '#FCA5A5' : '#E5E7EB',
        borderWidth: '1px',
        borderStyle: 'solid',
        marginBottom: '20px'
      }}>
        {connectionStatus === 'checking' && (
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#4B5563' }}>Checking database connection...</span>
        )}
        {connectionStatus === 'connected' && (
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#15803D' }}>
            ✅ Connected to Supabase
          </span>
        )}
        {connectionStatus === 'failed' && (
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#EF4444' }}>
            ❌ Supabase connection failed
          </span>
        )}
      </div>

      <div className="config-section-container">
        
        {/* Section 1: Savings Targets */}
        <div className="card">
          <div className="card-header-row" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '16px' }}>
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Target size={20} className="text-primary" />
              Quarterly Savings Targets
            </span>
          </div>

          <div className="config-row-grid" style={{ marginTop: '20px' }}>
            {/* Form */}
            <form onSubmit={handleSaveTarget} className="form-grid-quarter" style={{ gap: '16px' }}>
              <div className="filter-group">
                <label className="filter-label">Fiscal Year</label>
                <select className="filter-select" value={fiscalYear} onChange={(e) => setFiscalYear(Number(e.target.value))}>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                  <option value={2028}>2028</option>
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">Quarter</label>
                <select className="filter-select" value={quarter} onChange={(e) => setQuarter(e.target.value)}>
                  <option value="Q1">Q1</option>
                  <option value="Q2">Q2</option>
                  <option value="Q3">Q3</option>
                  <option value="Q4">Q4</option>
                  <option value="Annual">Annual Target</option>
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label" htmlFor="target-input">Savings Target ($)</label>
                <input
                  id="target-input"
                  type="number"
                  className="form-input"
                  placeholder="e.g. 400000"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn-submit" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={16} />
                <span>Save</span>
              </button>
            </form>

            {/* List */}
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '12px' }}>
              <span className="filter-label" style={{ display: 'block', marginBottom: '8px' }}>Active Savings Targets</span>
              {targetList.length > 0 ? (
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {targetList.map(t => (
                    <li key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '6px', borderBottom: '1px dashed var(--color-border)' }}>
                      <span style={{ fontWeight: 600 }}>FY{t.fiscal_year} - {t.quarter}</span>
                      <span style={{ color: '#15803D', fontWeight: 700 }}>{formatCurrency(t.target_amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>No targets configured.</span>
              )}
            </div>
          </div>

          {targetMessage && (
            <div className={`summary-card` } style={{ 
              marginTop: '16px', 
              backgroundColor: targetMessage.type === 'success' ? '#DCFCE7' : '#FEE2E2',
              borderColor: targetMessage.type === 'success' ? '#A7F3D0' : '#FCA5A5',
              color: targetMessage.type === 'success' ? '#15803D' : '#EF4444'
            }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {targetMessage.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{targetMessage.text}</span>
              </div>
            </div>
          )}
        </div>

        {/* Section 2 & 3: File Import Panels */}
        <div className="config-row-grid">
          
          {/* Section 2: Approved Projects Import */}
          <div className="card">
            <div className="card-header-row" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '12px', marginBottom: '16px' }}>
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileSpreadsheet size={20} className="text-primary" />
                Import Approved Projects
              </span>
            </div>

            <p style={{ fontSize: '0.8rem', color: '#6B7280', marginBottom: '16px' }}>
              Upload the Excel tracker (Sheet: <strong>ApprovedKaizenProjectList</strong>).
              Headers like <i>Project ID, Title, Facilitator, Workshop, and Approval Date</i> will be mapped.
            </p>

            <label className="import-upload-zone">
              <Upload className="import-upload-zone-icon" size={32} />
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1F2937' }}>
                {importLoading === 'approved' ? 'Analyzing file structure...' : 'Click to select or drag Excel file'}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Supports XLS, XLSX</span>
              <input 
                type="file" 
                className="upload-input" 
                accept=".xlsx, .xls"
                onChange={(e) => handleFileUpload(e, 'approved')}
                disabled={importLoading !== null}
              />
            </label>

            {approvedImportSummary && (
              <div className="summary-card">
                <span className="summary-heading">✓ Approved Import Completed</span>
                <div className="summary-item">
                  <span>File Processed:</span>
                  <strong style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {approvedImportSummary.fileName}
                  </strong>
                </div>
                <div className="summary-item">
                  <span>Total Rows Evaluated:</span>
                  <strong>{approvedImportSummary.totalRows}</strong>
                </div>
                <div className="summary-item" style={{ color: '#15803D' }}>
                  <span>Records Inserted/Updated:</span>
                  <strong>{approvedImportSummary.inserted + approvedImportSummary.updated}</strong>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Open Projects Import */}
          <div className="card">
            <div className="card-header-row" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '12px', marginBottom: '16px' }}>
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileSpreadsheet size={20} style={{ color: '#3B82F6' }} />
                Import Open Projects
              </span>
            </div>

            <p style={{ fontSize: '0.8rem', color: '#6B7280', marginBottom: '16px' }}>
              Upload the active pipeline Excel sheet (Sheet: <strong>KaizenOpenProjectList</strong>).
              Columns like <i>Project ID, Title, Facilitator, Workshop, and Created Date</i> are required.
            </p>

            <label className="import-upload-zone" style={{ borderStyle: 'dashed' }}>
              <Upload style={{ color: '#3B82F6' }} size={32} />
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1F2937' }}>
                {importLoading === 'open' ? 'Analyzing file structure...' : 'Click to select or drag Excel file'}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Supports XLS, XLSX</span>
              <input 
                type="file" 
                className="upload-input" 
                accept=".xlsx, .xls"
                onChange={(e) => handleFileUpload(e, 'open')}
                disabled={importLoading !== null}
              />
            </label>

            {openImportSummary && (
              <div className="summary-card" style={{ backgroundColor: '#E0F2FE', borderColor: '#BAE6FD', color: '#0369A1' }}>
                <span className="summary-heading" style={{ color: '#0369A1' }}>✓ Open Import Completed</span>
                <div className="summary-item">
                  <span>File Processed:</span>
                  <strong style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {openImportSummary.fileName}
                  </strong>
                </div>
                <div className="summary-item">
                  <span>Total Rows Evaluated:</span>
                  <strong>{openImportSummary.totalRows}</strong>
                </div>
                <div className="summary-item" style={{ color: '#0369A1' }}>
                  <span>Records Inserted/Updated:</span>
                  <strong>{openImportSummary.inserted + openImportSummary.updated}</strong>
                </div>
              </div>
            )}
          </div>
        </div>

        {importError && (
          <div className="card" style={{ borderLeft: '4px solid #EF4444', backgroundColor: '#FEE2E2' }}>
            <div style={{ display: 'flex', gap: '10px', color: '#B91C1C' }}>
              <AlertCircle size={20} />
              <div>
                <strong style={{ fontSize: '0.875rem' }}>Import Validation Error</strong>
                <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>{importError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Section 4: Data Refresh & Tools */}
        <div className="card">
          <div className="card-header-row" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '12px', marginBottom: '16px' }}>
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCw size={20} className="text-primary" />
              Platform Utilities & Data Refresh
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            <button 
              onClick={handleRecalculate} 
              disabled={refreshLoading}
              className="btn-submit"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '220px', justifyContent: 'center' }}
            >
              <RefreshCw size={16} className={refreshLoading ? 'spin' : ''} style={{ animation: refreshLoading ? 'spin 1s linear infinite' : 'none' }} />
              <span>{refreshLoading ? 'Recalculating...' : 'Recalculate Dashboard'}</span>
            </button>


          </div>

          {refreshSuccess && (
            <div className="summary-card" style={{ marginTop: '16px', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={18} className="text-primary" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Dashboard savings recalculation completed. All view tabs refreshed.</span>
            </div>
          )}
        </div>

      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
