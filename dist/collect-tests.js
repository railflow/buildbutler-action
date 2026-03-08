"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectTests = collectTests;
const glob_1 = require("glob");
const fs_1 = require("fs");
const fast_xml_parser_1 = require("fast-xml-parser");
function parseStatus(tc) {
    if (tc.failure !== undefined)
        return 'FAILED';
    if (tc.error !== undefined)
        return 'ERROR';
    if (tc.skipped !== undefined)
        return 'SKIPPED';
    return 'PASSED';
}
function normalizeTestCase(tc) {
    const status = parseStatus(tc);
    const failure = tc.failure ?? tc.error;
    return {
        className: tc['@_classname'] ?? 'unknown',
        testName: tc['@_name'] ?? 'unknown',
        status,
        duration: parseFloat(tc['@_time'] ?? '0') * 1000,
        errorMessage: failure?.['@_message'] ?? (typeof failure === 'string' ? failure : undefined),
        stackTrace: typeof failure === 'object' ? failure['#text'] : undefined,
    };
}
function normalizeSuite(suite, buildId) {
    const rawCases = suite.testcase ?? [];
    const testCases = (Array.isArray(rawCases) ? rawCases : [rawCases]).map(normalizeTestCase);
    const failCount = testCases.filter(t => t.status === 'FAILED' || t.status === 'ERROR').length;
    const skipCount = testCases.filter(t => t.status === 'SKIPPED').length;
    const passCount = testCases.length - failCount - skipCount;
    return {
        buildId,
        name: suite['@_name'] ?? 'unnamed',
        totalCount: testCases.length,
        passCount,
        failCount,
        skipCount,
        duration: parseFloat(suite['@_time'] ?? '0') * 1000,
        testCases,
    };
}
async function collectTests(pattern, buildId) {
    if (!pattern)
        return [];
    const files = await (0, glob_1.glob)(pattern, { absolute: true });
    if (files.length === 0)
        return [];
    const parser = new fast_xml_parser_1.XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    const suites = [];
    for (const file of files) {
        try {
            const xml = (0, fs_1.readFileSync)(file, 'utf-8');
            const doc = parser.parse(xml);
            const root = doc.testsuites ?? doc;
            if (root.testsuite) {
                const raw = Array.isArray(root.testsuite) ? root.testsuite : [root.testsuite];
                for (const s of raw)
                    suites.push(normalizeSuite(s, buildId));
            }
            else if (root['@_name'] !== undefined) {
                suites.push(normalizeSuite(root, buildId));
            }
        }
        catch (err) {
            console.warn(`[buildbutler] Could not parse ${file}:`, err);
        }
    }
    return suites;
}
