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
}

export interface SavingsTarget {
  id: string;
  fiscal_year: number;
  quarter: string; // 'Q1', 'Q2', 'Q3', 'Q4', or 'Annual'
  target_amount: number;
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

  async saveSavingsTarget(target: { fiscal_year: number; quarter: string; target_amount: number }): Promise<SavingsTarget> {
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
      business: String(p.business || '').trim()
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
      business: String(p.business || '').trim()
    }));

    // Log the final payload before saving
    console.log('[Supabase Open Import Payload]:', dbProjects);

    const { error } = await supabase
      .from('projects_open')
      .upsert(dbProjects, { onConflict: 'project_id' });

    if (error) throw error;
    return { inserted: dbProjects.length, updated: 0 };
  },
};
