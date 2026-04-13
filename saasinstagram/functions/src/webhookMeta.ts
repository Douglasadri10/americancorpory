import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

const db = admin.firestore();

/**
 * Meta Webhook Handler (Cloud Function alternative to Next.js API route)
 * Use this if you prefer Firebase Functions over Next.js API routes for webhooks.
 */
export const webhookMeta = functions
  .region('us-central1')
  .https.onRequest(async (req, res) => {
    // GET: Webhook verification
    if (req.method === 'GET') {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      const verifyToken = functions.config().meta?.webhook_verify_token ?? process.env.META_WEBHOOK_VERIFY_TOKEN;

      if (mode === 'subscribe' && token === verifyToken) {
        res.status(200).send(challenge);
        return;
      }

      res.status(403).send('Verification failed');
      return;
    }

    // POST: Process webhook events
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }

    try {
      const appSecret = functions.config().meta?.app_secret ?? process.env.META_APP_SECRET ?? '';
      const signature = req.headers['x-hub-signature-256'] as string;
      const rawBody = JSON.stringify(req.body);

      // Verify signature
      if (appSecret && signature) {
        const expectedSig = crypto
          .createHmac('sha256', appSecret)
          .update(rawBody)
          .digest('hex');

        if (!crypto.timingSafeEqual(
          Buffer.from(`sha256=${expectedSig}`, 'utf8'),
          Buffer.from(signature, 'utf8')
        )) {
          functions.logger.warn('Invalid webhook signature');
          res.status(401).send('Invalid signature');
          return;
        }
      }

      const body = req.body;

      if (!body.object || !Array.isArray(body.entry)) {
        res.status(400).send('Invalid payload');
        return;
      }

      // Queue each entry for processing
      await Promise.all(
        body.entry.map(async (entry: Record<string, unknown>) => {
          await db.collection('webhookQueue').add({
            object: body.object,
            entry,
            processedAt: null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'pending',
          });
        })
      );

      res.status(200).json({ received: true });
    } catch (error) {
      functions.logger.error('Webhook error:', error);
      res.status(500).send('Internal error');
    }
  });
