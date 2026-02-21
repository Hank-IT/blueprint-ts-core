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
          { text: 'Requests', link: '/services/requests' },
          //{ text: 'Pagination', link: '/services/pagination' },
          //{ text: 'Support', link: '/services/support' },
          //{ text: 'Persistence Drivers', link: '/services/persistence-drivers' },
          {
            text: 'Laravel Integration',
            collapsed: true,
            items: [
              { text: 'Laravel Requests', link: '/services/laravel/requests' },
              { text: 'Laravel Pagination', link: '/services/laravel/pagination' }
            ]
          }
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
              { text: 'Route Resource Binding', link: '/vue/requests/route-resource-binding' }
            ]
          }
        ]
      },
      {
        text: 'Upgrading',
        items: [
          { text: 'v1 to v2', link: '/upgrading/v1-to-v2' },
          { text: 'v2 to v3', link: '/upgrading/v2-to-v3' }
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