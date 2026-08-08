"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var server_ts_1 = require("https://deno.land/std@0.168.0/http/server.ts");
var corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
var SYSTEM_PROMPT = "You are the \"ACE Compliant Management Assistant\", a helpful AI specifically designed for the ACE unit's complaint management system. CRITICAL: ALWAYS identify as the ACE assistant. NEVER use the names Campus Resolve, CampusResolve, or Compus. This is strictly the ACE Compliant Management system. Your purpose is to help users navigate the hierarchical resolution workflow (Tutor, HOD, Principal) at ACE.";
(0, server_ts_1.serve)(function (req) { return __awaiter(void 0, void 0, void 0, function () {
    var messages, LOVABLE_API_KEY, response, errorText, data, message, error_1;
    var _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                if (req.method === "OPTIONS") {
                    return [2 /*return*/, new Response(null, { headers: corsHeaders })];
                }
                _d.label = 1;
            case 1:
                _d.trys.push([1, 7, , 8]);
                return [4 /*yield*/, req.json()];
            case 2:
                messages = (_d.sent()).messages;
                LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
                if (!LOVABLE_API_KEY) {
                    console.error("LOVABLE_API_KEY is not configured");
                    throw new Error("AI service not configured");
                }
                console.log("Sending request to Lovable AI with", messages.length, "messages");
                return [4 /*yield*/, fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                        method: "POST",
                        headers: {
                            Authorization: "Bearer ".concat(LOVABLE_API_KEY),
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            model: "google/gemini-2.5-flash",
                            messages: __spreadArray([
                                { role: "system", content: SYSTEM_PROMPT }
                            ], messages.slice(-10), true),
                            max_tokens: 500,
                        }),
                    })];
            case 3:
                response = _d.sent();
                if (!!response.ok) return [3 /*break*/, 5];
                return [4 /*yield*/, response.text()];
            case 4:
                errorText = _d.sent();
                console.error("AI API error:", response.status, errorText);
                if (response.status === 429) {
                    return [2 /*return*/, new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), { status: 429, headers: __assign(__assign({}, corsHeaders), { "Content-Type": "application/json" }) })];
                }
                if (response.status === 402) {
                    return [2 /*return*/, new Response(JSON.stringify({ error: "AI service temporarily unavailable." }), { status: 402, headers: __assign(__assign({}, corsHeaders), { "Content-Type": "application/json" }) })];
                }
                throw new Error("AI request failed");
            case 5: return [4 /*yield*/, response.json()];
            case 6:
                data = _d.sent();
                message = ((_c = (_b = (_a = data.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) || "I'm sorry, I couldn't generate a response.";
                console.log("AI response received successfully");
                return [2 /*return*/, new Response(JSON.stringify({ message: message }), { headers: __assign(__assign({}, corsHeaders), { "Content-Type": "application/json" }) })];
            case 7:
                error_1 = _d.sent();
                console.error("Chatbot error:", error_1);
                return [2 /*return*/, new Response(JSON.stringify({
                        message: "I'm having trouble right now. Please try again or visit the complaint form directly.",
                        error: error_1 instanceof Error ? error_1.message : "Unknown error"
                    }), { status: 500, headers: __assign(__assign({}, corsHeaders), { "Content-Type": "application/json" }) })];
            case 8: return [2 /*return*/];
        }
    });
}); });
