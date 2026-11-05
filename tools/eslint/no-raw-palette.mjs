/**
 * @file ESLint rule `hub/no-raw-palette`.
 * @description Forbids palette utilities (`bg-red-500`), literal sizes (`text-[13px]`) and hex colours
 * in `className` and `style`, so the web app only uses design tokens (docs/11 §6). Same intent as the
 * rule in F:/Goteav/Goteav-Dashboard/eslint.config.mjs.
 */
const PALETTE =
  /\b(?:bg|text|border|ring|fill|stroke|from|via|to|divide|outline|shadow|accent|caret|decoration|placeholder)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}\b/;
const LITERAL_SIZE = /\b[a-z-]+-\[\d+(?:\.\d+)?(?:px|rem|em)\]/;
const HEX = /#[0-9a-fA-F]{3,8}\b/;

function violation(text) {
  if (PALETTE.test(text)) return 'palette';
  if (LITERAL_SIZE.test(text)) return 'size';
  if (HEX.test(text)) return 'hex';
  return null;
}

export const noRawPalette = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      palette: 'Use a token utility (bg-primary, text-muted-foreground), not a raw palette class.',
      size: 'Use a token size (text-sm), not a literal size.',
      hex: 'Use a design token, not a hex colour.',
    },
  },
  create(context) {
    function checkLiterals(node) {
      if (node.type === 'Literal' && typeof node.value === 'string') {
        const messageId = violation(node.value);
        if (messageId) context.report({ node, messageId });
      } else if (node.type === 'TemplateLiteral') {
        for (const quasi of node.quasis) {
          const messageId = violation(quasi.value.raw);
          if (messageId) context.report({ node: quasi, messageId });
        }
      } else if (node.type === 'JSXExpressionContainer') {
        checkLiterals(node.expression);
      } else if (node.type === 'ConditionalExpression') {
        checkLiterals(node.consequent);
        checkLiterals(node.alternate);
      } else if (node.type === 'LogicalExpression') {
        checkLiterals(node.right);
      } else if (node.type === 'CallExpression') {
        node.arguments.forEach(checkLiterals);
      } else if (node.type === 'ObjectExpression') {
        for (const property of node.properties) {
          if (property.type === 'Property') checkLiterals(property.value);
        }
      }
    }
    return {
      JSXAttribute(node) {
        const name = node.name.name;
        if ((name === 'className' || name === 'style') && node.value) checkLiterals(node.value);
      },
    };
  },
};
