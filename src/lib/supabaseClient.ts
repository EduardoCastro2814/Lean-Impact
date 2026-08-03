import { createClient } from '@supabase/supabase-js';

// Read Supabase credentials from Vite environment variables
export const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || '';
export const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

// Always create the client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface ProjectApproved {
  id: string;
  project_id: string;
  project_title: string;
  workshop: string;
  project_type: string; // 'Kaizen', 'SGA', 'IKW', 'Other'
  leader: string;
  facilitator: string;
  approval_date: string;
  completion_date: string | null;
  status: string;
  op_contribution: number;
  soft_savings: number;
  inventory_savings: number;
  fte_savings: number;
  one_time_savings: number;
  total_savings: number;
  functional_area: string;
  project_category?: string;
  customer?: string;
  business?: string;
  created_at: string;
  fiscal_year?: string;
  fiscal_quarter?: string;
}

export interface ProjectOpen {
  id: string;
  project_id: string;
  project_title: string;
  workshop: string;
  project_type: string; // 'Kaizen', 'SGA', 'IKW', 'Other'
  leader: string;
  facilitator: string;
  status: string;
  created_date: string;
  completion_date: string | null;
  op_contribution: number;
  soft_savings: number;
  inventory_savings: number;
  fte_savings: number;
  one_time_savings: number;
  potential_savings: number;
  functional_area: string;
  project_category?: string;
  customer?: string;
  business?: string;
  created_at: string;
  fiscal_year?: string;
  fiscal_quarter?: string;
}

export interface SavingsTarget {
  id: string;
  fiscal_year: string;
  quarter: string; // 'Q1', 'Q2', 'Q3', 'Q4', or 'Annual'
  target_amount: number;
  created_at: string;
}

export interface FiscalYear {
  id: string;
  fiscal_year: string;
  active: boolean;
  created_at: string;
}

// Check database connectivity
export const checkConnection = async (): Promise<boolean> => {
  try {
    if (!supabaseUrl || !supabaseAnonKey) return false;
    // Select count or id with limit 1 to verify credentials and endpoint availability
    const { error } = await supabase.from('savings_targets').select('id').limit(1);
    if (error) {
      console.error('Supabase connection check failed:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Supabase connection check exception:', e);
    return false;
  }
};

export const getFyDisplayLabel = (fy: string | null | undefined): string => {
  if (!fy) return '';
  const cleanFy = fy.trim().toUpperCase();
  if (cleanFy === 'FY26') return 'FY26 (Apr 2025 - Mar 2026)';
  if (cleanFy === 'FY27') return 'FY27 (Apr 2026 - Mar 2027)';
  if (cleanFy === 'FY28') return 'FY28 (Apr 2027 - Mar 2028)';
  if (cleanFy === 'FY29') return 'FY29 (Apr 2028 - Mar 2029)';
  
  const match = cleanFy.match(/^FY(\d{2})$/);
  if (match) {
    const yy = parseInt(match[1]);
    const startYear = 2000 + yy - 1;
    const endYear = 2000 + yy;
    return `${cleanFy} (Apr ${startYear} - Mar ${endYear})`;
  }
  return cleanFy;
};

// ----------------------------------------------------
// DATABASE API INTERFACE (Supabase ONLY)
// ----------------------------------------------------
export const dbService = {
  // --- SAVINGS TARGETS ---
  async getSavingsTargets(): Promise<SavingsTarget[]> {
    const { data, error } = await supabase
      .from('savings_targets')
      .select('*')
      .order('fiscal_year', { ascending: true })
      .order('quarter', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },

  async saveSavingsTarget(target: { fiscal_year: string; quarter: string; target_amount: number }): Promise<SavingsTarget> {
    const { data, error } = await supabase
      .from('savings_targets')
      .upsert({
        fiscal_year: target.fiscal_year,
        quarter: target.quarter,
        target_amount: target.target_amount
      }, { onConflict: 'fiscal_year,quarter' })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // --- PROJECTS APPROVED ---
  async getProjectsApproved(): Promise<ProjectApproved[]> {
    const { data, error } = await supabase
      .from('projects_approved')
      .select('*')
      .order('approval_date', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async importApprovedProjects(projects: Omit<ProjectApproved, 'id' | 'created_at'>[]): Promise<{ inserted: number; updated: number }> {
    const dbProjects = projects.map((p: any) => ({
      project_id: String(p.project_id || '').trim(),
      project_title: String(p.project_title || '').trim(),
      workshop: String(p.workshop || '').trim(),
      project_type: String(p.project_type || '').trim(),
      leader: String(p.leader || '').trim(),
      facilitator: String(p.facilitator || '').trim(),
      approval_date: p.approval_date,
      completion_date: p.completion_date,
      status: String(p.status || 'Approved').trim(),
      op_contribution: Number(p.op_contribution || 0),
      soft_savings: Number(p.soft_savings || 0),
      inventory_savings: Number(p.inventory_savings || 0),
      fte_savings: Number(p.fte_savings || 0),
      one_time_savings: Number(p.one_time_savings || 0),
      total_savings: Number((p.op_contribution || 0) + (p.soft_savings || 0) + (p.inventory_savings || 0) + (p.one_time_savings || 0)),
      functional_area: String(p.functional_area || '').trim(),
      project_category: String(p.project_category || 'General').trim(),
      customer: String(p.customer || '').trim(),
      business: String(p.business || '').trim(),
      fiscal_year: String(p.fiscal_year || '').trim(),
      fiscal_quarter: String(p.fiscal_quarter || '').trim()
    }));

    // Log the final payload before saving
    console.log('[Supabase Approved Import Payload]:', dbProjects);

    const { error } = await supabase
      .from('projects_approved')
      .upsert(dbProjects, { onConflict: 'project_id' });

    if (error) throw error;
    return { inserted: dbProjects.length, updated: 0 };
  },

  // --- PROJECTS OPEN ---
  async getProjectsOpen(): Promise<ProjectOpen[]> {
    const { data, error } = await supabase
      .from('projects_open')
      .select('*')
      .order('created_date', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async importOpenProjects(projects: Omit<ProjectOpen, 'id' | 'created_at'>[]): Promise<{ inserted: number; updated: number }> {
    const dbProjects = projects.map((p: any) => ({
      project_id: String(p.project_id || '').trim(),
      project_title: String(p.project_title || '').trim(),
      workshop: String(p.workshop || '').trim(),
      project_type: String(p.project_type || '').trim(),
      leader: String(p.leader || '').trim(),
      facilitator: String(p.facilitator || '').trim(),
      created_date: p.created_date,
      completion_date: p.completion_date,
      status: String(p.status || 'Open').trim(),
      op_contribution: Number(p.op_contribution || 0),
      soft_savings: Number(p.soft_savings || 0),
      inventory_savings: Number(p.inventory_savings || 0),
      fte_savings: Number(p.fte_savings || 0),
      one_time_savings: Number(p.one_time_savings || 0),
      potential_savings: Number((p.op_contribution || 0) + (p.soft_savings || 0) + (p.inventory_savings || 0) + (p.one_time_savings || 0)),
      functional_area: String(p.functional_area || '').trim(),
      project_category: String(p.project_category || 'General').trim(),
      customer: String(p.customer || '').trim(),
      business: String(p.business || '').trim(),
      fiscal_year: String(p.fiscal_year || '').trim(),
      fiscal_quarter: String(p.fiscal_quarter || '').trim()
    }));

    // Log the final payload before saving
    console.log('[Supabase Open Import Payload]:', dbProjects);

    const { error } = await supabase
      .from('projects_open')
      .upsert(dbProjects, { onConflict: 'project_id' });

    if (error) throw error;
    return { inserted: dbProjects.length, updated: 0 };
  },

  // --- FISCAL YEARS ---
  async getFiscalYears(): Promise<FiscalYear[]> {
    try {
      const { data, error } = await supabase
        .from('fiscal_years')
        .select('*')
        .order('fiscal_year', { ascending: true });
      
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('Could not query fiscal_years table, using fallback.', e);
      return [
        { id: '1', fiscal_year: 'FY26', active: true, created_at: '' },
        { id: '2', fiscal_year: 'FY27', active: false, created_at: '' },
        { id: '3', fiscal_year: 'FY28', active: false, created_at: '' }
      ];
    }
  },

  async addFiscalYear(fy: string): Promise<FiscalYear> {
    const { data, error } = await supabase
      .from('fiscal_years')
      .insert({ fiscal_year: fy, active: false })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateFiscalYearActive(id: string, active: boolean): Promise<void> {
    if (active) {
      // Set all others to active = false first
      await supabase.from('fiscal_years').update({ active: false }).neq('id', id);
    }
    const { error } = await supabase
      .from('fiscal_years')
      .update({ active })
      .eq('id', id);
    if (error) throw error;
  },

  async renameFiscalYear(id: string, newFy: string): Promise<void> {
    const { error } = await supabase
      .from('fiscal_years')
      .update({ fiscal_year: newFy })
      .eq('id', id);
    if (error) throw error;
  },

  async deleteFiscalYear(id: string): Promise<void> {
    const { error } = await supabase
      .from('fiscal_years')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async checkFiscalYearData(fiscalYear: string): Promise<boolean> {
    const [targets, approved, open] = await Promise.all([
      supabase.from('savings_targets').select('id').eq('fiscal_year', fiscalYear).limit(1),
      supabase.from('projects_approved').select('id').eq('fiscal_year', fiscalYear).limit(1),
      supabase.from('projects_open').select('id').eq('fiscal_year', fiscalYear).limit(1)
    ]);
    const hasTargets = (targets.data && targets.data.length > 0) || false;
    const hasApproved = (approved.data && approved.data.length > 0) || false;
    const hasOpen = (open.data && open.data.length > 0) || false;
    return hasTargets || hasApproved || hasOpen;
  },

  async deleteFiscalYearCascade(id: string, fiscalYear: string): Promise<void> {
    // 1. Fetch the active state of the FY being deleted
    const { data: fyData } = await supabase
      .from('fiscal_years')
      .select('active')
      .eq('id', id)
      .single();
    
    const wasActive = fyData?.active;

    // 2. Cascade update projects to null and delete targets
    await Promise.all([
      supabase.from('savings_targets').delete().eq('fiscal_year', fiscalYear),
      supabase.from('projects_approved').update({ fiscal_year: null, fiscal_quarter: null }).eq('fiscal_year', fiscalYear),
      supabase.from('projects_open').update({ fiscal_year: null, fiscal_quarter: null }).eq('fiscal_year', fiscalYear)
    ]);

    // 3. Delete the FY
    const { error } = await supabase.from('fiscal_years').delete().eq('id', id);
    if (error) throw error;

    // 4. If it was active, set another FY to active
    if (wasActive) {
      const { data: list } = await supabase
        .from('fiscal_years')
        .select('id')
        .order('fiscal_year', { ascending: true })
        .limit(1);
      
      if (list && list.length > 0) {
        await dbService.updateFiscalYearActive(list[0].id, true);
      }
    }
  },
};
