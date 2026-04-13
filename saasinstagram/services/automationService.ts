import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  type Firestore,
} from 'firebase/firestore';
import type { Automation, AutomationLog } from '@/types/automation';

const AUTOMATIONS_COLLECTION = 'automations';
const AUTOMATION_LOGS_COLLECTION = 'automationLogs';

export class AutomationService {
  constructor(private db: Firestore) {}

  async getAutomation(automationId: string): Promise<Automation | null> {
    const ref = doc(this.db, AUTOMATIONS_COLLECTION, automationId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Automation;
  }

  async getAutomations(workspaceId: string): Promise<Automation[]> {
    const q = query(
      collection(this.db, AUTOMATIONS_COLLECTION),
      where('workspaceId', '==', workspaceId),
      orderBy('createdAt', 'desc')
    );

    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Automation[];
  }

  async getActiveAutomations(workspaceId: string): Promise<Automation[]> {
    const q = query(
      collection(this.db, AUTOMATIONS_COLLECTION),
      where('workspaceId', '==', workspaceId),
      where('isActive', '==', true)
    );

    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Automation[];
  }

  async createAutomation(automation: Omit<Automation, 'id'>): Promise<Automation> {
    const id = doc(collection(this.db, AUTOMATIONS_COLLECTION)).id;
    const data: Automation = { ...automation, id };
    await setDoc(doc(this.db, AUTOMATIONS_COLLECTION, id), data);
    return data;
  }

  async updateAutomation(
    automationId: string,
    updates: Partial<Automation>
  ): Promise<void> {
    await updateDoc(doc(this.db, AUTOMATIONS_COLLECTION, automationId), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  }

  async toggleAutomation(automationId: string, isActive: boolean): Promise<void> {
    await updateDoc(doc(this.db, AUTOMATIONS_COLLECTION, automationId), {
      isActive,
      updatedAt: new Date().toISOString(),
    });
  }

  async deleteAutomation(automationId: string): Promise<void> {
    await deleteDoc(doc(this.db, AUTOMATIONS_COLLECTION, automationId));
  }

  async incrementStats(
    automationId: string,
    actionsExecuted: number
  ): Promise<void> {
    const automation = await this.getAutomation(automationId);
    if (!automation) return;

    await updateDoc(doc(this.db, AUTOMATIONS_COLLECTION, automationId), {
      'stats.totalTriggered': (automation.stats.totalTriggered ?? 0) + 1,
      'stats.totalActionsExecuted': (automation.stats.totalActionsExecuted ?? 0) + actionsExecuted,
      'stats.lastTriggeredAt': new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  async createLog(log: Omit<AutomationLog, 'id'>): Promise<AutomationLog> {
    const id = doc(collection(this.db, AUTOMATION_LOGS_COLLECTION)).id;
    const data: AutomationLog = { ...log, id };
    await setDoc(doc(this.db, AUTOMATION_LOGS_COLLECTION, id), data);
    return data;
  }

  async getLogs(
    workspaceId: string,
    automationId?: string
  ): Promise<AutomationLog[]> {
    let q = query(
      collection(this.db, AUTOMATION_LOGS_COLLECTION),
      where('workspaceId', '==', workspaceId),
      orderBy('triggeredAt', 'desc')
    );

    if (automationId) {
      q = query(q, where('automationId', '==', automationId));
    }

    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as AutomationLog[];
  }

  /**
   * Evaluate if a conversation/message matches an automation's trigger conditions.
   */
  evaluateConditions(
    automation: Automation,
    context: Record<string, unknown>
  ): boolean {
    const { conditions } = automation.trigger;
    if (!conditions || conditions.length === 0) return true;

    let result = true;
    let logicalOp: 'AND' | 'OR' = 'AND';

    for (let i = 0; i < conditions.length; i++) {
      const condition = conditions[i];
      const fieldValue = this.getFieldValue(context, condition.field);
      const matches = this.evaluateCondition(fieldValue, condition.operator, condition.value);

      if (i === 0) {
        result = matches;
      } else {
        if (logicalOp === 'AND') {
          result = result && matches;
        } else {
          result = result || matches;
        }
      }

      logicalOp = condition.logicalOperator ?? 'AND';
    }

    return result;
  }

  private getFieldValue(context: Record<string, unknown>, field: string): unknown {
    return field.split('.').reduce((obj: unknown, key: string) => {
      if (obj && typeof obj === 'object') {
        return (obj as Record<string, unknown>)[key];
      }
      return undefined;
    }, context);
  }

  private evaluateCondition(
    value: unknown,
    operator: string,
    conditionValue: unknown
  ): boolean {
    const strValue = String(value ?? '').toLowerCase();
    const strCondition = String(conditionValue ?? '').toLowerCase();

    switch (operator) {
      case 'equals':
        return strValue === strCondition;
      case 'not_equals':
        return strValue !== strCondition;
      case 'contains':
        return strValue.includes(strCondition);
      case 'not_contains':
        return !strValue.includes(strCondition);
      case 'starts_with':
        return strValue.startsWith(strCondition);
      case 'ends_with':
        return strValue.endsWith(strCondition);
      case 'matches_regex':
        try {
          return new RegExp(strCondition, 'i').test(strValue);
        } catch {
          return false;
        }
      case 'greater_than':
        return Number(value) > Number(conditionValue);
      case 'less_than':
        return Number(value) < Number(conditionValue);
      case 'is_empty':
        return !value || strValue === '';
      case 'is_not_empty':
        return !!value && strValue !== '';
      default:
        return false;
    }
  }
}
