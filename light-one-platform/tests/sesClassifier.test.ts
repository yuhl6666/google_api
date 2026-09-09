import { describe, expect, it } from 'vitest';
import { classifySesEmail } from '../models/ses/sesClassifier.js';
import { SesEmailInput } from '../models/ses/sesEmail.js';
import { createTestRouter } from './helpers/testRouter.js';

const projectEmail: SesEmailInput = {
  subject: '【急募】AWSインフラエンジニア案件のご紹介',
  body: '案件名: ECサイト基盤構築\n単価: 80万円/月\n勤務地: 東京(リモート可)\nスキル: AWS, Terraform, Kubernetes\n稼働: 週5日',
  sender: 'project-info@ses-agency.example.com',
  attachmentNames: ['案件概要.pdf'],
};

describe('classifySesEmail', () => {
  it('returns a verified project classification for a high-confidence result', async () => {
    const { router } = createTestRouter({
      'ses-classifier': { kind: 'success', result: { category: 'project', confidence: 0.94, reason: 'AWS案件の募集要項と単価・勤務地条件が記載されている' } },
    });

    const evaluated = await classifySesEmail(router, projectEmail);

    expect(evaluated.output.category).toBe('project');
    expect(evaluated.verified).toBe(true);
    expect(evaluated.needsHumanReview).toBe(false);
    expect(evaluated.trace.modelId).toBe('ses-classifier');
  });

  it('flags low-confidence results for human review instead of trusting them', async () => {
    const { router } = createTestRouter({
      'ses-classifier': { kind: 'success', result: { category: 'other', confidence: 0.3 } },
    });

    const evaluated = await classifySesEmail(router, projectEmail);

    expect(evaluated.needsHumanReview).toBe(true);
    expect(evaluated.verified).toBe(false);
  });

  it('flags a category outside the known SES taxonomy for human review', async () => {
    const { router } = createTestRouter({
      'ses-classifier': { kind: 'success', result: { category: 'spam', confidence: 0.99 } },
    });

    const evaluated = await classifySesEmail(router, projectEmail);

    expect(evaluated.needsHumanReview).toBe(true);
    expect(evaluated.verified).toBe(false);
    expect(evaluated.notes.some((n) => n.includes('not one of the known SES categories'))).toBe(true);
  });

  it('always routes SES email classification through the ses-classifier local model', async () => {
    const { router } = createTestRouter();

    const evaluated = await classifySesEmail(router, projectEmail);

    expect(evaluated.trace.modelId).toBe('ses-classifier');
    expect(evaluated.trace.providerKind).toBe('local');
  });
});
