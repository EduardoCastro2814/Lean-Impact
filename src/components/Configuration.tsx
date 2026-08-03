import React, { useState, useEffect } from 'react';
import { 
  Target, 
  Upload, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  FileSpreadsheet,
  Plus,
  Calendar
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { dbService, checkConnection, getFyDisplayLabel } from '../lib/supabaseClient';
import type { SavingsTarget } from '../lib/supabaseClient';

const convertExcelDate = (excelVal: any): string | null => {
  if (excelVal === null || excelVal === undefined || excelVal === '') return null;
  const str = excelVal.toString().trim();
  
  // Check if value is a numeric Excel serial date (decimal or integer)
  if (/^\d+(\.\d+)?$/.test(str)) {
    const serial = parseFloat(str);
    // Excel base date is 1899-12-30 (accounting for leap year bug in 1900)
    const baseDate = new Date(1899, 11, 30);
    const dateMs = baseDate.getTime() + serial * 86400000;
    const parsedDate = new Date(dateMs);
    
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString().split('T')[0];
    }
  }
  
  // Fall back to JavaScript standard Date parsing (e.g. ISO format or standard date strings)
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) {
    return new Date(parsed).toISOString().split('T')[0];
  }
  
  return null;
};

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
  const [fiscalYear, setFiscalYear] = useState<string>('FY26');
  const [quarter, setQuarter] = useState<string>('Q1');
  const [targetAmount, setTargetAmount] = useState<string>('');
  const [targetList, setTargetList] = useState<SavingsTarget[]>([]);
  const [targetMessage, setTargetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fiscal Years States
  const [fiscalYears, setFiscalYears] = useState<any[]>([]);
  const [newFiscalYear, setNewFiscalYear] = useState<string>('');
  const [importFiscalYear, setImportFiscalYear] = useState<string>('');
  const [fyMessage, setFyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editingFyId, setEditingFyId] = useState<string | null>(null);
  const [editingFyVal, setEditingFyVal] = useState<string>('');

  // Import States
  const [approvedImportSummary, setApprovedImportSummary] = useState<any | null>(null);
  const [openImportSummary, setOpenImportSummary] = useState<any | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState<'approved' | 'open' | null>(null);
  const [refreshLoading, setRefreshLoading] = useState<boolean>(false);
  const [refreshSuccess, setRefreshSuccess] = useState<boolean>(false);

  const [pendingImport, setPendingImport] = useState<{
    file: File;
    type: 'approved' | 'open';
    projects: any[];
    detectedHeaders: string[];
    mappedColumns: Record<string, string>;
    rawRows: any[][];
    totalRowsRead: number;
    uniqueCount: number;
    duplicateCount: number;
    duplicateIds: string[];
  } | null>(null);
  const [debugMode, setDebugMode] = useState<boolean>(false);


  const loadFiscalYears = async () => {
    try {
      const data = await dbService.getFiscalYears();
      setFiscalYears(data);
      const activeFy = data.find(fy => fy.active);
      if (activeFy) {
        setFiscalYear(activeFy.fiscal_year);
      } else if (data.length > 0) {
        setFiscalYear(data[0].fiscal_year);
      }
      setImportFiscalYear('');
    } catch (e) {
      console.error(e);
    }
  };

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
    loadFiscalYears();
  }, []);

  const handleAddFiscalYear = async (e: React.FormEvent) => {
    e.preventDefault();
    setFyMessage(null);
    const fyStr = newFiscalYear.trim().toUpperCase();
    if (!fyStr) return;
    if (!/^FY\d{2}$/.test(fyStr)) {
      setFyMessage({ type: 'error', text: 'Format must be FY followed by 2 digits (e.g. FY27)' });
      return;
    }
    try {
      await dbService.addFiscalYear(fyStr);
      setFyMessage({ type: 'success', text: `FY ${fyStr} successfully added!` });
      setNewFiscalYear('');
      await loadFiscalYears();
    } catch (err: any) {
      setFyMessage({ type: 'error', text: err.message || 'Error adding FY.' });
    }
  };

  const handleSetActiveFiscalYear = async (id: string) => {
    try {
      await dbService.updateFiscalYearActive(id, true);
      await loadFiscalYears();
      window.dispatchEvent(new Event('lean-impact-db-changed'));
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleDeleteFiscalYear = async (id: string, fiscalYearStr: string) => {
    try {
      const hasData = await dbService.checkFiscalYearData(fiscalYearStr);
      if (hasData) {
        if (!confirm(`This FY contains project or target data.\n\nAre you sure you want to delete ${fiscalYearStr} and all related records? This action cannot be undone.`)) {
          return;
        }
      } else {
        if (!confirm(`Are you sure you want to delete ${fiscalYearStr}?`)) {
          return;
        }
      }
      await dbService.deleteFiscalYearCascade(id, fiscalYearStr);
      await loadFiscalYears();
      window.dispatchEvent(new Event('lean-impact-db-changed'));
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error deleting FY.');
    }
  };

  const handleStartEditFy = (id: string, val: string) => {
    setEditingFyId(id);
    setEditingFyVal(val);
  };

  const handleSaveEditFy = async (id: string) => {
    const cleanVal = editingFyVal.trim().toUpperCase();
    if (!cleanVal || !/^FY\d{2}$/.test(cleanVal)) {
      alert('Format must be FY followed by 2 digits (e.g. FY27)');
      return;
    }
    try {
      await dbService.renameFiscalYear(id, cleanVal);
      setEditingFyId(null);
      await loadFiscalYears();
      window.dispatchEvent(new Event('lean-impact-db-changed'));
    } catch (err: any) {
      alert(err.message || 'Error updating FY.');
    }
  };

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
      setTargetMessage({ type: 'success', text: `Target for ${fiscalYear} ${quarter} successfully saved!` });
      setTargetAmount('');
      loadTargets();
    } catch (err: any) {
      setTargetMessage({ type: 'error', text: err.message || 'Error saving target.' });
    }
  };

  interface ParseResult {
    projects: any[];
    rawRows: any[][];
    detectedHeaders: string[];
    mappedColumns: Record<string, string>;
    totalRowsRead: number;
    uniqueCount: number;
    duplicateCount: number;
    duplicateIds: string[];
  }

  const parseExcelFile = (file: File, type: 'approved' | 'open', selectedFy: string): Promise<ParseResult> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Match targeted sheet name first, fall back to first sheet
          const targetName = type === 'approved' ? 'ApprovedKaizenProjectList' : 'KaizenOpenProjectList';
          const matchedSheetName = workbook.SheetNames.find(name => name.toLowerCase() === targetName.toLowerCase());
          const sheetName = matchedSheetName || workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          
          if (!sheet) {
            return reject(new Error(`Could not find sheet in workbook.`));
          }

          // Get 2D grid array of all rows in the sheet
          const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
          
          if (rawRows.length === 0) {
            return reject(new Error('The uploaded sheet is completely empty.'));
          }

          // Step 1: Detect the first projects table header row automatically
          const synonymsToIdentify = [
            'projectid', 'projecttitle', 'title', 'workshopname', 'workshop',
            'leader', 'facilitator', 'status', 'functionalarea', 'projectapprovaldate',
            'projectcreateddate', 'opcontribution', 'softsavings', 'inventoryarapsavings'
          ];

          let headerRowIndex = -1;
          for (let i = 0; i < rawRows.length; i++) {
            const rowCells = rawRows[i];
            if (!rowCells || rowCells.length === 0) continue;
            
            let matchCount = 0;
            rowCells.forEach(cell => {
              if (cell === null || cell === undefined || cell === '') return;
              const normalized = cell.toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '');
              if (synonymsToIdentify.includes(normalized)) {
                matchCount++;
              }
            });

            // If a row has at least 3 matching synonyms, it is our project table header!
            if (matchCount >= 3) {
              headerRowIndex = i;
              break;
            }
          }

          if (headerRowIndex === -1) {
            return reject(new Error('Could not automatically detect a valid project table. Ensure the file contains columns like "Project ID", "Project Title", "Facilitator", etc.'));
          }

          const headerRow = rawRows[headerRowIndex];
          const detectedHeaders = headerRow.map(c => c ? c.toString().trim() : '');

          // Step 2: Map columns based on synonyms
          const idSyns = ['projectid', 'id', 'code', 'project_id', 'clave'];
          const titleSyns = ['projecttitle', 'title', 'name', 'projectname', 'titulo', 'nombre'];
          const workshopSyns = ['workshopname', 'workshop', 'event', 'taller', 'program', 'programa'];
          const typeSyns = ['projecttype', 'type', 'tipo', 'project_type'];
          const leaderSyns = ['leader', 'projectleader', 'lider', 'responsable'];
          const facilitatorSyns = ['facilitator', 'facilitador', 'leanfacilitator', 'kaizenfacilitator'];
          const statusSyns = ['status', 'state', 'estatus', 'estado', 'fase'];
          const opSyns = ['opcontribution', 'operationalsavings', 'op_contribution', 'contribucionoperacional', 'operacional'];
          const softSyns = ['softsavings', 'soft_savings', 'ahorrossoft', 'soft'];
          const inventorySyns = ['inventoryarapsavings', 'inventorysavings', 'inventoryreduction', 'inventory_savings', 'inventario', 'ahorrosinventario'];
          const fteSyns = ['fte', 'ftesavings', 'fte_savings', 'headcount'];
          const oneTimeSyns = ['onetime', 'onetimesavings', 'one_time_savings', 'ahorrosonetime', 'eventual'];
          const areaSyns = ['functionalarea', 'area', 'functional_area', 'departamento', 'seccion'];
          const catSyns = ['category', 'projectcategory', 'project_category', 'categoria', 'pilar'];
          const custSyns = ['customer', 'client', 'cliente', 'customername'];
          const busSyns = ['business', 'businessunit', 'business_unit', 'negocio', 'segmento'];
          const compDateSyns = ['completiondate', 'enddate', 'completion_date', 'fechaterminacion', 'fecha_fin'];

          // Dates
          const approvedDateSyns = ['projectapprovaldate', 'approvaldate', 'dateapproved', 'approval_date', 'fechaaprobacion'];
          const openDateSyns = ['projectcreateddate', 'createddate', 'startdate', 'created_date', 'fechacreacion', 'fecha_inicio'];

          // Mapped indices
          const findColIdx = (syns: string[]): number => {
            return detectedHeaders.findIndex(h => {
              const normalized = h.toLowerCase().replace(/[^a-z0-9]/g, '');
              return syns.some(syn => {
                const normalizedSyn = syn.toLowerCase().replace(/[^a-z0-9]/g, '');
                return normalized === normalizedSyn || normalized.includes(normalizedSyn);
              });
            });
          };

          const colIdxId = findColIdx(idSyns);
          const colIdxTitle = findColIdx(titleSyns);
          const colIdxWorkshop = findColIdx(workshopSyns);
          const colIdxType = findColIdx(typeSyns);
          const colIdxLeader = findColIdx(leaderSyns);
          const colIdxFacilitator = findColIdx(facilitatorSyns);
          const colIdxStatus = findColIdx(statusSyns);
          const colIdxArea = findColIdx(areaSyns);
          const colIdxDate = type === 'approved' ? findColIdx(approvedDateSyns) : findColIdx(openDateSyns);

          // Check required validation
          const isStatusRequired = type === 'open';
          const isMissingStatus = isStatusRequired && colIdxStatus === -1;

          if (colIdxId === -1 || colIdxTitle === -1 || colIdxWorkshop === -1 || colIdxType === -1 || colIdxLeader === -1 || colIdxFacilitator === -1 || isMissingStatus || colIdxArea === -1 || colIdxDate === -1) {
            const missing = [];
            if (colIdxId === -1) missing.push('Project ID');
            if (colIdxTitle === -1) missing.push('Project Title');
            if (colIdxWorkshop === -1) missing.push('Workshop Name');
            if (colIdxType === -1) missing.push('Project Type');
            if (colIdxLeader === -1) missing.push('Leader');
            if (colIdxFacilitator === -1) missing.push('Facilitator');
            if (isMissingStatus) missing.push('Status');
            if (colIdxArea === -1) missing.push('Functional Area');
            if (colIdxDate === -1) missing.push(type === 'approved' ? 'Project Approval Date' : 'Project Created Date');

            return reject(new Error(`Missing required columns: ${missing.join(', ')}. Detected headers: [${detectedHeaders.join(', ')}].`));
          }

          // Optional column indices
          const colIdxOp = findColIdx(opSyns);
          const colIdxSoft = findColIdx(softSyns);
          const colIdxInventory = findColIdx(inventorySyns);
          const colIdxFte = findColIdx(fteSyns);
          const colIdxOneTime = findColIdx(oneTimeSyns);
          const colIdxCategory = findColIdx(catSyns);
          const colIdxCustomer = findColIdx(custSyns);
          const colIdxBusiness = findColIdx(busSyns);
          const colIdxComp = findColIdx(compDateSyns);

          const mappedColumns: Record<string, string> = {
            'Project ID': detectedHeaders[colIdxId],
            'Project Title': detectedHeaders[colIdxTitle],
            'Workshop Name': detectedHeaders[colIdxWorkshop],
            'Project Type': detectedHeaders[colIdxType],
            'Leader': detectedHeaders[colIdxLeader],
            'Facilitator': detectedHeaders[colIdxFacilitator],
            'Functional Area': detectedHeaders[colIdxArea],
            [type === 'approved' ? 'Project Approval Date' : 'Project Created Date']: detectedHeaders[colIdxDate]
          };

          if (colIdxStatus !== -1) {
            mappedColumns['Status'] = detectedHeaders[colIdxStatus];
          } else if (type === 'approved') {
            mappedColumns['Status'] = 'Approved (Defaulted)';
          }

          if (colIdxOp !== -1) mappedColumns['OP Contribution'] = detectedHeaders[colIdxOp];
          if (colIdxSoft !== -1) mappedColumns['Soft Savings'] = detectedHeaders[colIdxSoft];
          if (colIdxInventory !== -1) mappedColumns['Inventory ARAPSavings'] = detectedHeaders[colIdxInventory];
          if (colIdxFte !== -1) mappedColumns['FTE Savings'] = detectedHeaders[colIdxFte];
          if (colIdxOneTime !== -1) mappedColumns['One Time Savings'] = detectedHeaders[colIdxOneTime];
          if (colIdxComp !== -1) mappedColumns['Project Completion Date'] = detectedHeaders[colIdxComp];

          // Step 3: Iterate through rows below the header row
          const projects: any[] = [];
          for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
            const row = rawRows[i];
            if (!row || row.length === 0) continue;

            // Stop condition A: Check if row is completely empty
            const isEmptyRow = row.every(cell => cell === null || cell === undefined || cell.toString().trim() === '');
            if (isEmptyRow) {
              if (projects.length > 0) break;
              continue;
            }

            // Stop condition B: Check if we reached a repeated header block
            const idCell = row[colIdxId] ? row[colIdxId].toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '') : '';
            if (idCell === 'projectid') {
              break; 
            }

            // Stop condition C: Ignore Before/After, Action Items, Action Plan, Before & After, etc.
            const rowString = row.join(' ').toLowerCase();
            if (
              rowString.includes('before/after') || 
              rowString.includes('before & after') || 
              rowString.includes('action items') || 
              rowString.includes('action plan') ||
              rowString.includes('actionitem') ||
              rowString.includes('beforeafter')
            ) {
              break; 
            }

            // Extract required columns
            const pId = row[colIdxId] ? row[colIdxId].toString().trim() : '';
            const pTitle = row[colIdxTitle] ? row[colIdxTitle].toString().trim() : '';

            // Ignore empty ID rows or Totals
            if (!pId || !pTitle || pId.toLowerCase() === 'total' || pId.toLowerCase().includes('total')) {
              continue;
            }

            const pWorkshop = row[colIdxWorkshop] ? row[colIdxWorkshop].toString().trim() : '';
            const pType = row[colIdxType] ? row[colIdxType].toString().trim() : 'Kaizen';
            const pLeader = row[colIdxLeader] ? row[colIdxLeader].toString().trim() : '';
            const pFacilitator = row[colIdxFacilitator] ? row[colIdxFacilitator].toString().trim() : '';
            const pStatus = colIdxStatus !== -1 && row[colIdxStatus] ? row[colIdxStatus].toString().trim() : (type === 'approved' ? 'Approved' : 'Open');
            const pArea = row[colIdxArea] ? row[colIdxArea].toString().trim() : '';
            const pDate = row[colIdxDate] ? row[colIdxDate].toString().trim() : '';

            // Parsed numeric fields
            const parseVal = (idx: number): number => {
              if (idx === -1 || row[idx] === undefined || row[idx] === null || row[idx] === '') return 0;
              const cleanNum = row[idx].toString().replace(/[^0-9.-]/g, '');
              const val = parseFloat(cleanNum);
              return isNaN(val) ? 0 : val;
            };

            const opVal = parseVal(colIdxOp);
            const softVal = parseVal(colIdxSoft);
            const invVal = parseVal(colIdxInventory);
            const fteVal = parseVal(colIdxFte);
            const otVal = parseVal(colIdxOneTime);

            const formattedDate = convertExcelDate(pDate) || new Date().toISOString().split('T')[0];
            const compVal = colIdxComp !== -1 && row[colIdxComp] ? row[colIdxComp].toString().trim() : '';
            const formattedCompDate = convertExcelDate(compVal);

            // Compute Quarter: April-June Q1, July-Sept Q2, Oct-Dec Q3, Jan-Mar Q4
            const getQuarterStr = (dateStr: string): string => {
              const d = new Date(dateStr);
              if (isNaN(d.getTime())) return 'Q1';
              const m = d.getMonth() + 1; // 1-12
              if (m >= 4 && m <= 6) return 'Q1';
              if (m >= 7 && m <= 9) return 'Q2';
              if (m >= 10 && m <= 12) return 'Q3';
              return 'Q4';
            };

            const computedQuarter = getQuarterStr(formattedDate);

            const projectMapped: any = {
              project_id: pId,
              project_title: pTitle,
              workshop: pWorkshop,
              project_type: pType,
              leader: pLeader,
              facilitator: pFacilitator,
              status: pStatus,
              functional_area: pArea,
              op_contribution: opVal,
              soft_savings: softVal,
              inventory_savings: invVal,
              fte_savings: fteVal,
              one_time_savings: otVal,
              completion_date: formattedCompDate,
              _raw_date: pDate,
              _raw_comp_date: compVal,
              fiscal_year: selectedFy,
              fiscal_quarter: computedQuarter
            };

            if (type === 'approved') {
              projectMapped.approval_date = formattedDate;
            } else {
              projectMapped.created_date = formattedDate;
            }

            // Optional structural metadata
            projectMapped.project_category = colIdxCategory !== -1 && row[colIdxCategory] ? row[colIdxCategory].toString().trim() : 'General';
            projectMapped.customer = colIdxCustomer !== -1 && row[colIdxCustomer] ? row[colIdxCustomer].toString().trim() : '';
            projectMapped.business = colIdxBusiness !== -1 && row[colIdxBusiness] ? row[colIdxBusiness].toString().trim() : '';

            projects.push(projectMapped);
          }

          // Deduplicate projects by project_id
          const seenIds = new Set<string>();
          const uniqueProjects: any[] = [];
          const duplicateIds: string[] = [];

          projects.forEach(p => {
            const id = p.project_id;
            if (seenIds.has(id)) {
              duplicateIds.push(id);
            } else {
              seenIds.add(id);
              uniqueProjects.push(p);
            }
          });

          // Log duplicate project IDs detected
          if (duplicateIds.length > 0) {
            console.warn('[Excel Import] Duplicate project IDs detected and removed from import batch:', duplicateIds);
          }

          resolve({
            projects: uniqueProjects,
            rawRows,
            detectedHeaders,
            mappedColumns,
            totalRowsRead: projects.length,
            uniqueCount: uniqueProjects.length,
            duplicateCount: duplicateIds.length,
            duplicateIds
          });

        } catch (err: any) {
          reject(new Error(err.message || 'Failed to parse Excel file. Ensure it is a valid XLS or XLSX file.'));
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
      const result = await parseExcelFile(file, type, importFiscalYear);
      
      setPendingImport({
        file,
        type,
        projects: result.projects,
        detectedHeaders: result.detectedHeaders,
        mappedColumns: result.mappedColumns,
        rawRows: result.rawRows,
        totalRowsRead: result.totalRowsRead,
        uniqueCount: result.uniqueCount,
        duplicateCount: result.duplicateCount,
        duplicateIds: result.duplicateIds
      });
    } catch (err: any) {
      console.error(err);
      setImportError(err.message || 'Error processing Excel import.');
    } finally {
      setImportLoading(null);
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingImport) return;
    const { type, projects, file } = pendingImport;
    setImportLoading(type);
    setImportError(null);

    try {
      let summary;
      if (type === 'approved') {
        summary = await dbService.importApprovedProjects(projects as any, importFiscalYear);
        setApprovedImportSummary({
          fileName: file.name,
          totalRows: projects.length,
          inserted: summary.inserted,
          updated: summary.updated
        });
      } else {
        summary = await dbService.importOpenProjects(projects as any, importFiscalYear);
        setOpenImportSummary({
          fileName: file.name,
          totalRows: projects.length,
          inserted: summary.inserted,
          updated: summary.updated
        });
      }
      setPendingImport(null);
      window.dispatchEvent(new Event('lean-impact-db-changed'));
    } catch (err: any) {
      console.error(err);
      setImportError(err.message || 'Error importing projects to database.');
    } finally {
      setImportLoading(null);
    }
  };

  const handleCancelImport = () => {
    setPendingImport(null);
    setImportError(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'approved' | 'open') => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processImport(files[0], type);
    }
    e.target.value = '';
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
        
        {/* Section 1: FY Management */}
        <div className="card">
          <div className="card-header-row" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '16px' }}>
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={20} className="text-primary" />
              FY Management
            </span>
          </div>

          <div className="config-row-grid" style={{ marginTop: '20px' }}>
            {/* Form */}
            <form onSubmit={handleAddFiscalYear} className="form-grid-quarter" style={{ gap: '16px' }}>
              <div className="filter-group">
                <label className="filter-label">Add FY (e.g. FY27)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. FY27"
                  value={newFiscalYear}
                  onChange={(e) => setNewFiscalYear(e.target.value)}
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
              <span className="filter-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Active FY List</span>
              {fiscalYears.length > 0 ? (
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {fiscalYears.map(fy => (
                    <li key={fy.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '6px', borderBottom: '1px dashed var(--color-border)' }}>
                      {editingFyId === fy.id ? (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <input 
                            type="text" 
                            className="form-input" 
                            style={{ width: '80px', padding: '4px', height: '28px', fontSize: '0.8rem' }}
                            value={editingFyVal} 
                            onChange={(e) => setEditingFyVal(e.target.value)} 
                          />
                          <button onClick={() => handleSaveEditFy(fy.id)} className="btn-submit" style={{ padding: '2px 8px', fontSize: '0.75rem', height: '28px' }}>Save</button>
                          <button onClick={() => setEditingFyId(null)} className="btn-signout" style={{ padding: '2px 8px', fontSize: '0.75rem', height: '28px', backgroundColor: '#FFFFFF', color: '#6B7280', borderColor: '#D1D5DB' }}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600 }}>{getFyDisplayLabel(fy.fiscal_year)}</span>
                          {fy.active && <span style={{ fontSize: '0.7rem', color: '#15803D', backgroundColor: '#DCFCE7', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>Active</span>}
                        </div>
                      )}
                      
                      {editingFyId !== fy.id && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {!fy.active && (
                            <button 
                              onClick={() => handleSetActiveFiscalYear(fy.id)} 
                              style={{ border: 'none', background: 'none', color: '#3B82F6', cursor: 'pointer', fontSize: '0.8rem' }}
                            >
                              Set Active
                            </button>
                          )}
                          <button 
                            onClick={() => handleStartEditFy(fy.id, fy.fiscal_year)} 
                            style={{ border: 'none', background: 'none', color: '#4B5563', cursor: 'pointer', fontSize: '0.8rem' }}
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => handleDeleteFiscalYear(fy.id, fy.fiscal_year)} 
                            style={{ border: 'none', background: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '0.8rem' }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <span style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>No FYs configured.</span>
              )}
            </div>
          </div>

          {fyMessage && (
            <div className={`summary-card` } style={{ 
              marginTop: '16px', 
              backgroundColor: fyMessage.type === 'success' ? '#DCFCE7' : '#FEE2E2',
              borderColor: fyMessage.type === 'success' ? '#A7F3D0' : '#FCA5A5',
              color: fyMessage.type === 'success' ? '#15803D' : '#EF4444'
            }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {fyMessage.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{fyMessage.text}</span>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Savings Targets */}
        <div className="card" style={{ marginTop: '24px' }}>
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
                <label className="filter-label">FY</label>
                <select className="filter-select" value={fiscalYear} onChange={(e) => setFiscalYear(e.target.value)}>
                  {fiscalYears.map(fy => (
                    <option key={fy.id} value={fy.fiscal_year}>{getFyDisplayLabel(fy.fiscal_year)}</option>
                  ))}
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
                      <span style={{ fontWeight: 600 }}>{t.fiscal_year.startsWith('FY') ? t.fiscal_year : `FY${t.fiscal_year}`} - {t.quarter}</span>
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
        {pendingImport && (
          <div className="card" style={{ borderLeft: '4px solid #16A34A', backgroundColor: '#F0FDF4', padding: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#14532D', margin: 0 }}>
                  <FileSpreadsheet size={24} style={{ color: '#16A34A' }} />
                  Excel Import Preview & Mappings (Pending Confirmation)
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#16A34A', backgroundColor: '#DCFCE7', padding: '4px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                  {pendingImport.type === 'approved' ? 'Approved Projects List' : 'Open Projects List'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ color: '#374151', fontWeight: 600 }}>File Name:</span>
                  <span style={{ color: '#111827', wordBreak: 'break-all' }}>{pendingImport.file.name}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ color: '#374151', fontWeight: 600 }}>Total Rows Read:</span>
                  <span style={{ color: '#111827', fontSize: '1rem', fontWeight: 'bold' }}>{pendingImport.totalRowsRead} rows</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ color: '#374151', fontWeight: 600 }}>Unique Project IDs:</span>
                  <span style={{ color: '#15803D', fontSize: '1rem', fontWeight: 'bold' }}>{pendingImport.uniqueCount} rows</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ color: '#374151', fontWeight: 600 }}>Duplicate IDs Removed:</span>
                  <span style={{ color: pendingImport.duplicateCount > 0 ? '#DC2626' : '#4B5563', fontSize: '1rem', fontWeight: 'bold' }}>
                    {pendingImport.duplicateCount} duplicates
                  </span>
                </div>
              </div>

              {pendingImport.duplicateCount > 0 && (
                <div style={{ padding: '12px', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '6px', fontSize: '0.75rem', color: '#991B1B' }}>
                  <strong style={{ display: 'block', marginBottom: '4px' }}>⚠️ Duplicate Project IDs detected & removed from import batch:</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '80px', overflowY: 'auto' }}>
                    {pendingImport.duplicateIds.map((id, idx) => (
                      <span key={idx} style={{ backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>
                        {id}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Detected Headers */}
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
                  All Detected Column Headers in File (Troubleshooting Preview):
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '100px', overflowY: 'auto', border: '1px solid #D1D5DB', borderRadius: '6px', padding: '8px', backgroundColor: '#FFFFFF' }}>
                  {pendingImport.detectedHeaders.map((header, idx) => (
                    <span key={idx} style={{ fontSize: '0.7rem', backgroundColor: '#F3F4F6', color: '#374151', padding: '2px 6px', borderRadius: '4px', border: '1px solid #E5E7EB' }}>
                      {header || `(Empty Column ${idx + 1})`}
                    </span>
                  ))}
                </div>
              </div>

              {/* Date Mappings Preview */}
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
                  📅 Date Conversion Preview (Original Excel Value ➔ Converted Date):
                </span>
                <div style={{ overflowX: 'auto', border: '1px solid #D1D5DB', borderRadius: '6px', backgroundColor: '#FFFFFF' }}>
                  <table style={{ minWidth: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F3F4F6' }}>
                        <th style={{ padding: '6px 8px', borderBottom: '1px solid #D1D5DB', color: '#4B5563', fontWeight: 'bold' }}>Project ID</th>
                        <th style={{ padding: '6px 8px', borderBottom: '1px solid #D1D5DB', color: '#4B5563', fontWeight: 'bold' }}>Project Title</th>
                        <th style={{ padding: '6px 8px', borderBottom: '1px solid #D1D5DB', color: '#4B5563', fontWeight: 'bold' }}>
                          {pendingImport.type === 'approved' ? 'Approval Date' : 'Created Date'} (Original ➔ ISO)
                        </th>
                        <th style={{ padding: '6px 8px', borderBottom: '1px solid #D1D5DB', color: '#4B5563', fontWeight: 'bold' }}>
                          Completion Date (Original ➔ ISO)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingImport.projects.slice(0, 5).map((p, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB' }}>
                          <td style={{ padding: '6px 8px', color: '#111827', fontWeight: 600 }}>{p.project_id}</td>
                          <td style={{ padding: '6px 8px', color: '#374151', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.project_title}</td>
                          <td style={{ padding: '6px 8px', color: '#111827' }}>
                            <span style={{ color: '#6B7280' }}>{p._raw_date || '(Blank)'}</span>
                            <span> ➔ </span>
                            <strong style={{ color: '#15803D' }}>{p.approval_date || p.created_date || 'NULL'}</strong>
                          </td>
                          <td style={{ padding: '6px 8px', color: '#111827' }}>
                            <span style={{ color: '#6B7280' }}>{p._raw_comp_date || '(Blank)'}</span>
                            <span> ➔ </span>
                            <strong style={{ color: p.completion_date ? '#15803D' : '#9CA3AF' }}>{p.completion_date || 'NULL'}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
                  Mapped Columns:
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', border: '1px solid #D1D5DB', borderRadius: '6px', padding: '10px', backgroundColor: '#FFFFFF' }}>
                  {Object.entries(pendingImport.mappedColumns).map(([field, mappedHeader]) => (
                    <div key={field} style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #E5E7EB', paddingBottom: '4px' }}>
                      <span style={{ color: '#4B5563', fontWeight: 500 }}>{field}:</span>
                      <strong style={{ color: '#15803D' }}>{mappedHeader}</strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* Debug Mode Raw Row Preview (10 Rows) */}
              {debugMode && (
                <div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
                    🐛 Debug Mode: First 10 Raw Sheet Rows (Before Validation)
                  </span>
                  <div style={{ overflowX: 'auto', border: '1px solid #D1D5DB', borderRadius: '6px', maxHeight: '200px', backgroundColor: '#FFFFFF' }}>
                    <table style={{ minWidth: '100%', borderCollapse: 'collapse', fontSize: '0.7rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#F3F4F6' }}>
                          {pendingImport.rawRows[0]?.map((_, colIdx) => (
                            <th key={colIdx} style={{ padding: '6px 8px', borderBottom: '1px solid #D1D5DB', color: '#4B5563', fontWeight: 'bold' }}>
                              Col {colIdx + 1}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pendingImport.rawRows.slice(0, 10).map((row, rowIdx) => (
                          <tr key={rowIdx} style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: rowIdx % 2 === 0 ? '#FFFFFF' : '#F9FAFB' }}>
                            {row.map((cell, cellIdx) => (
                              <td key={cellIdx} style={{ padding: '6px 8px', whiteSpace: 'nowrap', color: '#1F2937' }}>
                                {cell !== null && cell !== undefined ? cell.toString() : ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Warning message */}
              <div style={{ padding: '16px', backgroundColor: '#FEF3C7', borderLeft: '4px solid #D97706', borderRadius: '6px', fontSize: '0.875rem', color: '#92400E', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontWeight: 700 }}>⚠️ Warning:</span>
                <span>Importing a new Kaizen file will replace all existing project data for {importFiscalYear}.</span>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button 
                  onClick={handleConfirmImport} 
                  disabled={importLoading !== null}
                  className="btn-submit"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', backgroundColor: '#DC2626', borderColor: '#DC2626' }}
                >
                  <CheckCircle size={16} />
                  <span>Replace and Import</span>
                </button>
                <button 
                  onClick={handleCancelImport}
                  disabled={importLoading !== null}
                  className="btn-signout"
                  style={{ width: '150px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', borderColor: '#4B5563', color: '#4B5563', backgroundColor: '#FFFFFF' }}
                >
                  <span>Cancel</span>
                </button>
              </div>

            </div>
          </div>
        )}

        <div className="config-row-grid">
          
          {/* Section 2: Approved Projects Import */}
          <div className="card">
            <div className="card-header-row" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '12px', marginBottom: '16px' }}>
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileSpreadsheet size={20} className="text-primary" />
                Import Approved Projects
              </span>
            </div>

            <div className="filter-group" style={{ marginBottom: '16px' }}>
              <label className="filter-label" style={{ fontWeight: 600 }}>Target Import FY</label>
              <select 
                className="filter-select" 
                value={importFiscalYear} 
                onChange={(e) => setImportFiscalYear(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">-- Select FY --</option>
                {fiscalYears.map(fy => (
                  <option key={fy.id} value={fy.fiscal_year}>
                    {getFyDisplayLabel(fy.fiscal_year)} {fy.active ? '(Active)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
              <p style={{ fontSize: '0.8rem', color: '#6B7280', margin: 0 }}>
                Upload the Excel tracker (Sheet: <strong>ApprovedKaizenProjectList</strong>).
                Headers like <i>Project ID, Title, Facilitator, Workshop, and Approval Date</i> will be mapped.
              </p>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#4B5563', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
                <input 
                  type="checkbox" 
                  checked={debugMode} 
                  onChange={(e) => setDebugMode(e.target.checked)} 
                  style={{ width: '14px', height: '14px' }}
                />
                <span>Debug Mode</span>
              </label>
            </div>

            <label className="import-upload-zone" style={{ opacity: !importFiscalYear ? 0.6 : 1, cursor: !importFiscalYear ? 'not-allowed' : 'pointer' }}>
              <Upload className="import-upload-zone-icon" size={32} />
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1F2937' }}>
                {importLoading === 'approved' ? 'Analyzing file structure...' : !importFiscalYear ? '⚠️ Please select a Target Import FY first' : 'Click to select or drag Excel file'}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Supports XLS, XLSX</span>
              <input 
                type="file" 
                className="upload-input" 
                accept=".xlsx, .xls"
                onChange={(e) => handleFileUpload(e, 'approved')}
                disabled={importLoading !== null || !importFiscalYear}
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

            <div className="filter-group" style={{ marginBottom: '16px' }}>
              <label className="filter-label" style={{ fontWeight: 600 }}>Target Import FY</label>
              <select 
                className="filter-select" 
                value={importFiscalYear} 
                onChange={(e) => setImportFiscalYear(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">-- Select FY --</option>
                {fiscalYears.map(fy => (
                  <option key={fy.id} value={fy.fiscal_year}>
                    {getFyDisplayLabel(fy.fiscal_year)} {fy.active ? '(Active)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
              <p style={{ fontSize: '0.8rem', color: '#6B7280', margin: 0 }}>
                Upload the active pipeline Excel sheet (Sheet: <strong>KaizenOpenProjectList</strong>).
                Columns like <i>Project ID, Title, Facilitator, Workshop, and Created Date</i> are required.
              </p>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#4B5563', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
                <input 
                  type="checkbox" 
                  checked={debugMode} 
                  onChange={(e) => setDebugMode(e.target.checked)} 
                  style={{ width: '14px', height: '14px' }}
                />
                <span>Debug Mode</span>
              </label>
            </div>

            <label className="import-upload-zone" style={{ borderStyle: 'dashed', opacity: !importFiscalYear ? 0.6 : 1, cursor: !importFiscalYear ? 'not-allowed' : 'pointer' }}>
              <Upload style={{ color: '#3B82F6' }} size={32} />
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1F2937' }}>
                {importLoading === 'open' ? 'Analyzing file structure...' : !importFiscalYear ? '⚠️ Please select a Target Import FY first' : 'Click to select or drag Excel file'}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Supports XLS, XLSX</span>
              <input 
                type="file" 
                className="upload-input" 
                accept=".xlsx, .xls"
                onChange={(e) => handleFileUpload(e, 'open')}
                disabled={importLoading !== null || !importFiscalYear}
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
