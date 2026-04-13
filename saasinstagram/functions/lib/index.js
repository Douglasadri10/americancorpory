"use strict";
/**
 * OmniChat Firebase Cloud Functions
 * Entry point - exports all functions
 */
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
exports.stripeWebhook = exports.generateAIResponse = exports.runAutomation = exports.updateMessageStatus = exports.processIncomingMessage = exports.webhookMeta = void 0;
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp();
}
// Export all functions
var webhookMeta_1 = require("./webhookMeta");
Object.defineProperty(exports, "webhookMeta", { enumerable: true, get: function () { return webhookMeta_1.webhookMeta; } });
var messageProcessor_1 = require("./messageProcessor");
Object.defineProperty(exports, "processIncomingMessage", { enumerable: true, get: function () { return messageProcessor_1.processIncomingMessage; } });
Object.defineProperty(exports, "updateMessageStatus", { enumerable: true, get: function () { return messageProcessor_1.updateMessageStatus; } });
var automationEngine_1 = require("./automationEngine");
Object.defineProperty(exports, "runAutomation", { enumerable: true, get: function () { return automationEngine_1.runAutomation; } });
var aiResponder_1 = require("./aiResponder");
Object.defineProperty(exports, "generateAIResponse", { enumerable: true, get: function () { return aiResponder_1.generateAIResponse; } });
var stripeWebhook_1 = require("./stripeWebhook");
Object.defineProperty(exports, "stripeWebhook", { enumerable: true, get: function () { return stripeWebhook_1.stripeWebhook; } });
//# sourceMappingURL=index.js.map