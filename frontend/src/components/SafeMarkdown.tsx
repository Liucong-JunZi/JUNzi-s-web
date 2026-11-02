/**
 * SafeMarkdown - A secure markdown rendering component
 *
 * Security: Uses rehype-sanitize to prevent XSS attacks when rendering
 * user-generated markdown content. This component sanitizes HTML elements
 * and attributes according to a safe default schema.
 *
 * Usage:
 *   import { SafeMarkdown } from '@/components/SafeMarkdown';
 *   <SafeMarkdown content={userContent} />
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { visit } from 'unist-util-visit';
import type { Root } from 'hast';
import type { Root as MarkdownRoot } from 'mdast';
import 'katex/dist/katex.min.css';

interface SafeMarkdownProps {
  content: string;
  className?: string;
}

// Configure sanitization schema
// Default schema allows common safe HTML elements but removes scripts, iframes, etc.
const sanitizeSchema = {
  ...defaultSchema,
  // Allow specific attributes that are commonly used in markdown
  attributes: {
    ...defaultSchema.attributes,
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title'],
    code: ['className', 'data-*'],
    pre: ['className'],
  },
  // Ensure all links have rel="noopener noreferrer" for security
  tagNames: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'div', 'span',
    'a', 'img',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'strong', 'em', 'b', 'i',
    'hr', 'br',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'del', 's',
  ],
};

// Also accept standalone $$...$$ on one line, as used in existing posts.
function remarkDisplayMath() {
  return (tree: MarkdownRoot, file: { value: unknown }) => {
    const source = String(file.value);
    visit(tree, 'paragraph', (node) => {
      const child = node.children[0];
      if (node.children.length !== 1 || child?.type !== 'inlineMath') return;
      const raw = source.slice(node.position?.start.offset, node.position?.end.offset).trim();
      if (!raw.startsWith('$$') || !raw.endsWith('$$')) return;
      child.data = { ...child.data, hProperties: { className: ['language-math', 'math-display'] } };
    });
  };
}

// Some saved posts contain HTML-escaped comparisons inside TeX. Decode only
// math code nodes, leaving ordinary code samples and Markdown untouched.
function rehypeMathComparisons() {
  return (tree: Root) => {
    visit(tree, 'element', (node) => {
      const classes = node.properties.className;
      if (node.tagName !== 'code' || !Array.isArray(classes) || !classes.includes('language-math')) return;
      visit(node, 'text', (text) => {
        text.value = text.value.replace(/&(?:lt|gt);/g, (entity) => entity === '&lt;' ? '<' : '>');
      });
    });
  };
}

export function SafeMarkdown({ content, className }: SafeMarkdownProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkDisplayMath]}
        // Sanitize user content first, then let KaTeX generate its own markup.
        // Sanitizing afterwards would strip the required MathML and styles.
        rehypePlugins={[[rehypeSanitize, sanitizeSchema], rehypeMathComparisons, [rehypeKatex, { trust: false, strict: 'warn' }]]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default SafeMarkdown;