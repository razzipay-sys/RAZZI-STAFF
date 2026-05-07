import { useAuth } from './AuthContext';
import { entities } from './supabaseEntities';

export const useAuditLog = () => {
  const { user } = useAuth();

  const logAction = async ({ actionType, entityType, entityId, entityName, changes, notes }) => {
    try {
      await entities.AuditLog.create({
        action_type: actionType,
        entity_type: entityType,
        entity_id: entityId,
        entity_name: entityName,
        performed_by: user?.email || 'System',
        performed_by_role: user?.user_metadata?.role || 'user',
        changes: changes ? JSON.stringify(changes) : null,
        notes,
        ip_address: null,
        user_agent: navigator.userAgent,
      });
    } catch (error) {
      console.error('Failed to create audit log:', error);
    }
  };

  return { logAction };
};

export default useAuditLog;
