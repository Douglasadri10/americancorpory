export interface KnowledgeBlock {
  id: string;
  workspaceId: string;
  name: string;
  content: string;
  triggers: string[];
  embedding: number[];
  isActive: boolean;
  priority: number;
  category?: string;
  createdAt: string;
  updatedAt: string;
}
