/**
 * Jest 配置（替代 package.json 内嵌配置）
 * 关键点：ts-jest 不读取 tsconfig 的 paths，需显式声明 moduleNameMapper 才能解析 "@/..."
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  // 避免 jest 派生 worker 子进程（受限环境下 fork 管道子进程会被拒绝）
  maxWorkers: 1,
  cache: false,
};
