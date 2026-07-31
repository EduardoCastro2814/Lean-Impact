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
    const dbProjects = projects.map(p => ({
      ...p,
      total_savings: p.op_contribution + p.soft_savings + p.inventory_savings + p.one_time_savings
    }));

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
    const dbProjects = projects.map(p => ({
      ...p,
      potential_savings: p.op_contribution + p.soft_savings + p.inventory_savings + p.one_time_savings
    }));

    const { error } = await supabase
      .from('projects_open')
      .upsert(dbProjects, { onConflict: 'project_id' });

    if (error) throw error;
    return { inserted: dbProjects.length, updated: 0 };
  },
};
