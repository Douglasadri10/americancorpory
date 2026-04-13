import { z } from 'zod';
import { NextResponse } from 'next/server';

/** Parse + validate a request body, returning a typed error response on failure */
export async function parseBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      data: null,
      error: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const messages = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    return {
      data: null,
      error: NextResponse.json({ error: `Validation error: ${messages}` }, { status: 422 }),
    };
  }

  return { data: result.data, error: null };
}

// ─── Shared schemas ────────────────────────────────────────────────────────

export const workspaceIdSchema = z.string().min(1).max(128);

export const appointmentSchema = z.object({
  workspaceId: workspaceIdSchema,
  title: z.string().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  description: z.string().max(1000).optional(),
  notes: z.string().max(1000).optional(),
  status: z.enum(['available', 'booked', 'blocked', 'cancelled']).optional(),
  contactName: z.string().max(200).optional(),
  leadId: z.string().max(128).optional(),
  leadName: z.string().max(200).optional(),
  conversationId: z.string().max(128).optional(),
  channel: z.string().max(64).optional(),
  bookedByAI: z.boolean().optional(),
});

export const leadCreateSchema = z.object({
  workspaceId: workspaceIdSchema,
  name: z.string().min(1).max(200),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  company: z.string().max(200).optional(),
  source: z.enum(['instagram', 'facebook', 'whatsapp', 'manual', 'import', 'api']).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  dealValue: z.number().min(0).max(1e9).optional(),
  notes: z.string().max(2000).optional(),
});

export const knowledgeBlockSchema = z.object({
  workspaceId: workspaceIdSchema,
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(10000),
  type: z.enum(['faq', 'policy', 'product', 'general']).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  isActive: z.boolean().optional(),
});

export const messageSchema = z.object({
  conversationId: z.string().min(1).max(128),
  text: z.string().min(1).max(4096),
  workspaceId: workspaceIdSchema,
});

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  cursor: z.string().max(256).optional(),
});
