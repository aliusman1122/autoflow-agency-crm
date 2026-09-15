import { create } from 'zustand';
import { type Lead, PIPELINE_STAGES } from './types';
import { supabase } from './supabase';
import { toast } from 'sonner';

interface LeadsState {
    leads: Lead[];
    loading: boolean;
    hasFetched: boolean;

    // Actions
    fetchLeads: (force?: boolean) => Promise<void>;
    updateLeadLocally: (id: string, updates: Partial<Lead>) => void;
    removeLeadLocally: (id: string) => void;
    addLeadLocally: (lead: Lead) => void;

    // Unified Actions that hit DB and update state
    archiveLead: (lead: Lead) => Promise<void>;
    restoreLead: (lead: Lead) => Promise<void>;
    deleteLead: (lead: Lead) => Promise<void>;
    moveLeadStage: (lead: Lead, newStage: string) => Promise<void>;
}

export const useLeadsStore = create<LeadsState>((set, get) => ({
    leads: [],
    loading: false,
    hasFetched: false,

    fetchLeads: async (force = false) => {
        if (get().hasFetched && !force) return;
        set({ loading: true });
        const { data, error } = await supabase
            .from("leads")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching leads:", error);
            toast.error("Failed to fetch leads");
            set({ loading: false });
            return;
        }

        set({ leads: (data as Lead[]) ?? [], loading: false, hasFetched: true });
    },

    updateLeadLocally: (id, updates) =>
        set((state) => ({
            leads: state.leads.map((l) => l.id === id ? { ...l, ...updates } : l)
        })),

    removeLeadLocally: (id) =>
        set((state) => ({
            leads: state.leads.filter((l) => l.id !== id)
        })),

    addLeadLocally: (lead) =>
        set((state) => ({
            leads: [lead, ...state.leads]
        })),

    archiveLead: async (lead) => {
        // Optimistic update
        get().updateLeadLocally(lead.id, { is_archived: true });

        const { error } = await supabase
            .from("leads")
            .update({ is_archived: true })
            .eq("id", lead.id);

        if (error) {
            get().updateLeadLocally(lead.id, { is_archived: lead.is_archived });
            toast.error("Failed to archive lead");
            throw error;
        }
        toast.success(`${lead.company_name || 'Lead'} archived`);
    },

    restoreLead: async (lead) => {
        // Fallback pipeline stage just in case
        let fallbackStage = lead.pipeline_stage;
        if (!fallbackStage || !PIPELINE_STAGES.includes(fallbackStage as any)) {
            fallbackStage = "New Lead";
        }

        // Optimistic update
        get().updateLeadLocally(lead.id, {
            is_archived: false,
            pipeline_stage: fallbackStage as Lead['pipeline_stage']
        });

        const { error } = await supabase
            .from("leads")
            .update({
                is_archived: false,
                pipeline_stage: fallbackStage
            })
            .eq("id", lead.id);

        if (error) {
            get().updateLeadLocally(lead.id, { is_archived: lead.is_archived, pipeline_stage: lead.pipeline_stage });
            toast.error("Failed to restore lead");
            throw error;
        }
        toast.success(`${lead.company_name || 'Lead'} restored`);
    },

    deleteLead: async (lead) => {
        get().removeLeadLocally(lead.id);
        const { error } = await supabase
            .from("leads")
            .delete()
            .eq("id", lead.id);

        if (error) {
            get().addLeadLocally(lead);
            toast.error("Failed to delete lead");
            throw error;
        }
        toast.success("Lead permanently deleted");
    },

    moveLeadStage: async (lead, newStage) => {
        const oldStage = lead.pipeline_stage;
        get().updateLeadLocally(lead.id, { pipeline_stage: newStage as Lead['pipeline_stage'] });

        const { error } = await supabase
            .from("leads")
            .update({ pipeline_stage: newStage })
            .eq("id", lead.id);

        if (error) {
            get().updateLeadLocally(lead.id, { pipeline_stage: oldStage });
            toast.error("Failed to update pipeline stage");
            throw error;
        }
        toast.success(`Moved to ${newStage}`);
    }
}));
