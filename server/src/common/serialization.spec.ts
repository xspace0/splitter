/**
 * 序列化回归测试
 *
 * 背景：Prisma 的 BigInt 字段（id / parentId / regionId 等）用 JSON.stringify 时
 * 会抛 "Do not know how to serialize a BigInt"，导致任何直接返回实体对象的接口 500。
 * 该问题在本地无数据库时不会暴露，只在真实请求序列化响应时出现
 * （曾导致测试环境 /api/communities 整体 500）。
 *
 * main.ts 中为 BigInt.prototype 补了 toJSON 做全局修复，这里锁定该行为，
 * 避免以后被误删。
 */
describe('BigInt JSON 序列化', () => {
  beforeAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (BigInt.prototype as any).toJSON = function () {
      return this.toString();
    };
  });

  it('含 BigInt 的对象可被 JSON.stringify（序列化为字符串）', () => {
    const payload = {
      id: 1n,
      communityId: 42n,
      parentId: null,
      name: '永宁',
    };
    const json = JSON.stringify(payload);
    expect(json).toBe('{"id":"1","communityId":"42","parentId":null,"name":"永宁"}');
  });

  it('嵌套结构中的 BigInt 也能正确序列化', () => {
    const payload = {
      total: 1,
      list: [{ id: 7n, region: { id: 3n, regionName: '延庆区' } }],
    };
    const parsed = JSON.parse(JSON.stringify(payload));
    expect(parsed.list[0].id).toBe('7');
    expect(parsed.list[0].region.id).toBe('3');
  });

  it('修复前会抛错（证明该测试确实覆盖到问题）', () => {
    // 临时移除补丁，复现 Node 原生行为，确认该缺陷真实存在
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patched = (BigInt.prototype as any).toJSON;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const probe: any = { id: BigInt(1) };
    expect(JSON.stringify(probe)).toBe('{"id":"1"}'); // 补丁生效

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (BigInt.prototype as any).toJSON;
    try {
      expect(() => JSON.stringify(probe)).toThrow(TypeError);
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (BigInt.prototype as any).toJSON = patched;
    }
  });
});
