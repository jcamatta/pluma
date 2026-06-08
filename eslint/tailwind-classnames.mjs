// Bans two Tailwind class patterns inside JSX className values, project-wide:
//   1. Arbitrary pixel values:        w-[100px], text-[13.5px], rounded-[20px], gap-[9px], ...
//   2. Fractional spacing utilities:  py-2.5, gap-3.5, p-4.5, gap-2.25, mb-0.5, ...
// Use the design-token scale instead of magic pixel values, and whole-step utilities instead of
// fractional ones.
//
// This is scoped to className (and the cn()/clsx() class-builder calls) so it never touches SVG path
// data like d="M12 3.5..." or other strings that legitimately contain numbers. It reads both string
// literals (className="...") and template literals (className={`...`}), which a no-restricted-syntax
// regex selector cannot do.

// [<number>px] arbitrary value, e.g. [20px] or [13.5px]. The leading [ keeps it from matching a bare
// "20px" that is not a Tailwind arbitrary value.
const ARBITRARY_PX = /\[[0-9]*\.?[0-9]+px\]/

// Fractional utility: a word boundary, a utility token, a dash, then a number with a decimal part,
// e.g. py-2.5, gap-2.25, mb-0.5. The token must start with a letter so we don't flag arbitrary values
// or numbers inside brackets.
const FRACTIONAL_UTILITY = /(^|[\s`'"])-?[a-z][a-z-]*-[0-9]+\.[0-9]+(?=$|[\s`'"])/

const PX_MESSAGE =
  'Arbitrary pixel value in className (e.g. [20px]) is forbidden. Use a spacing/size token from the scale.'
const FRACTIONAL_MESSAGE =
  'Fractional Tailwind utility in className (e.g. py-2.5, gap-3.5) is forbidden. Use a whole-step utility from the scale.'

// Inspect one className-bearing source of class strings and report any violation it contains.
const checkClassString = (context, node, value) => {
  if (ARBITRARY_PX.test(value)) {
    context.report({ node, message: PX_MESSAGE })
  }
  if (FRACTIONAL_UTILITY.test(value)) {
    context.report({ node, message: FRACTIONAL_MESSAGE })
  }
}

// Walk the value of a className attribute: a bare string, or a JSX expression wrapping a string literal,
// a template literal, or a class-builder call. Static quasis of template literals are checked; the
// expression holes (${...}) are visited as their own nodes by the AST walk, so each nested literal is
// still reached.
const checkClassNameValue = (context, valueNode) => {
  if (valueNode === null) return
  if (valueNode.type === 'Literal' && typeof valueNode.value === 'string') {
    checkClassString(context, valueNode, valueNode.value)
    return
  }
  if (valueNode.type === 'JSXExpressionContainer') {
    checkExpression(context, valueNode.expression)
  }
}

// A className expression may be a string literal, a template literal, or anything else (a call,
// a conditional, an identifier). We check the literals we can see; nested literals inside calls and
// conditionals are reached by the Literal/TemplateLiteral visitors below when they appear in a
// className context, so here we only handle the directly-attached forms.
const checkExpression = (context, expr) => {
  if (expr === undefined || expr === null) return
  if (expr.type === 'Literal' && typeof expr.value === 'string') {
    checkClassString(context, expr, expr.value)
    return
  }
  if (expr.type === 'TemplateLiteral') {
    for (const quasi of expr.quasis) {
      checkClassString(context, quasi, quasi.value.raw)
    }
    for (const sub of expr.expressions) {
      checkExpression(context, sub)
    }
    return
  }
  if (expr.type === 'ConditionalExpression') {
    checkExpression(context, expr.consequent)
    checkExpression(context, expr.alternate)
    return
  }
  if (expr.type === 'LogicalExpression') {
    checkExpression(context, expr.left)
    checkExpression(context, expr.right)
    return
  }
}

const noBadTailwindClasses = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Forbid arbitrary pixel values and fractional utilities in Tailwind className values'
    },
    schema: []
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'className') return
        checkClassNameValue(context, node.value)
      }
    }
  }
}

// Exported as a flat-config block wiring the local rule under a `pluma` plugin namespace.
export const tailwindClassnames = {
  files: ['src/renderer/**/*.{tsx,ts}'],
  plugins: {
    pluma: {
      rules: {
        'no-bad-tailwind-classes': noBadTailwindClasses
      }
    }
  },
  rules: {
    'pluma/no-bad-tailwind-classes': 'error'
  }
}
