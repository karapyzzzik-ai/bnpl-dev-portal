import { useMDXComponents as getDocsMDXComponents } from 'nextra-theme-docs'
import { ApiPlayground } from './components/ApiPlayground'

const docsComponents = getDocsMDXComponents()

export function useMDXComponents(components: Record<string, unknown> = {}) {
  return {
    ...docsComponents,
    ApiPlayground,
    ...components
  }
}
