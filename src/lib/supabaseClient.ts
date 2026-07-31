import { createClient } from '@supabase/supabase-js';

// Detect Supabase Environment Variables from Vite (.env)
export const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || '';
export const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

// Determine if environment variables are configured
export const isConfigured = Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('your-project'));
export const isMock = !isConfigured;

// Initialize Supabase client if configured
export const supabase = isConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;

// LocalStorage Keys
const STORAGE_PREFIX = 'lean_impact_';
const getStorageKey = (table: string) => `${STORAGE_PREFIX}${table}`;

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

// ----------------------------------------------------
// Mock Seed Data Definitions
// ----------------------------------------------------
const seedTargets: SavingsTarget[] = [
  { id: 't-2026-q1', fiscal_year: 2026, quarter: 'Q1', target_amount: 350000, created_at: new Date().toISOString() },
  { id: 't-2026-q2', fiscal_year: 2026, quarter: 'Q2', target_amount: 400000, created_at: new Date().toISOString() },
  { id: 't-2026-q3', fiscal_year: 2026, quarter: 'Q3', target_amount: 450000, created_at: new Date().toISOString() },
  { id: 't-2026-q4', fiscal_year: 2026, quarter: 'Q4', target_amount: 500000, created_at: new Date().toISOString() },
  { id: 't-2027-q1', fiscal_year: 2027, quarter: 'Q1', target_amount: 400000, created_at: new Date().toISOString() },
  { id: 't-2027-q2', fiscal_year: 2027, quarter: 'Q2', target_amount: 450000, created_at: new Date().toISOString() },
  { id: 't-2027-q3', fiscal_year: 2027, quarter: 'Q3', target_amount: 500000, created_at: new Date().toISOString() },
  { id: 't-2027-q4', fiscal_year: 2027, quarter: 'Q4', target_amount: 550000, created_at: new Date().toISOString() },
];

const seedApproved: ProjectApproved[] = [
  {
    id: 'pa-1',
    project_id: 'K-2026-001',
    project_title: 'SMT Stencil Cleaning Optimization',
    workshop: 'SMT Process Kaizen',
    project_type: 'Kaizen',
    leader: 'Roberto Gomez',
    facilitator: 'Eduardo Castro',
    approval_date: '2026-01-15',
    completion_date: '2026-01-10',
    status: 'Approved',
    op_contribution: 45000,
    soft_savings: 10000,
    inventory_savings: 5000,
    fte_savings: 1.5,
    one_time_savings: 0,
    total_savings: 60000,
    functional_area: 'SMT',
    project_category: 'Productivity',
    customer: 'Tesla',
    business: 'Automotive',
    created_at: new Date().toISOString()
  },
  {
    id: 'pa-2',
    project_id: 'SGA-2026-002',
    project_title: 'Solder Paste Waste Reduction',
    workshop: 'Material SGA',
    project_type: 'SGA',
    leader: 'Silvia Garza',
    facilitator: 'Ana Lopez',
    approval_date: '2026-02-18',
    completion_date: '2026-02-12',
    status: 'Approved',
    op_contribution: 85000,
    soft_savings: 20000,
    inventory_savings: 15000,
    fte_savings: 0.5,
    one_time_savings: 5000,
    total_savings: 125000,
    functional_area: 'Ensamble',
    project_category: 'Cost',
    customer: 'Apple',
    business: 'Consumer',
    created_at: new Date().toISOString()
  },
  {
    id: 'pa-3',
    project_id: 'IKW-2026-003',
    project_title: 'ICT Testing Cycle Time Reduction',
    workshop: 'Testing IKW',
    project_type: 'IKW',
    leader: 'Pedro Silva',
    facilitator: 'Juan Martinez',
    approval_date: '2026-03-05',
    completion_date: '2026-03-01',
    status: 'Approved',
    op_contribution: 50000,
    soft_savings: 5000,
    inventory_savings: 0,
    fte_savings: 2.0,
    one_time_savings: 10000,
    total_savings: 65000,
    functional_area: 'Testing',
    project_category: 'Productivity',
    customer: 'Cisco',
    business: 'Industrial',
    created_at: new Date().toISOString()
  },
  {
    id: 'pa-4',
    project_id: 'K-2026-004',
    project_title: 'Component Feeder Setup Standardization',
    workshop: 'SMT Feeder Kaizen',
    project_type: 'Kaizen',
    leader: 'Maria Juarez',
    facilitator: 'Eduardo Castro',
    approval_date: '2026-03-25',
    completion_date: '2026-03-20',
    status: 'Approved',
    op_contribution: 35000,
    soft_savings: 8000,
    inventory_savings: 12000,
    fte_savings: 1.0,
    one_time_savings: 0,
    total_savings: 55000,
    functional_area: 'SMT',
    project_category: 'Productivity',
    customer: 'Tesla',
    business: 'Automotive',
    created_at: new Date().toISOString()
  },
  {
    id: 'pa-5',
    project_id: 'K-2026-005',
    project_title: 'Assembly Line 5 Ergonomics and Balance',
    workshop: 'Assembly Ergonomic Kaizen',
    project_type: 'Kaizen',
    leader: 'Julio Espinoza',
    facilitator: 'David Gomez',
    approval_date: '2026-04-12',
    completion_date: '2026-04-05',
    status: 'Approved',
    op_contribution: 60000,
    soft_savings: 15000,
    inventory_savings: 0,
    fte_savings: 1.2,
    one_time_savings: 0,
    total_savings: 75000,
    functional_area: 'Ensamble',
    project_category: 'Safety',
    customer: 'GM',
    business: 'Automotive',
    created_at: new Date().toISOString()
  },
  {
    id: 'pa-6',
    project_id: 'SGA-2026-006',
    project_title: 'Packaging Box Design Optimization',
    workshop: 'Packaging SGA',
    project_type: 'SGA',
    leader: 'Sandra Delgado',
    facilitator: 'Carlos Ortiz',
    approval_date: '2026-04-29',
    completion_date: '2026-04-20',
    status: 'Approved',
    op_contribution: 110000,
    soft_savings: 10000,
    inventory_savings: 30000,
    fte_savings: 0.5,
    one_time_savings: 15000,
    total_savings: 165000,
    functional_area: 'Packaging',
    project_category: 'Cost',
    customer: 'HP',
    business: 'Consumer',
    created_at: new Date().toISOString()
  },
  {
    id: 'pa-7',
    project_id: 'IKW-2026-007',
    project_title: 'Warehouse Kanban Implementation',
    workshop: 'Logistics IKW',
    project_type: 'IKW',
    leader: 'Jose Herrera',
    facilitator: 'Juan Martinez',
    approval_date: '2026-05-14',
    completion_date: '2026-05-08',
    status: 'Approved',
    op_contribution: 40000,
    soft_savings: 12000,
    inventory_savings: 65000,
    fte_savings: 0.8,
    one_time_savings: 0,
    total_savings: 117000,
    functional_area: 'Almacen',
    project_category: 'Inventory',
    customer: 'Cisco',
    business: 'Industrial',
    created_at: new Date().toISOString()
  },
  {
    id: 'pa-8',
    project_id: 'K-2026-008',
    project_title: 'Wave Soldering Nitrogen Level Control',
    workshop: 'Process Control Kaizen',
    project_type: 'Kaizen',
    leader: 'Diana Moreno',
    facilitator: 'Eduardo Castro',
    approval_date: '2026-05-28',
    completion_date: '2026-05-22',
    status: 'Approved',
    op_contribution: 72000,
    soft_savings: 18000,
    inventory_savings: 0,
    fte_savings: 0.0,
    one_time_savings: 0,
    total_savings: 90000,
    functional_area: 'SMT',
    project_category: 'Quality',
    customer: 'Tesla',
    business: 'Automotive',
    created_at: new Date().toISOString()
  },
  {
    id: 'pa-9',
    project_id: 'K-2026-009',
    project_title: 'Labeling Station Auto-Dispenser',
    workshop: 'Assembly Automation Kaizen',
    project_type: 'Kaizen',
    leader: 'Manuel Ortiz',
    facilitator: 'Ana Lopez',
    approval_date: '2026-06-10',
    completion_date: '2026-06-05',
    status: 'Approved',
    op_contribution: 30000,
    soft_savings: 5000,
    inventory_savings: 2000,
    fte_savings: 1.0,
    one_time_savings: 3000,
    total_savings: 40000,
    functional_area: 'Packaging',
    project_category: 'Productivity',
    customer: 'Apple',
    business: 'Consumer',
    created_at: new Date().toISOString()
  },
  {
    id: 'pa-10',
    project_id: 'SGA-2026-010',
    project_title: 'Reflow Oven Energy Conservation',
    workshop: 'Green SGA',
    project_type: 'SGA',
    leader: 'Elena Gomez',
    facilitator: 'Carlos Ortiz',
    approval_date: '2026-06-22',
    completion_date: '2026-06-15',
    status: 'Approved',
    op_contribution: 95000,
    soft_savings: 45000,
    inventory_savings: 0,
    fte_savings: 0.0,
    one_time_savings: 0,
    total_savings: 140000,
    functional_area: 'SMT',
    project_category: 'Cost',
    customer: 'HP',
    business: 'Industrial',
    created_at: new Date().toISOString()
  },
  {
    id: 'pa-11',
    project_id: 'IKW-2026-011',
    project_title: 'Receiving Dock Layout Optimization',
    workshop: 'Logistics Dock IKW',
    project_type: 'IKW',
    leader: 'Andres Ramos',
    facilitator: 'David Gomez',
    approval_date: '2026-07-02',
    completion_date: '2026-06-28',
    status: 'Approved',
    op_contribution: 50000,
    soft_savings: 8000,
    inventory_savings: 25000,
    fte_savings: 1.5,
    one_time_savings: 0,
    total_savings: 83000,
    functional_area: 'Almacen',
    project_category: 'Productivity',
    customer: 'GM',
    business: 'Automotive',
    created_at: new Date().toISOString()
  },
  {
    id: 'pa-12',
    project_id: 'K-2026-012',
    project_title: 'Screwing Station Torque Tracking',
    workshop: 'Assembly Quality Kaizen',
    project_type: 'Kaizen',
    leader: 'Roberto Rojas',
    facilitator: 'Eduardo Castro',
    approval_date: '2026-07-15',
    completion_date: '2026-07-10',
    status: 'Approved',
    op_contribution: 40000,
    soft_savings: 25000,
    inventory_savings: 0,
    fte_savings: 0.5,
    one_time_savings: 0,
    total_savings: 65000,
    functional_area: 'Ensamble',
    project_category: 'Quality',
    customer: 'Tesla',
    business: 'Automotive',
    created_at: new Date().toISOString()
  },
];

const seedOpen: ProjectOpen[] = [
  {
    id: 'po-1',
    project_id: 'K-2026-O01',
    project_title: 'Laser Marking Cycle Optimization',
    workshop: 'SMT Marking Kaizen',
    project_type: 'Kaizen',
    leader: 'Arturo Guerrero',
    facilitator: 'Eduardo Castro',
    status: 'Execution',
    created_date: '2026-05-10',
    completion_date: '2026-08-15',
    op_contribution: 35000,
    soft_savings: 5000,
    inventory_savings: 0,
    fte_savings: 1.0,
    one_time_savings: 2000,
    potential_savings: 42000,
    functional_area: 'SMT',
    project_category: 'Productivity',
    customer: 'Tesla',
    business: 'Automotive',
    created_at: new Date().toISOString()
  },
  {
    id: 'po-2',
    project_id: 'SGA-2026-O02',
    project_title: 'Scrap PCB Gold Component Recovery',
    workshop: 'Scrap Value SGA',
    project_type: 'SGA',
    leader: 'Yolanda Vargas',
    facilitator: 'Ana Lopez',
    status: 'Planning',
    created_date: '2026-06-01',
    completion_date: '2026-09-30',
    op_contribution: 90000,
    soft_savings: 15000,
    inventory_savings: 40000,
    fte_savings: 0.5,
    one_time_savings: 10000,
    potential_savings: 155000,
    functional_area: 'Ensamble',
    project_category: 'Cost',
    customer: 'Apple',
    business: 'Consumer',
    created_at: new Date().toISOString()
  },
  {
    id: 'po-3',
    project_id: 'IKW-2026-O03',
    project_title: 'Burn-in Chamber Load Optimization',
    workshop: 'Burn-in Cell IKW',
    project_type: 'IKW',
    leader: 'Hugo Sandoval',
    facilitator: 'Juan Martinez',
    status: 'Execution',
    created_date: '2026-06-15',
    completion_date: '2026-08-30',
    op_contribution: 65000,
    soft_savings: 10000,
    inventory_savings: 5000,
    fte_savings: 2.5,
    one_time_savings: 5000,
    potential_savings: 85000,
    functional_area: 'Testing',
    project_category: 'Productivity',
    customer: 'Cisco',
    business: 'Industrial',
    created_at: new Date().toISOString()
  },
  {
    id: 'po-4',
    project_id: 'K-2026-O04',
    project_title: 'Carton Box Sealing Line Balancer',
    workshop: 'Line 2 Packaging Kaizen',
    project_type: 'Kaizen',
    leader: 'Rocio Nunez',
    facilitator: 'Carlos Ortiz',
    status: 'Execution',
    created_date: '2026-07-01',
    completion_date: '2026-09-10',
    op_contribution: 25000,
    soft_savings: 4000,
    inventory_savings: 3000,
    fte_savings: 1.0,
    one_time_savings: 0,
    potential_savings: 32000,
    functional_area: 'Packaging',
    project_category: 'Productivity',
    customer: 'HP',
    business: 'Consumer',
    created_at: new Date().toISOString()
  },
  {
    id: 'po-5',
    project_id: 'K-2026-O05',
    project_title: 'Component Tape Reel Storage Redesign',
    workshop: 'Supermarket Kaizen',
    project_type: 'Kaizen',
    leader: 'Cesar Guzman',
    facilitator: 'David Gomez',
    status: 'Planning',
    created_date: '2026-07-10',
    completion_date: '2026-10-15',
    op_contribution: 30000,
    soft_savings: 6000,
    inventory_savings: 55000,
    fte_savings: 0.6,
    one_time_savings: 0,
    potential_savings: 91000,
    functional_area: 'Almacen',
    project_category: 'Inventory',
    customer: 'GM',
    business: 'Automotive',
    created_at: new Date().toISOString()
  },
  {
    id: 'po-6',
    project_id: 'SGA-2026-O06',
    project_title: 'Test Fixture Pins Replacement Program',
    workshop: 'Fixture Quality SGA',
    project_type: 'SGA',
    leader: 'Beatriz Solis',
    facilitator: 'Juan Martinez',
    status: 'Planning',
    created_date: '2026-07-15',
    completion_date: '2026-11-01',
    op_contribution: 45000,
    soft_savings: 20000,
    inventory_savings: 10000,
    fte_savings: 0.0,
    one_time_savings: 0,
    potential_savings: 75000,
    functional_area: 'Testing',
    project_category: 'Quality',
    customer: 'Cisco',
    business: 'Industrial',
    created_at: new Date().toISOString()
  },
];

// Helper to load table from localStorage or initialize with seed data
export const loadTable = <T>(tableName: string, initialData: T[]): T[] => {
  const stored = localStorage.getItem(getStorageKey(tableName));
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error(`Error parsing table ${tableName}, resetting to seed`, e);
    }
  }
  localStorage.setItem(getStorageKey(tableName), JSON.stringify(initialData));
  return initialData;
};

// Helper to save table to localStorage
export const saveTable = <T>(tableName: string, data: T[]) => {
  localStorage.setItem(getStorageKey(tableName), JSON.stringify(data));
};

// Initialize Mock Database
export const initMockDb = () => {
  loadTable('projects_approved', seedApproved);
  loadTable('projects_open', seedOpen);
  loadTable('savings_targets', seedTargets);
};

// Clear LocalStorage and re-seed
export const resetMockDb = () => {
  localStorage.removeItem(getStorageKey('projects_approved'));
  localStorage.removeItem(getStorageKey('projects_open'));
  localStorage.removeItem(getStorageKey('savings_targets'));
  initMockDb();
  window.dispatchEvent(new Event('lean-impact-db-changed'));
};

// Run mock database init
if (isMock) {
  initMockDb();
}

// ----------------------------------------------------
// DATABASE API INTERFACE
// ----------------------------------------------------

export const dbService = {
  // --- SAVINGS TARGETS ---
  async getSavingsTargets(): Promise<SavingsTarget[]> {
    if (isMock) {
      return loadTable('savings_targets', seedTargets);
    }
    const { data, error } = await supabase!
      .from('savings_targets')
      .select('*')
      .order('fiscal_year', { ascending: true })
      .order('quarter', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },

  async saveSavingsTarget(target: { fiscal_year: number; quarter: string; target_amount: number }): Promise<SavingsTarget> {
    if (isMock) {
      const targets = loadTable('savings_targets', seedTargets);
      const existingIdx = targets.findIndex(t => t.fiscal_year === target.fiscal_year && t.quarter === target.quarter);
      
      let updated: SavingsTarget;
      if (existingIdx !== -1) {
        targets[existingIdx] = {
          ...targets[existingIdx],
          target_amount: target.target_amount,
        };
        updated = targets[existingIdx];
      } else {
        updated = {
          id: `t-${target.fiscal_year}-${target.quarter.toLowerCase()}`,
          fiscal_year: target.fiscal_year,
          quarter: target.quarter,
          target_amount: target.target_amount,
          created_at: new Date().toISOString()
        };
        targets.push(updated);
      }
      saveTable('savings_targets', targets);
      window.dispatchEvent(new Event('lean-impact-db-changed'));
      return updated;
    }

    const { data, error } = await supabase!
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
    if (isMock) {
      return loadTable('projects_approved', seedApproved);
    }
    const { data, error } = await supabase!
      .from('projects_approved')
      .select('*')
      .order('approval_date', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async importApprovedProjects(projects: Omit<ProjectApproved, 'id' | 'created_at'>[]): Promise<{ inserted: number; updated: number }> {
    if (isMock) {
      const current = loadTable('projects_approved', seedApproved);
      let inserted = 0;
      let updated = 0;

      projects.forEach(p => {
        const existingIdx = current.findIndex(c => c.project_id === p.project_id);
        const totalSavings = p.op_contribution + p.soft_savings + p.inventory_savings + p.one_time_savings;
        
        if (existingIdx !== -1) {
          current[existingIdx] = {
            ...current[existingIdx],
            ...p,
            total_savings: totalSavings
          };
          updated++;
        } else {
          current.push({
            ...p,
            id: `pa-${Math.random().toString(36).substr(2, 9)}`,
            total_savings: totalSavings,
            created_at: new Date().toISOString()
          });
          inserted++;
        }
      });

      saveTable('projects_approved', current);
      window.dispatchEvent(new Event('lean-impact-db-changed'));
      return { inserted, updated };
    }

    const dbProjects = projects.map(p => ({
      ...p,
      total_savings: p.op_contribution + p.soft_savings + p.inventory_savings + p.one_time_savings
    }));

    const { error } = await supabase!
      .from('projects_approved')
      .upsert(dbProjects, { onConflict: 'project_id' });

    if (error) throw error;
    return { inserted: dbProjects.length, updated: 0 };
  },

  // --- PROJECTS OPEN ---
  async getProjectsOpen(): Promise<ProjectOpen[]> {
    if (isMock) {
      return loadTable('projects_open', seedOpen);
    }
    const { data, error } = await supabase!
      .from('projects_open')
      .select('*')
      .order('created_date', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async importOpenProjects(projects: Omit<ProjectOpen, 'id' | 'created_at'>[]): Promise<{ inserted: number; updated: number }> {
    if (isMock) {
      const current = loadTable('projects_open', seedOpen);
      let inserted = 0;
      let updated = 0;

      projects.forEach(p => {
        const existingIdx = current.findIndex(c => c.project_id === p.project_id);
        const potentialSavings = p.op_contribution + p.soft_savings + p.inventory_savings + p.one_time_savings;
        
        if (existingIdx !== -1) {
          current[existingIdx] = {
            ...current[existingIdx],
            ...p,
            potential_savings: potentialSavings
          };
          updated++;
        } else {
          current.push({
            ...p,
            id: `po-${Math.random().toString(36).substr(2, 9)}`,
            potential_savings: potentialSavings,
            created_at: new Date().toISOString()
          });
          inserted++;
        }
      });

      saveTable('projects_open', current);
      window.dispatchEvent(new Event('lean-impact-db-changed'));
      return { inserted, updated };
    }

    const dbProjects = projects.map(p => ({
      ...p,
      potential_savings: p.op_contribution + p.soft_savings + p.inventory_savings + p.one_time_savings
    }));

    const { error } = await supabase!
      .from('projects_open')
      .upsert(dbProjects, { onConflict: 'project_id' });

    if (error) throw error;
    return { inserted: dbProjects.length, updated: 0 };
  },
};
