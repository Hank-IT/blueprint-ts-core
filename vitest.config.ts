import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      exclude: [...configDefaults.exclude, 'e2e/*'],
      root: fileURLToPath(new URL('./', import.meta.url)),
      reporters: ['default', 'junit', 'json'],
      outputFile: {
        junit: 'vitest-junit.xml',
        json: 'vitest-results.json'
      },
      coverage: {
        provider: 'v8',
        reportsDirectory: 'coverage',
        reporter: ['text', 'text-summary', 'json-summary', 'lcov', 'json', 'html', 'teamcity'],
        include: ['src/**/*.ts'],
        exclude: ['**/*.d.ts']
      }
    }
  })
)
