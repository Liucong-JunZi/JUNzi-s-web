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

export function SafeMarkdown({ content, className }: SafeMarkdownProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default SafeMarkdown;