import { ForbiddenException } from '@nestjs/common';
import { SplitterService } from './splitter.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogService } from '../log/log.service';

/** 构造被测服务：这些用例只覆盖纯校验逻辑，不触碰数据库 */
function createService(prismaOverrides: Partial<Record<string, unknown>> = {}) {
  const prisma = prismaOverrides as unknown as PrismaService;
  const log = { log: jest.fn().mockResolvedValue(undefined) } as unknown as LogService;
  return new SplitterService(prisma, log);
}

type AnyService = {
  buildTree: (rows: any[]) => any[];
  validateParentLevel: (level: number, parentLevel: number | null) => void;
  validateStatusAndFaultType: (status: number, faultType?: number | null) => void;
  validateSplitterLevel: (level: number) => void;
  validateSplitRatio: (level: number, splitRatio?: string | null) => void;
  checkCycle: (parentId: bigint, selfId?: bigint) => Promise<void>;
};

const rows = [
  { id: 1n, parentId: null, splitterName: '光交A' },
  { id: 2n, parentId: 1n, splitterName: '一级A' },
  { id: 3n, parentId: 2n, splitterName: '二级A' },
  { id: 4n, parentId: 3n, splitterName: '成端A' },
  { id: 5n, parentId: 2n, splitterName: '二级B' },
];

describe('SplitterService 拓扑与管理校验', () => {
  let service: AnyService;

  beforeEach(() => {
    service = createService() as unknown as AnyService;
  });

  describe('buildTree', () => {
    it('按 parentId 组装四级拓扑树', () => {
      const tree = service.buildTree(rows);
      expect(tree).toHaveLength(1);
      expect(tree[0].splitterName).toBe('光交A');
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children[0].children).toHaveLength(2);
      expect(tree[0].children[0].children[0].children[0].splitterName).toBe('成端A');
    });

    it('父节点不在结果集内时按根节点处理，不丢节点', () => {
      const orphan = [
        { id: 9n, parentId: 99n, splitterName: '孤儿节点' },
        { id: 10n, parentId: null, splitterName: '根节点' },
      ];
      const tree = service.buildTree(orphan);
      expect(tree.map((n) => n.splitterName).sort()).toEqual(['孤儿节点', '根节点']);
    });
  });

  describe('validateParentLevel', () => {
    it('光交不允许有父设备', () => {
      expect(() => service.validateParentLevel(1, 1)).toThrow(ForbiddenException);
    });

    it('非光交必须指定父设备', () => {
      expect(() => service.validateParentLevel(2, null)).toThrow(ForbiddenException);
    });

    it('一级的父必须是光交', () => {
      expect(() => service.validateParentLevel(2, 1)).not.toThrow();
      expect(() => service.validateParentLevel(2, 2)).toThrow(ForbiddenException);
    });

    it('二级的父必须是一级，成端的父必须是二级', () => {
      expect(() => service.validateParentLevel(3, 2)).not.toThrow();
      expect(() => service.validateParentLevel(3, 1)).toThrow(ForbiddenException);
      expect(() => service.validateParentLevel(4, 3)).not.toThrow();
      expect(() => service.validateParentLevel(4, 2)).toThrow(ForbiddenException);
    });
  });

  describe('validateSplitterLevel', () => {
    it('只接受 1-4', () => {
      [1, 2, 3, 4].forEach((l) => expect(() => service.validateSplitterLevel(l)).not.toThrow());
      [0, 5, 99, -1].forEach((l) =>
        expect(() => service.validateSplitterLevel(l)).toThrow(ForbiddenException),
      );
    });
  });

  describe('validateSplitRatio', () => {
    it('级别1-3必须填写且在枚举内', () => {
      expect(() => service.validateSplitRatio(2, '1:8')).not.toThrow();
      expect(() => service.validateSplitRatio(2, undefined)).toThrow(ForbiddenException);
      expect(() => service.validateSplitRatio(2, '1:128')).toThrow(ForbiddenException);
    });

    it('光缆成端不允许设置分路比', () => {
      expect(() => service.validateSplitRatio(4, null)).not.toThrow();
      expect(() => service.validateSplitRatio(4, '1:8')).toThrow(ForbiddenException);
    });
  });

  describe('validateStatusAndFaultType', () => {
    it('故障状态必须填写合法故障类型', () => {
      expect(() => service.validateStatusAndFaultType(2, 1)).not.toThrow();
      expect(() => service.validateStatusAndFaultType(2, undefined)).toThrow(ForbiddenException);
      expect(() => service.validateStatusAndFaultType(2, 9)).toThrow(ForbiddenException);
    });

    it('非故障状态禁止保留故障类型', () => {
      [1, 3, 4].forEach((s) => {
        expect(() => service.validateStatusAndFaultType(s, null)).not.toThrow();
        expect(() => service.validateStatusAndFaultType(s, 1)).toThrow(ForbiddenException);
      });
    });

    it('状态取值必须在 1-4 内', () => {
      [0, 5, -1].forEach((s) =>
        expect(() => service.validateStatusAndFaultType(s, null)).toThrow(ForbiddenException),
      );
    });
  });

  describe('checkCycle', () => {
    it('父链回到自身时判定为循环', async () => {
      // 2 的父是 1；把 1 的父改为 2 时应检测到环
      const prisma = {
        opticalSplitter: {
          findUnique: jest.fn(async ({ where }: any) => {
            if (where.id === 1n) return { parentId: 2n };
            if (where.id === 2n) return { parentId: null };
            return null;
          }),
        },
      };
      const svc = createService(prisma) as unknown as AnyService;
      await expect(svc.checkCycle(1n, 1n)).rejects.toThrow(ForbiddenException);
    });

    it('父链正常结束时不报错', async () => {
      const prisma = {
        opticalSplitter: {
          findUnique: jest.fn(async ({ where }: any) => {
            if (where.id === 1n) return { parentId: null };
            return null;
          }),
        },
      };
      const svc = createService(prisma) as unknown as AnyService;
      await expect(svc.checkCycle(1n, 5n)).resolves.toBeUndefined();
    });

    it('创建场景（无自身 id）下父链成环也会被拦截', async () => {
      const prisma = {
        opticalSplitter: {
          findUnique: jest.fn(async ({ where }: any) => {
            if (where.id === 7n) return { parentId: 8n };
            if (where.id === 8n) return { parentId: 7n };
            return null;
          }),
        },
      };
      const svc = createService(prisma) as unknown as AnyService;
      await expect(svc.checkCycle(7n)).rejects.toThrow(ForbiddenException);
    });
  });
});
