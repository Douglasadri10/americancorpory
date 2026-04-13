"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookMeta = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
const db = admin.firestore();
/**
 * Meta Webhook Handler (Cloud Function alternative to Next.js API route)
 * Use this if you prefer Firebase Functions over Next.js API routes for webhooks.
 */
exports.webhookMeta = functions
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
        const signature = req.headers['x-hub-signature-256'];
        const rawBody = JSON.stringify(req.body);
        // Verify signature
        if (appSecret && signature) {
            const expectedSig = crypto
                .createHmac('sha256', appSecret)
                .update(rawBody)
                .digest('hex');
            if (!crypto.timingSafeEqual(Buffer.from(`sha256=${expectedSig}`, 'utf8'), Buffer.from(signature, 'utf8'))) {
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
        await Promise.all(body.entry.map(async (entry) => {
            await db.collection('webhookQueue').add({
                object: body.object,
                entry,
                processedAt: null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                status: 'pending',
            });
        }));
        res.status(200).json({ received: true });
    }
    catch (error) {
        functions.logger.error('Webhook error:', error);
        res.status(500).send('Internal error');
    }
});
//# sourceMappingURL=webhookMeta.js.map