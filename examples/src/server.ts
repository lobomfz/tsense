import { RPCHandler } from '@orpc/server/fetch'

import homepage from './index.html'
import { router } from './api/router'

const rpcHandler = new RPCHandler(router)

const server = Bun.serve({
  port: 3010,
  development: true,
  routes: {
    '/': homepage,
  },
  async fetch(req) {
    const url = new URL(req.url)

    if (url.pathname.startsWith('/rpc')) {
      const { matched, response } = await rpcHandler.handle(req, {
        prefix: '/rpc',
        context: { user: { id: 'user-1' } },
      })

      if (matched) {
        return response
      }
    }

    return new Response('Not found', { status: 404 })
  },
})

console.log(`Server running on ${server.url}`)
