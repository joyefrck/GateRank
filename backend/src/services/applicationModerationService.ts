import { HttpError } from '../middleware/errorHandler';
import { APPLICATION_MODERATION_PROMPT } from './applicationModerationPrompt';
import { APPLICATION_NAME_MAX_LENGTH, APPLICATION_INTRO_MAX_LENGTH } from '../../../shared/applicationContent';

export interface ApplicationModerationInput {
  name: string;
  airport_intro: string;
}
export interface ApplicationModerationVerifier {
  verify(input: ApplicationModerationInput): Promise<void>;
}

type Field = 'text_1' | 'text_2';
type Category = 'harassment' | 'threat' | 'hate' | 'targeted_profanity';
interface ModerationIssue { field: Field; category: Category; reason: string }
interface ModerationResult { decision: 'allow' | 'reject' | 'review'; issues: ModerationIssue[] }
const FIELD_LABELS: Record<Field, string> = { text_1: '机场名称', text_2: '机场基本介绍' };
const CATEGORIES: Category[] = ['harassment', 'threat', 'hate', 'targeted_profanity'];
const unavailable = () => new HttpError(503, 'APPLICATION_MODERATION_UNAVAILABLE', '内容审核暂时不可用，请稍后重试，已填资料无需清空');

export function createApplicationModerationService(
  env: NodeJS.ProcessEnv = process.env,
  fetcher: typeof fetch = fetch,
): ApplicationModerationVerifier {
  const apiKey = env.DEEPSEEK_API_KEY?.trim() || '';
  const enabled = env.APPLICATION_MODERATION_ENABLED !== '0'
    && (env.APPLICATION_MODERATION_ENABLED === '1' || env.NODE_ENV === 'production' || Boolean(apiKey));
  const model = env.DEEPSEEK_MODERATION_MODEL?.trim() || 'deepseek-flash';
  const timeoutMs = boundedInteger(env.APPLICATION_MODERATION_TIMEOUT_MS, 15000, 100, 30000);
  const maxConcurrent = boundedInteger(env.APPLICATION_MODERATION_MAX_CONCURRENT, 4, 1, 16);
  let activeCalls = 0;

  return {
    async verify(input) {
      // Always bound text, even when the model is disabled for local development.
      const fields = {
        text_1: reviewText(input.name, APPLICATION_NAME_MAX_LENGTH, FIELD_LABELS.text_1),
        text_2: reviewText(input.airport_intro, APPLICATION_INTRO_MAX_LENGTH, FIELD_LABELS.text_2),
      };
      if (!enabled) return;
      if (!apiKey || activeCalls >= maxConcurrent) throw unavailable();

      let result: ModerationResult;
      activeCalls++;
      try {
        const response = await fetcher('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          redirect: 'error',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            thinking: { type: 'disabled' },
            temperature: 0,
            max_tokens: 1024,
            stream: false,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: APPLICATION_MODERATION_PROMPT },
              // Whitelist only reviewable text; never send credentials or the raw request body.
              { role: 'user', content: JSON.stringify({ fields }) },
            ],
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok) throw unavailable();
        const text = await response.text();
        if (text.length > 65536) throw unavailable();
        const payload: unknown = JSON.parse(text);
        if (!isObject(payload) || !Array.isArray(payload.choices) || payload.choices.length !== 1) throw unavailable();
        const choice: unknown = payload.choices[0];
        if (!isObject(choice) || choice.finish_reason !== 'stop' || !isObject(choice.message)
          || choice.message.role !== 'assistant' || typeof choice.message.content !== 'string'
          || !choice.message.content.trim() || choice.message.content.length > 8192
          || choice.message.refusal || choice.message.tool_calls) throw unavailable();
        result = parseModerationResult(JSON.parse(choice.message.content));
      } catch {
        // Never log upstream bodies, model reasons, input, tokens, keys or fetch errors.
        throw unavailable();
      } finally {
        activeCalls--;
      }

      if (result.decision === 'allow') return;
      const labels = [...new Set(result.issues.map((issue) => FIELD_LABELS[issue.field]))].join('、');
      if (result.decision === 'reject') {
        throw new HttpError(422, 'APPLICATION_CONTENT_REJECTED', `${labels}可能包含辱骂、攻击或威胁性内容，请修改后重新提交`);
      }
      throw new HttpError(422, 'APPLICATION_CONTENT_REVIEW_REQUIRED', `${labels}的表达存在歧义，请调整措辞后重新提交，或联系管理员`);
    },
  };
}

function reviewText(value: unknown, maxLength: number, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new HttpError(400, 'BAD_REQUEST', `请填写${label}`);
  const normalized = value.normalize('NFKC').replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, '').trim();
  if (!normalized) throw new HttpError(400, 'BAD_REQUEST', `请填写${label}`);
  if (value.length > maxLength || normalized.length > maxLength) {
    throw new HttpError(400, 'BAD_REQUEST', `${label}最多填写 ${maxLength} 个字符`);
  }
  return normalized;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function hasExactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => Object.hasOwn(value, key));
}
function parseModerationResult(value: unknown): ModerationResult {
  if (!isObject(value) || !hasExactKeys(value, ['decision', 'issues'])
    || typeof value.decision !== 'string' || !['allow', 'reject', 'review'].includes(value.decision) || !Array.isArray(value.issues)
    || value.issues.length > 2 || (value.decision === 'allow' ? value.issues.length !== 0 : value.issues.length === 0)) {
    throw unavailable();
  }
  for (const issue of value.issues) {
    if (!isObject(issue) || !hasExactKeys(issue, ['field', 'category', 'reason'])
      || typeof issue.field !== 'string' || !['text_1', 'text_2'].includes(issue.field) || !CATEGORIES.includes(issue.category as Category)
      || typeof issue.reason !== 'string' || !issue.reason.trim() || Array.from(issue.reason).length > 60) {
      throw unavailable();
    }
  }
  return value as unknown as ModerationResult;
}
function boundedInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}
