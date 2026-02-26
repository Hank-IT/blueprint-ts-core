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
          //{ text: 'Support', link: '/services/support' },
          //{ text: 'Persistence Drivers', link: '/services/persistence-drivers' },
        ]
      },
      {
        text: 'Laravel',
        collapsed: false,
        items: [
          { text: 'Requests', link: '/services/laravel/requests' },
          { text: 'Pagination', link: '/services/laravel/pagination' }
        ]
      },
      {
        text: 'Vue',
        collapsed: false,
        items: [
          { text: 'State', link: '/vue/state/' },
          {
            text: 'Forms',
            link: '/vue/forms'
          },
          {
            text: 'Requests',
            items: [
              /*{ text: 'Usage with Composition API', link: '/vue/requests/composition' },
              { text: 'Loading States', link: '/vue/requests/loading' },
              { text: 'Error Handling', link: '/vue/requests/errors' },*/
              { text: 'Loading', link: '/vue/requests/loading' },
              { text: 'Route Resource Binding', link: '/vue/requests/route-resource-binding' }
            ]
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
