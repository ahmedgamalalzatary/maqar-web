import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import { m } from '@/core/i18n';

const SRC = path.join(__dirname, '../../../..', 'src');
const CATALOG = path.join(SRC, 'core/i18n/messages');
const ARABIC = /[؀-ۿ]/;

/**
 * Arabic text that may live outside the catalog, with why. Everything else is interface copy and
 * belongs in `core/i18n/messages` (2026-11-16).
 */
const ALLOWED: Record<string, string> = {
  'components/logo.tsx': 'the brand lock-up, read the same in both languages',
  'features/account/screens/me-screen.tsx': 'each language named in itself (العربية / English)',
  'features/admin/screens/agent-form-screen.tsx': 'default values saved to the server for a new advisor',
  'features/agent/screens/leads-screen.tsx': 'letter folding for search',
  'features/calculator/components/installment-calculator.tsx': 'the Arabic decimal separator',
  'features/calculator/rate.ts': 'reading Arabic digits',
  'features/listings/filters.ts': 'reading Arabic digits',
  'features/prefs/screens/onboarding-screen.tsx': 'stripping the currency word from a chip',
};

function files(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) files(p, out);
    else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts') && !p.startsWith(CATALOG)) out.push(p);
  }
  return out;
}

const isFixed = (v: unknown): v is { ar: string; en: string } => typeof v === 'object' && v !== null;

describe('message catalog', () => {
  it('keeps every Arabic text in the catalog, apart from the listed exceptions', () => {
    const found: string[] = [];
    for (const file of files(SRC)) {
      const rel = path.relative(SRC, file).replace(/\\/g, '/');
      if (ALLOWED[rel]) continue;
      const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const visit = (node: ts.Node) => {
        const text = ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isJsxText(node) ? node.text : ts.isTemplateExpression(node) ? node.getText(sf) : '';
        if (ARABIC.test(text)) found.push(`${rel}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`);
        else ts.forEachChild(node, visit);
      };
      visit(sf);
    }
    expect(found).toEqual([]);
  });

  it('has both languages, non-empty, for every fixed entry', () => {
    for (const entries of Object.values(m)) {
      for (const msg of Object.values(entries).filter(isFixed)) {
        expect(msg.ar.trim()).not.toBe('');
        expect(msg.en.trim()).not.toBe('');
        expect(msg.ar).toMatch(ARABIC);
      }
    }
  });

  it('does not repeat the same pair in two entries', () => {
    const seen = new Map<string, string>();
    for (const [area, entries] of Object.entries(m)) {
      for (const [key, msg] of Object.entries(entries)) {
        if (!isFixed(msg)) continue;
        const id = `${area}.${key}`;
        const pair = `${msg.ar}\u0000${msg.en}`;
        expect(seen.get(pair) ?? id).toBe(id);
        seen.set(pair, id);
      }
    }
  });
});
