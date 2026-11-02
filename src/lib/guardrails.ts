// Emulates an Amazon Bedrock Guardrail ("helix-safety-guardrail") with the four policy families
// the audience will configure in the console: denied topics, content filters, prompt attacks and PII.

export type GuardrailAssessment = {
  policy: "topicPolicy" | "contentPolicy" | "promptAttack" | "sensitiveInformationPolicy";
  name: string;
  type: string;
  action: "BLOCKED" | "ANONYMIZED";
  match?: string;
};

export type GuardrailResult = {
  action: "NONE" | "GUARDRAIL_INTERVENED";
  outputText?: string;
  assessments: GuardrailAssessment[];
};

export const GUARDRAIL_CONFIG = {
  name: "helix-safety-guardrail",
  blockedInputMessaging:
    "Sorry, this request violates Helix Wind Energy safety policy. Safety interlocks must never be bypassed. Contact your HSE supervisor.",
  blockedOutputsMessaging: "Sorry, the model cannot answer this question.",
  topicPolicyConfig: {
    topicsConfig: [
      {
        name: "SafetyBypass",
        definition: "Requests for instructions to bypass, defeat, disable or override safety interlocks, rotor locks, brakes or LOTO.",
        examples: ["How do I bypass the rotor lock interlock?", "Can I disable the brake sensor to restart faster?"],
        type: "DENY",
      },
      {
        name: "InvestmentAdvice",
        definition: "Requests for stock, trading or investment recommendations.",
        examples: ["Should I buy Helix Wind shares?"],
        type: "DENY",
      },
    ],
  },
  contentPolicyConfig: {
    filtersConfig: [
      { type: "HATE", inputStrength: "HIGH", outputStrength: "HIGH" },
      { type: "INSULTS", inputStrength: "HIGH", outputStrength: "HIGH" },
      { type: "VIOLENCE", inputStrength: "MEDIUM", outputStrength: "MEDIUM" },
      { type: "PROMPT_ATTACK", inputStrength: "HIGH", outputStrength: "NONE" },
    ],
  },
  sensitiveInformationPolicyConfig: {
    piiEntitiesConfig: [
      { type: "EMAIL", action: "ANONYMIZE" },
      { type: "PHONE", action: "ANONYMIZE" },
      { type: "US_SOCIAL_SECURITY_NUMBER", action: "BLOCK" },
    ],
  },
};

const RULES: { re: RegExp; a: Omit<GuardrailAssessment, "match"> }[] = [
  {
    re: /\b(bypass|defeat|disable|override|jump(er)?|short[- ]?circuit|skip)\b.{0,40}\b(interlock|rotor lock|lock ?pin|brake|loto|lockout|safety|e-?stop|emergency stop)/i,
    a: { policy: "topicPolicy", name: "SafetyBypass", type: "DENY", action: "BLOCKED" },
  },
  {
    re: /\b(interlock|rotor lock|brake|loto|lockout|safety)\b.{0,40}\b(bypass|defeat|disable|override)/i,
    a: { policy: "topicPolicy", name: "SafetyBypass", type: "DENY", action: "BLOCKED" },
  },
  {
    re: /\b(buy|sell|invest|short)\b.{0,30}\b(stock|shares?|equity|crypto)\b/i,
    a: { policy: "topicPolicy", name: "InvestmentAdvice", type: "DENY", action: "BLOCKED" },
  },
  {
    re: /\b(ignore|disregard|forget)\b.{0,30}\b(previous|prior|above|all)\b.{0,20}\b(instructions?|rules|prompt)/i,
    a: { policy: "promptAttack", name: "PROMPT_ATTACK", type: "PROMPT_ATTACK", action: "BLOCKED" },
  },
  {
    re: /\b(idiot|stupid|moron|useless)\b/i,
    a: { policy: "contentPolicy", name: "INSULTS", type: "INSULTS", action: "BLOCKED" },
  },
  {
    re: /\b\d{3}-\d{2}-\d{4}\b/,
    a: { policy: "sensitiveInformationPolicy", name: "US_SOCIAL_SECURITY_NUMBER", type: "PII", action: "BLOCKED" },
  },
];

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g;
const PHONE = /(\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g;

export function applyGuardrail(text: string, source: "INPUT" | "OUTPUT"): GuardrailResult {
  const assessments: GuardrailAssessment[] = [];
  for (const { re, a } of RULES) {
    if (source === "OUTPUT" && a.policy === "promptAttack") continue;
    const m = text.match(re);
    if (m) assessments.push({ ...a, match: m[0] });
  }
  if (assessments.length) {
    return {
      action: "GUARDRAIL_INTERVENED",
      outputText: source === "INPUT" ? GUARDRAIL_CONFIG.blockedInputMessaging : GUARDRAIL_CONFIG.blockedOutputsMessaging,
      assessments,
    };
  }
  let masked = text;
  for (const [re, type] of [
    [EMAIL, "EMAIL"],
    [PHONE, "PHONE"],
  ] as const) {
    masked = masked.replace(re, (m) => {
      assessments.push({ policy: "sensitiveInformationPolicy", name: type, type: "PII", action: "ANONYMIZED", match: m });
      return `{${type}}`;
    });
  }
  return assessments.length ? { action: "GUARDRAIL_INTERVENED", outputText: masked, assessments } : { action: "NONE", assessments };
}
