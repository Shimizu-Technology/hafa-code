import { parse, type Node } from 'acorn'

type SyntaxNode = Node & Record<string, unknown>

type Scope = {
  parent?: Scope
  bindings: Map<string, SyntaxNode>
}

function isNode(value: unknown): value is SyntaxNode {
  return typeof value === 'object'
    && value !== null
    && typeof (value as { type?: unknown }).type === 'string'
    && typeof (value as { start?: unknown }).start === 'number'
    && typeof (value as { end?: unknown }).end === 'number'
}

function childNodes(node: SyntaxNode) {
  return Object.values(node).flatMap((value) => {
    if (isNode(value)) return [value]
    if (Array.isArray(value)) return value.filter(isNode)
    return []
  })
}

function isFunction(node: SyntaxNode) {
  return ['ArrowFunctionExpression', 'FunctionDeclaration', 'FunctionExpression'].includes(node.type)
}

function identifierName(node: unknown) {
  return isNode(node) && node.type === 'Identifier' && typeof node.name === 'string'
    ? node.name
    : undefined
}

function createScope(parent?: Scope): Scope {
  return { parent, bindings: new Map() }
}

function bindPattern(pattern: unknown, binding: SyntaxNode, scope: Scope) {
  if (!isNode(pattern)) return
  const name = identifierName(pattern)
  if (name) {
    scope.bindings.set(name, binding)
    return
  }

  if (pattern.type === 'RestElement') {
    bindPattern(pattern.argument, binding, scope)
  } else if (pattern.type === 'AssignmentPattern') {
    bindPattern(pattern.left, binding, scope)
  } else if (pattern.type === 'ArrayPattern' && Array.isArray(pattern.elements)) {
    pattern.elements.forEach((element) => bindPattern(element, binding, scope))
  } else if (pattern.type === 'ObjectPattern' && Array.isArray(pattern.properties)) {
    pattern.properties.forEach((property) => {
      if (isNode(property) && property.type === 'Property') bindPattern(property.value, binding, scope)
      if (isNode(property) && property.type === 'RestElement') bindPattern(property.argument, binding, scope)
    })
  }
}

function indexScopes(root: SyntaxNode) {
  const scopes = new WeakMap<SyntaxNode, Scope>()
  const rootScope = createScope()

  const visit = (node: SyntaxNode, inheritedScope: Scope) => {
    if (node.type === 'FunctionDeclaration') {
      const name = identifierName(node.id)
      if (name) inheritedScope.bindings.set(name, node)
    }

    let scope = inheritedScope
    if (node !== root && (node.type === 'BlockStatement' || node.type === 'CatchClause' || isFunction(node))) {
      scope = createScope(inheritedScope)
    }
    scopes.set(node, scope)

    if (isFunction(node) && Array.isArray(node.params)) {
      node.params.forEach((parameter) => bindPattern(parameter, isNode(parameter) ? parameter : node, scope))
    }
    if (node.type === 'CatchClause') {
      bindPattern(node.param, isNode(node.param) ? node.param : node, scope)
    }
    if (node.type === 'VariableDeclarator') {
      const binding = isNode(node.init) && isFunction(node.init) ? node.init : node
      bindPattern(node.id, binding, scope)
    }

    childNodes(node).forEach((child) => visit(child, scope))
  }

  visit(root, rootScope)
  return scopes
}

function resolveBinding(scope: Scope | undefined, name: string) {
  let current = scope
  while (current) {
    const binding = current.bindings.get(name)
    if (binding) return binding
    current = current.parent
  }
  return undefined
}

function functionBody(source: string, callback: SyntaxNode | undefined) {
  if (!callback || !isFunction(callback) || !isNode(callback.body)) return ''
  const body = callback.body
  return body.type === 'BlockStatement'
    ? source.slice(body.start + 1, body.end - 1)
    : source.slice(body.start, body.end)
}

function listenerCallback(
  node: SyntaxNode,
  receiver: string,
  eventName: string,
  scope: Scope | undefined,
) {
  if (node.type !== 'CallExpression' || !isNode(node.callee)) return undefined
  const callee = node.callee
  if (callee.type !== 'MemberExpression' || identifierName(callee.object) !== receiver) return undefined

  const propertyName = callee.computed
    ? isNode(callee.property) && callee.property.type === 'Literal' && callee.property.value === 'addEventListener'
      ? 'addEventListener'
      : undefined
    : identifierName(callee.property)
  if (propertyName !== 'addEventListener' || !Array.isArray(node.arguments)) return undefined

  const [event, callback] = node.arguments
  if (!isNode(event) || event.type !== 'Literal' || event.value !== eventName || !isNode(callback)) {
    return undefined
  }
  if (isFunction(callback)) return callback

  const callbackName = identifierName(callback)
  return callbackName ? resolveBinding(scope, callbackName) : undefined
}

/** Returns bodies from live listeners on the exact receiver, with named callbacks resolved lexically. */
export function eventHandlerBody(receiver: string, eventName: string) {
  return (source: string) => {
    let root: SyntaxNode
    try {
      root = parse(source, { ecmaVersion: 'latest', sourceType: 'script' }) as unknown as SyntaxNode
    } catch {
      return ''
    }

    const scopes = indexScopes(root)
    const bodies: string[] = []
    const visit = (node: SyntaxNode) => {
      const callback = listenerCallback(node, receiver, eventName, scopes.get(node))
      if (callback) bodies.push(functionBody(source, callback))
      childNodes(node).forEach(visit)
    }
    visit(root)
    return bodies.filter((body) => body.trim()).join('\n')
  }
}
