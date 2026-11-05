/**
 * @file ESLint rule `hub/no-raw-palette`.
 * @description The web app's token rule (docs/00 §4, docs/11 §6, docs/15 D31). In class strings it forbids palette utilities
 * (`bg-red-500`), literal sizes (`text-[13px]`), hex colours, physical direction (`ml-2`, `text-left`), gradients and a coloured or thicker
 * edge on one side (`border-s-4`, `border-t-destructive`). Same intent as the rule in F:/Goteav/Goteav-Dashboard/eslint.config.mjs. It reads
 * `className` and `style`, the arguments of `cn()`, and variables whose name says they hold classes, such as `menuItemClass`.
 */
const PALETTE =
  /\b(?:bg|text|border|ring|fill|stroke|from|via|to|divide|outline|shadow|accent|caret|decoration|placeholder)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}\b/;
const LITERAL_SIZE = /(?:^|[\s:])(?:text|leading|tracking)-\[\d/;
const LITERAL_BOX = /\b[a-z-]+-\[\d+(?:\.\d+)?(?:px|rem|em)\]/;
const HEX = /#[0-9a-fA-F]{3,8}\b/;
const PHYSICAL =
  /(?:^|[\s:])-?(?:ml|mr|pl|pr|left|right|rounded-l|rounded-r|border-l|border-r)-(?:\S+)|(?:^|[\s:])text-(?:left|right)(?:\s|$)/;
const GRADIENT = /(?:^|[\s:])bg-(?:linear|radial|conic|gradient)-/;
/** A thicker side (`border-s-4`) or a coloured side (`border-t-destructive`). A neutral 1 px divider is `border-t`, or `border-t border-border`. */
const ONE_SIDED_EDGE =
  /(?:^|[\s:])border-(?:s|e|t|b|l|r|x|y)-(?:[1-9]\d*|(?!border\b|transparent\b)[a-z][\w-]*)(?:\s|$|\/)/;

function violation(text) {
  if (PALETTE.test(text)) return 'palette';
  if (LITERAL_SIZE.test(text) || LITERAL_BOX.test(text)) return 'size';
  if (HEX.test(text)) return 'hex';
  if (PHYSICAL.test(text)) return 'physical';
  if (GRADIENT.test(text)) return 'gradient';
  if (ONE_SIDED_EDGE.test(text)) return 'edge';
  return null;
}

const CLASS_VARIABLE = /class|focusRing|variant|tone/i;

export const noRawPalette = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      palette: 'Use a token utility (bg-primary, text-muted-foreground), not a raw palette class.',
      size: 'Use a named size (text-body-sm) or a spacing step, not a literal size.',
      hex: 'Use a design token, not a hex colour.',
      physical: 'Use a logical property (ms-, me-, ps-, pe-, start-, end-, text-start, text-end).',
      gradient: 'No gradients (kit README, Colour).',
      edge: 'No coloured or thicker edge on one side of a card or panel (docs/15 D31). A neutral divider is `border-t`.',
    },
  },
  create(context) {
    function checkLiterals(node) {
      if (!node) return;
      if (node.type === 'Literal' && typeof node.value === 'string') {
        const messageId = violation(node.value);
        if (messageId) context.report({ node, messageId });
      } else if (node.type === 'TemplateLiteral') {
        for (const quasi of node.quasis) {
          const messageId = violation(quasi.value.raw);
          if (messageId) context.report({ node: quasi, messageId });
        }
        node.expressions.forEach(checkLiterals);
      } else if (node.type === 'JSXExpressionContainer') {
        checkLiterals(node.expression);
      } else if (node.type === 'ConditionalExpression') {
        checkLiterals(node.consequent);
        checkLiterals(node.alternate);
      } else if (node.type === 'LogicalExpression') {
        checkLiterals(node.left);
        checkLiterals(node.right);
      } else if (node.type === 'CallExpression') {
        node.arguments.forEach(checkLiterals);
      } else if (node.type === 'ArrayExpression') {
        node.elements.forEach(checkLiterals);
      } else if (node.type === 'ObjectExpression') {
        for (const property of node.properties) {
          if (property.type === 'Property') {
            checkLiterals(property.value);
            // `cn({ 'bg-red-500': on })`
            if (property.key.type === 'Literal') checkLiterals(property.key);
          }
        }
      }
    }
    return {
      JSXAttribute(node) {
        const name = node.name.name;
        if ((name === 'className' || name === 'style') && node.value) checkLiterals(node.value);
      },
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'cn')
          node.arguments.forEach(checkLiterals);
      },
      VariableDeclarator(node) {
        if (node.id.type === 'Identifier' && CLASS_VARIABLE.test(node.id.name)) checkLiterals(node.init);
      },
    };
  },
};
