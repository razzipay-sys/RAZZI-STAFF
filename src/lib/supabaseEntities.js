/**
 * supabaseEntities.js
 *
 * Drop-in replacement for the base44 entities SDK.
 * Usage: entities.StaffProfile.list(), .get(id), .create(data), .update(id, data), .delete(id), .filter(filters)
 */

import supabase from './supabase';

const TABLE_MAP = {
  StaffProfile: 'staff_profiles',
  StaffBankDetails: 'staff_bank_details',
  StaffDocument: 'staff_documents',
  DailyWorkflowReport: 'daily_workflow_reports',
  AuditLog: 'audit_logs',
  UserRole: 'user_roles',
  AppSetting: 'app_settings',
};

function buildEntity(tableName) {
  return {
    /** List all records. orderBy: e.g. '-created_at' (- prefix = descending). limit: max rows */
    async list(orderBy = '-created_at', limit = 500) {
      const column = orderBy.startsWith('-') ? orderBy.slice(1) : orderBy;
      const ascending = !orderBy.startsWith('-');
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .order(column, { ascending })
        .limit(limit);
      if (error) throw error;
      return data;
    },

    /** Get single record by id */
    async get(id) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },

    /** Filter records by field equality map */
    async filter(filters = {}, orderBy = '-created_at', limit = 500) {
      const column = orderBy.startsWith('-') ? orderBy.slice(1) : orderBy;
      const ascending = !orderBy.startsWith('-');
      let query = supabase
        .from(tableName)
        .select('*')
        .order(column, { ascending })
        .limit(limit);
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== null) query = query.eq(key, val);
      });
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },

    /** Create a new record */
    async create(record) {
      const { data, error } = await supabase
        .from(tableName)
        .insert([record])
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    /** Update an existing record by id */
    async update(id, updates) {
      const { data, error } = await supabase
        .from(tableName)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    /** Delete a record by id */
    async delete(id) {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) throw error;
      return { success: true };
    },
  };
}

export const entities = Object.fromEntries(
  Object.entries(TABLE_MAP).map(([key, table]) => [key, buildEntity(table)])
);

export default entities;
