import { glob } from 'glob';
import { readFileSync } from 'fs';
import { XMLParser } from 'fast-xml-parser';

export interface TestCasePayload {
  className: string;
  testName: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED' | 'ERROR';
  duration: number;
  errorMessage?: string;
  stackTrace?: string;
}

export interface TestSuitePayload {
  buildId: string;
  name: string;
  totalCount: number;
  passCount: number;
  failCount: number;
  skipCount: number;
  duration: number;
  testCases: TestCasePayload[];
}

function parseStatus(tc: any): 'PASSED' | 'FAILED' | 'SKIPPED' | 'ERROR' {
  if (tc.failure !== undefined) return 'FAILED';
  if (tc.error   !== undefined) return 'ERROR';
  if (tc.skipped !== undefined) return 'SKIPPED';
  return 'PASSED';
}

function normalizeTestCase(tc: any): TestCasePayload {
  const status = parseStatus(tc);
  const failure = tc.failure ?? tc.error;
  return {
    className: tc['@_classname'] ?? 'unknown',
    testName:  tc['@_name']      ?? 'unknown',
    status,
    duration: parseFloat(tc['@_time'] ?? '0') * 1000,
    errorMessage: failure?.['@_message'] ?? (typeof failure === 'string' ? failure : undefined),
    stackTrace:   typeof failure === 'object' ? failure['#text'] : undefined,
  };
}

function normalizeSuite(suite: any, buildId: string): TestSuitePayload {
  const rawCases = suite.testcase ?? [];
  const testCases: TestCasePayload[] = (Array.isArray(rawCases) ? rawCases : [rawCases]).map(normalizeTestCase);

  const failCount = testCases.filter(t => t.status === 'FAILED' || t.status === 'ERROR').length;
  const skipCount = testCases.filter(t => t.status === 'SKIPPED').length;
  const passCount = testCases.length - failCount - skipCount;

  return {
    buildId,
    name:       suite['@_name']     ?? 'unnamed',
    totalCount: testCases.length,
    passCount,
    failCount,
    skipCount,
    duration:   parseFloat(suite['@_time'] ?? '0') * 1000,
    testCases,
  };
}

export async function collectTests(pattern: string, buildId: string): Promise<TestSuitePayload[]> {
  if (!pattern) return [];

  const files = await glob(pattern, { absolute: true });
  if (files.length === 0) return [];

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const suites: TestSuitePayload[] = [];

  for (const file of files) {
    try {
      const xml  = readFileSync(file, 'utf-8');
      const doc  = parser.parse(xml);
      const root = doc.testsuites ?? doc;

      if (root.testsuite) {
        const raw = Array.isArray(root.testsuite) ? root.testsuite : [root.testsuite];
        for (const s of raw) suites.push(normalizeSuite(s, buildId));
      } else if (root['@_name'] !== undefined) {
        suites.push(normalizeSuite(root, buildId));
      }
    } catch (err) {
      console.warn(`[buildbutler] Could not parse ${file}:`, err);
    }
  }

  return suites;
}
