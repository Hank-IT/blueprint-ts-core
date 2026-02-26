import { defineConfig } from 'vitepress'

export default defineConfig({
  title: '@blueprint-ts/core',
  description: 'Documentation for the @blueprint-ts/core library',

  base: process.env['DOCS_BASE'] || '/blueprint-ts-core/',

  themeConfig: {
    sidebar: [
      {
        text: 'Introduction',
        items: [{ text: 'Getting Started', link: '/' }]
      },
      {
        text: 'Services',
        collapsed: false,
        items: [
          {
            text: 'Requests',
            items: [
              { text: 'Getting Started', link: '/services/requests/getting-started' },
              { text: 'Loading', link: '/services/requests/loading' },
              { text: 'Drivers', link: '/services/requests/drivers' },
              { text: 'Responses', link: '/services/requests/responses' },
              { text: 'Request Bodies', link: '/services/requests/request-bodies' },
              { text: 'Headers', link: '/services/requests/headers' },
              { text: 'Aborting Requests', link: '/services/requests/abort-requests' },
              { text: 'Events', link: '/services/requests/events' },
              { text: 'Bulk Requests', link: '/services/requests/bulk-requests' },
              { text: 'Error Handling', link: '/services/requests/error-handling' }
            ]
          },
          {
            text: 'Pagination',
            items: [
              { text: 'Overview', link: '/services/pagination/' },
              { text: 'Page-Aware', link: '/services/pagination/page-aware' },
              { text: 'Infinite Scroller', link: '/services/pagination/infinite-scroller' },
              { text: 'State/Cursor', link: '/services/pagination/state-pagination' },
              { text: 'Updating Rows', link: '/services/pagination/updating-rows' }
            ]
          },
          {
            text: 'Support',
            items: [
              { text: 'Overview', link: '/services/support/' },
              { text: 'Helpers', link: '/services/support/helpers' },
              { text: 'DeferredPromise', link: '/services/support/deferred-promise' }
            ]
          },
          {
            text: 'Persistence',
            link: '/services/persistence/'
          }
          //{ text: 'Support', link: '/services/support' },
          //{ text: 'Persistence Drivers', link: '/services/persistence-drivers' },
        ]
      },
      {
        text: 'Laravel',
        collapsed: false,
        items: [
          { text: 'Requests', link: '/laravel/requests' },
          { text: 'Pagination', link: '/laravel/pagination' }
        ]
      },
      {
        text: 'Vue',
        collapsed: false,
        items: [
          { text: 'State', link: '/vue/state/' },
          {
            text: 'Composables',
            items: [
              { text: 'useConfirmDialog', link: '/vue/composables/use-confirm-dialog' },
              { text: 'useGlobalCheckbox', link: '/vue/composables/use-global-checkbox' },
              { text: 'useIsEmpty', link: '/vue/composables/use-is-empty' },
              { text: 'useIsOpen', link: '/vue/composables/use-is-open' },
              { text: 'useIsOpenFromVar', link: '/vue/composables/use-is-open-from-var' },
              { text: 'useModelWrapper', link: '/vue/composables/use-model-wrapper' },
              { text: 'useOnOpen', link: '/vue/composables/use-on-open' }
            ]
          },
          {
            text: 'Forms',
            items: [
              { text: 'Overview', link: '/vue/forms/' },
              { text: 'State And Properties', link: '/vue/forms/state-and-properties' },
              { text: 'Validation', link: '/vue/forms/validation' },
              { text: 'Building Payloads', link: '/vue/forms/payloads' },
              { text: 'Errors', link: '/vue/forms/errors' },
              { text: 'Persistence', link: '/vue/forms/persistence' },
              { text: 'Arrays', link: '/vue/forms/arrays' },
              { text: 'Utilities', link: '/vue/forms/utilities' }
            ]
          },
          {
            text: 'Requests',
            items: [
              /*{ text: 'Usage with Composition API', link: '/vue/requests/composition' },
              { text: 'Loading States', link: '/vue/requests/loading' },
              { text: 'Error Handling', link: '/vue/requests/errors' },*/
              { text: 'Loading', link: '/vue/requests/loading' }
            ]
          },
          {
            text: 'Router',
            items: [{ text: 'Route Resource Binding', link: '/vue/router/route-resource-binding' }]
          }
        ]
      },
      {
        text: 'Upgrading',
        items: [
          { text: 'v1 to v2', link: '/upgrading/v1-to-v2' },
          { text: 'v2 to v3', link: '/upgrading/v2-to-v3' },
          { text: 'v3 to v4', link: '/upgrading/v3-to-v4' }
        ]
      }
      /*{
        text: 'Helpers',
        items: [
          { text: 'Utility Functions', link: '/helpers/' }
        ]
      }*/
    ],
    nav: [
      { text: 'Home', link: '/' },
      { text: 'GitHub', link: 'https://github.com/Hank-IT/blueprint-ts-core' }
    ]
  }
})
