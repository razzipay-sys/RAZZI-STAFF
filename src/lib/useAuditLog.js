import { useAuth } from './AuthContext';
import useRoleAccess from './useRoleAccess';
import { entities } from './supabaseEntities';

export default function useAuditLog() {
  const { user } = useAuth();
  const { role } = useRoleAccess();

  const logAction = async ({ actionType, entityType, entityId, entityName, notes, changes }) => {
    try {
      await entities.AuditLog.create({
        action_type: actionType,
        entity_type: entityType,
        entity_id: entityId?.toString(),
        entity_name: entityName,
        performed_by: user?.email || 'System',
        performed_by_role: role || 'guest',
        notes: notes,
        changes: changes ? JSON.stringify(changes) : null,
      });
    } catch (e) {
      console.error('Failed to log audit action:', e);
    }
  };

  return { logAction };
}
