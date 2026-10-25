/** Strict text KV3 reader. Typed resource literals are strings, never executable code. */
export function parseKv3(source: string): Record<string, any> {
  const tokens: string[] = [];
  const lexer =
    /\s+|<!--[^]*?-->|\/\*[^]*?\*\/|\/\/[^\r\n]*|"(?:\\[^]|[^"\\])*"|[{}\[\]=,:]|[^\s{}\[\]=,:"]+/gy;
  let offset = 0;
  while (offset < source.length) {
    lexer.lastIndex = offset;
    const match = lexer.exec(source);
    if (!match) throw new Error(`Invalid KV3 token at ${offset}`);
    offset = lexer.lastIndex;
    if (!/^\s|^<!--|^\/\*|^\/\//.test(match[0])) tokens.push(match[0]);
  }
  let index = 0;
  const take = () => {
    if (index >= tokens.length) throw new Error('Unexpected end of KV3');
    return tokens[index++];
  };
  const string = (token: string) => JSON.parse(token) as string;
  function value(depth: number): any {
    if (depth > 128) throw new Error('KV3 nesting limit');
    const token = take();
    if (token === '{') {
      const result: Record<string, any> = {};
      while (tokens[index] !== '}') {
        if (tokens[index] === ',') {
          index++;
          continue;
        }
        const raw = take();
        const key = raw.startsWith('"') ? string(raw) : raw;
        if (
          !key ||
          /[{}\[\]=,:]/.test(raw[0]) ||
          Object.hasOwn(result, key) ||
          ['__proto__', 'constructor', 'prototype'].includes(key)
        )
          throw new Error(`Invalid or duplicate KV3 key ${key}`);
        if (take() !== '=') throw new Error('Expected KV3 assignment');
        Object.defineProperty(result, key, {
          value: value(depth + 1),
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
      take();
      return result;
    }
    if (token === '[') {
      const result: any[] = [];
      while (tokens[index] !== ']') {
        if (tokens[index] === ',') {
          index++;
          continue;
        }
        result.push(value(depth + 1));
      }
      take();
      return result;
    }
    if (tokens[index] === ':') {
      if (!['resource_name', 'soundevent', 'panorama', 'subclass'].includes(token))
        throw new Error(`Unsupported KV3 type ${token}`);
      index++;
      const result = value(depth + 1);
      if (
        token === 'subclass'
          ? !result || typeof result !== 'object' || Array.isArray(result)
          : typeof result !== 'string'
      )
        throw new Error('Invalid typed KV3 value');
      return result;
    }
    if (token.startsWith('"')) return string(token);
    if (token === 'true') return true;
    if (token === 'false') return false;
    if (token === 'null') return null;
    if (
      /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(token) ||
      /^0x[\da-f]+$/i.test(token)
    ) {
      const number = Number(token);
      if (!Number.isFinite(number)) throw new Error('Non-finite KV3 number');
      return number;
    }
    throw new Error(`Unsupported KV3 value ${token}`);
  }
  const result = value(0);
  if (index !== tokens.length || !result || Array.isArray(result) || typeof result !== 'object')
    throw new Error('KV3 root or trailing data invalid');
  return result;
}
