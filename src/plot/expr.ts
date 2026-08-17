/** Restricted arithmetic expression parser. No eval, no assignments, no property access. */

export type ExprFn = (x: number) => number

const CONSTANTS: Record<string, number> = {
  e: Math.E,
  pi: Math.PI,
}

const UNARY: Record<string, (x: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  exp: Math.exp,
  log: Math.log,
  ln: Math.log,
  log10: Math.log10,
  log2: Math.log2,
  abs: Math.abs,
  sqrt: Math.sqrt,
  tanh: Math.tanh,
  sigmoid: (x) => {
    if (x >= 0) return 1 / (1 + Math.exp(-x))
    const z = Math.exp(x)
    return z / (1 + z)
  },
  relu: (x) => Math.max(0, x),
}

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'id'; value: string }
  | { kind: 'op'; value: string }

function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < source.length) {
    const ch = source[i]
    if (ch === ' ' || ch === '\t' || ch === '\n') {
      i += 1
      continue
    }
    if (ch >= '0' && ch <= '9' || (ch === '.' && source[i + 1] >= '0' && source[i + 1] <= '9')) {
      const start = i
      i += 1
      while (i < source.length && /[0-9.eE]/.test(source[i])) {
        if ((source[i] === 'e' || source[i] === 'E') && (source[i + 1] === '+' || source[i + 1] === '-')) i += 1
        i += 1
      }
      const raw = source.slice(start, i)
      const value = Number(raw)
      if (!Number.isFinite(value)) throw new Error(`invalid number "${raw}"`)
      tokens.push({ kind: 'num', value })
      continue
    }
    if (/[A-Za-z_]/.test(ch)) {
      const start = i
      i += 1
      while (i < source.length && /[A-Za-z0-9_]/.test(source[i])) i += 1
      tokens.push({ kind: 'id', value: source.slice(start, i) })
      continue
    }
    if ('+-*/^(),'.includes(ch)) {
      tokens.push({ kind: 'op', value: ch })
      i += 1
      continue
    }
    throw new Error(`unexpected character "${ch}" in expression`)
  }
  return tokens
}

interface Parser {
  tokens: Token[]
  i: number
}

function peek(p: Parser): Token | undefined {
  return p.tokens[p.i]
}

function take(p: Parser): Token {
  const token = p.tokens[p.i]
  if (token === undefined) throw new Error('unexpected end of expression')
  p.i += 1
  return token
}

function eatOp(p: Parser, value: string): boolean {
  const token = peek(p)
  if (token?.kind === 'op' && token.value === value) {
    p.i += 1
    return true
  }
  return false
}

type Node =
  | { kind: 'num'; value: number }
  | { kind: 'x' }
  | { kind: 'unary'; op: string; arg: Node }
  | { kind: 'binary'; op: string; left: Node; right: Node }
  | { kind: 'call'; name: string; args: Node[] }

function parseExpr(p: Parser): Node {
  return parseAdd(p)
}

function parseAdd(p: Parser): Node {
  let left = parseMul(p)
  while (true) {
    if (eatOp(p, '+')) left = { kind: 'binary', op: '+', left, right: parseMul(p) }
    else if (eatOp(p, '-')) left = { kind: 'binary', op: '-', left, right: parseMul(p) }
    else return left
  }
}

function parseMul(p: Parser): Node {
  let left = parsePow(p)
  while (true) {
    if (eatOp(p, '*')) left = { kind: 'binary', op: '*', left, right: parsePow(p) }
    else if (eatOp(p, '/')) left = { kind: 'binary', op: '/', left, right: parsePow(p) }
    else return left
  }
}

function parsePow(p: Parser): Node {
  const left = parseUnary(p)
  if (eatOp(p, '^')) return { kind: 'binary', op: '^', left, right: parsePow(p) }
  return left
}

function parseUnary(p: Parser): Node {
  if (eatOp(p, '+')) return parseUnary(p)
  if (eatOp(p, '-')) return { kind: 'unary', op: 'neg', arg: parseUnary(p) }
  return parsePrimary(p)
}

function parsePrimary(p: Parser): Node {
  const token = take(p)
  if (token.kind === 'num') return { kind: 'num', value: token.value }
  if (token.kind === 'id') {
    if (token.value === 'x') return { kind: 'x' }
    if (token.value in CONSTANTS) return { kind: 'num', value: CONSTANTS[token.value] }
    if (eatOp(p, '(')) {
      const args: Node[] = [parseExpr(p)]
      while (eatOp(p, ',')) args.push(parseExpr(p))
      if (!eatOp(p, ')')) throw new Error(`missing ) after ${token.value}(...)`)
      if (!(token.value in UNARY) && token.value !== 'min' && token.value !== 'max' && token.value !== 'log') {
        throw new Error(`unknown function "${token.value}"`)
      }
      return { kind: 'call', name: token.value, args }
    }
    throw new Error(`unknown identifier "${token.value}"`)
  }
  if (token.kind === 'op' && token.value === '(') {
    const inner = parseExpr(p)
    if (!eatOp(p, ')')) throw new Error('missing )')
    return inner
  }
  throw new Error('expected a number, x, or function call')
}

function evalNode(node: Node, x: number): number {
  switch (node.kind) {
    case 'num':
      return node.value
    case 'x':
      return x
    case 'unary':
      return -evalNode(node.arg, x)
    case 'binary': {
      const l = evalNode(node.left, x)
      const r = evalNode(node.right, x)
      if (node.op === '+') return l + r
      if (node.op === '-') return l - r
      if (node.op === '*') return l * r
      if (node.op === '/') return l / r
      return l ** r
    }
    case 'call': {
      if (node.name === 'min') return Math.min(...node.args.map(arg => evalNode(arg, x)))
      if (node.name === 'max') return Math.max(...node.args.map(arg => evalNode(arg, x)))
      if (node.name === 'log') {
        if (node.args.length === 1) return Math.log(evalNode(node.args[0], x))
        if (node.args.length === 2) return Math.log(evalNode(node.args[0], x)) / Math.log(evalNode(node.args[1], x))
        throw new Error('log takes 1 or 2 arguments')
      }
      const fn = UNARY[node.name]
      if (node.args.length !== 1) throw new Error(`${node.name} takes 1 argument`)
      return fn(evalNode(node.args[0], x))
    }
    default: {
      const _never: never = node
      return _never
    }
  }
}

/**
 * Compile a restricted expression into f(x).
 * @param source - arithmetic expression over x.
 * @returns a pure evaluator.
 */
export function compileExpr(source: string): ExprFn {
  const trimmed = source.trim()
  if (trimmed.length === 0) throw new Error('expression is empty')
  if (trimmed.length > 200) throw new Error('expression is too long')
  const parser: Parser = { tokens: tokenize(trimmed), i: 0 }
  const ast = parseExpr(parser)
  if (parser.i !== parser.tokens.length) throw new Error('unexpected trailing tokens in expression')
  return (x: number) => evalNode(ast, x)
}
