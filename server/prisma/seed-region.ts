/**
 * 行政区划 seed 脚本
 *
 * 背景：sys_region 是静态国标字典表，文档《数据库设计》3.5 要求由后台导入脚本维护，
 * 业务系统只提供查询。但项目此前没有任何导入脚本，导致：
 *   - sys_region 为空表，社区无法绑定区县（实测存在 region_id=0 的孤儿数据）
 *   - 「按区县隔离」的核心权限规则失效
 *   - 前端省/市/区县级联选择无数据
 *
 * 用法：
 *   npx ts-node prisma/seed-region.ts                    # 用内置的延庆区及上级
 *   npx ts-node prisma/seed-region.ts regions.json       # 用自定义 JSON
 *
 * 自定义 JSON 格式（三级，可选嵌套）：
 *   [
 *     { "name": "北京市", "code": "110000", "level": 1,
 *       "children": [
 *         { "name": "北京市", "code": "110100", "level": 2,
 *           "children": [ { "name": "延庆区", "code": "110119", "level": 3 } ] }
 *       ] }
 *   ]
 *
 * 幂等：按 region_code / (name+parent) 判重，重复执行不会产生脏数据。
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Level = 'PROVINCE' | 'CITY' | 'DISTRICT';

interface RegionNode {
  name: string;
  code?: string;
  level?: number;
  children?: RegionNode[];
}

/** 内置最小数据集：项目当前使用地（北京-北京市-延庆区） */
const DEFAULT_TREE: RegionNode[] = [
  {
    name: '北京市',
    code: '110000',
    level: 1,
    children: [
      {
        name: '北京市',
        code: '110100',
        level: 2,
        children: [{ name: '延庆区', code: '110119', level: 3 }],
      },
    ],
  },
];

const LEVEL_ENUM: Record<number, Level> = {
  1: 'PROVINCE',
  2: 'CITY',
  3: 'DISTRICT',
};

async function upsertNode(
  node: RegionNode,
  parentId: bigint | null,
  depth: number,
  stats: { created: number; skipped: number },
): Promise<bigint> {
  const level = node.level ?? depth;
  const regionLevel = LEVEL_ENUM[level];
  if (!regionLevel) {
    throw new Error(`非法层级 ${level}（应为 1/2/3）：${node.name}`);
  }
  if (depth === 1 && parentId !== null) {
    throw new Error('省级节点不能有父级');
  }
  if (depth > 1 && parentId === null) {
    throw new Error(`${node.name} 缺少父级`);
  }

  // 判重：优先用国标编码，其次用「同级同名」
  const existing = node.code
    ? await prisma.sysRegion.findFirst({ where: { regionCode: node.code } })
    : await prisma.sysRegion.findFirst({
        where: { regionName: node.name, parentId },
      });

  let id: bigint;
  if (existing) {
    id = existing.id;
    stats.skipped += 1;
  } else {
    const created = await prisma.sysRegion.create({
      data: {
        regionName: node.name,
        parentId,
        regionLevel,
        regionCode: node.code ?? null,
      },
    });
    id = created.id;
    stats.created += 1;
    console.log(`  + [${regionLevel}] ${node.name}${node.code ? ` (${node.code})` : ''}`);
  }

  for (const child of node.children ?? []) {
    await upsertNode(child, id, depth + 1, stats);
  }
  return id;
}

/** 逐级校验：子级层级必须比父级深一级，且不允许循环引用 */
async function validateExistingTree(): Promise<void> {
  const all = await prisma.sysRegion.findMany({
    select: { id: true, regionName: true, parentId: true, regionLevel: true },
  });
  const byId = new Map(all.map((r) => [r.id.toString(), r]));
  const order: Record<Level, number> = { PROVINCE: 1, CITY: 2, DISTRICT: 3 };

  for (const r of all) {
    if (r.parentId === null) {
      if (r.regionLevel !== 'PROVINCE') {
        console.warn(`  ! ${r.regionName}(${r.id}) 无父级但层级为 ${r.regionLevel}`);
      }
      continue;
    }
    const parent = byId.get(r.parentId.toString());
    if (!parent) {
      console.warn(`  ! ${r.regionName}(${r.id}) 的父级 ${r.parentId} 不存在（孤儿引用）`);
      continue;
    }
    if (order[parent.regionLevel as Level] + 1 !== order[r.regionLevel as Level]) {
      console.warn(
        `  ! ${r.regionName}(${r.id}) 层级 ${r.regionLevel} 与父级 ${parent.regionName}(${parent.regionLevel}) 不相邻`,
      );
    }
    // 循环检测
    let cursor: bigint | null = r.parentId;
    const seen = new Set<string>([r.id.toString()]);
    while (cursor !== null) {
      const key = cursor.toString();
      if (seen.has(key)) {
        console.warn(`  ! 检测到循环引用：${r.regionName}(${r.id})`);
        break;
      }
      seen.add(key);
      cursor = byId.get(key)?.parentId ?? null;
    }
  }
}

async function main() {
  const arg = process.argv[2];
  let tree: RegionNode[] = DEFAULT_TREE;

  if (arg) {
    const fs = await import('fs');
    if (!fs.existsSync(arg)) {
      console.error(`找不到文件：${arg}`);
      process.exit(1);
    }
    tree = JSON.parse(fs.readFileSync(arg, 'utf-8')) as RegionNode[];
    console.log(`从 ${arg} 读取行政区划数据`);
  } else {
    console.log('未指定数据文件，使用内置数据集（北京市 → 北京市 → 延庆区）');
    console.log('如需导入完整国标数据，请用：npx ts-node prisma/seed-region.ts regions.json');
  }

  const stats = { created: 0, skipped: 0 };
  for (const node of tree) {
    await upsertNode(node, null, 1, stats);
  }

  console.log(`\n完成：新增 ${stats.created} 条，已存在跳过 ${stats.skipped} 条`);

  console.log('\n一致性检查：');
  await validateExistingTree();

  const total = await prisma.sysRegion.count();
  console.log(`\nsys_region 现有 ${total} 条记录`);
}

main()
  .catch((e) => {
    console.error('导入失败：', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
