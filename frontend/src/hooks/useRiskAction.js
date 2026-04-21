import { useState, useCallback } from 'react';
import { RISK_DEFINITIONS } from '../utils/riskDefinitions';

export function useRiskAction() {
  const [pending, setPending] = useState(null);

  const confirm = useCallback((action, context = {}) => {
    return new Promise((resolve) => {
      setPending({ action, context, resolve });
    });
  }, []);

  const handleConfirm = useCallback(async (reason) => {
    if (pending) {
      pending.resolve({ confirmed: true, reason });
      setPending(null);
    }
  }, [pending]);

  const handleCancel = useCallback(() => {
    if (pending) {
      pending.resolve({ confirmed: false });
      setPending(null);
    }
  }, [pending]);

  const RiskModal = pending ? (
    <DynamicRiskModal
      action={pending.action}
      context={pending.context}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return { confirm, RiskModal };
}

function DynamicRiskModal({ action, context, onConfirm, onCancel }) {
  const RiskConfirmModal = require('../components/RiskConfirmModal').default;
  const def = RISK_DEFINITIONS[action] || {};

  return (
    <RiskConfirmModal
      action={action}
      actionLabel={def.label || action}
      riskLevel={def.level || 'medium'}
      confirmWord={def.confirmWord}
      requireReason={def.requireReason || false}
      context={context}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
